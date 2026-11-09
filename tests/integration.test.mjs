// Integrationstest: zwei Handys (jsdom) + Worker (in-process) + simuliertes Bring!.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");

const root = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "static");
const worker = (await import("file:///" + path.join(root, "..", "worker", "src", "index.js").replace(/\\/g, "/"))).default;

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// KV + Bring!-Attrappe
const store = new Map();
const env = {
  WG_PIN: "4711", CAL_TOKEN: "cal-xyz", BRING_EMAIL: "bot@x.ch", BRING_PASSWORD: "pw",
  WG: {
    async get(k, t) { const v = store.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); },
    async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  },
};
const bringList = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith("/bringauth")) return Response.json({ uuid: "u", access_token: "t", bringListUUID: "L" });
  if (url.endsWith("/bringlists/L") && (init.method || "GET") === "GET") return Response.json({ purchase: bringList });
  if (url.endsWith("/bringlists/L") && init.method === "PUT") {
    const p = new URLSearchParams(init.body); bringList.push({ name: p.get("purchase"), specification: p.get("specification") });
    return new Response(null, { status: 204 });
  }
  return new Response("?", { status: 599 });
};

const WORKER_URL = "https://bringfrisch.test.workers.dev";
const html = fs.readFileSync(path.join(root, "index.html"), "utf8")
  .replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(root, f), "utf8")}</script>`);
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));

function phone(me) {
  const dom = new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new w.Event("close")); } };
      w.navigator.clipboard = { writeText: async () => {} };
      w.localStorage.setItem("bringfrisch_sync", JSON.stringify({ url: WORKER_URL, pin: "4711" }));
      w.localStorage.setItem("bringfrisch_me", JSON.stringify(me));
      w.fetch = async (u, init = {}) => {
        const req = new Request(String(u), { ...init, headers: { ...(init.headers || {}), Origin: "https://jodbaer.github.io" } });
        return worker.fetch(req, env);
      };
    },
  });
  return dom.window;
}

// Handy A (Joshua) startet, Handy B (Jo) startet
const A = phone("joshua");
await wait(200);
const B = phone("jo");
await wait(200);
check(A.document.getElementById("syncStatus").textContent.startsWith("Verbunden"), "Handy A verbunden");

// Wochenwahl: A öffnet zuerst -> Kandidaten landen im Worker
A.document.getElementById("openVoteBtn").click();
await wait(200);
const cardsA = () => [...A.document.querySelectorAll("#voteGrid .vcard")];
const titles = cardsA().map(c => c.querySelector(".vt").textContent);
B.document.getElementById("openVoteBtn").click();
await wait(200);
const titlesB = [...B.document.querySelectorAll("#voteGrid .vt")].map(t => t.textContent);
check(titles.join("|") === titlesB.join("|"), "beide Handys sehen dieselben 14 Gerichte");

// A wählt Gericht 0 und 1, B wählt Gericht 1 mit Wunschtag Mittwoch
cardsA()[0].querySelector("[data-like]").click();
cardsA()[1].querySelector("[data-like]").click();
const cardsB = () => [...B.document.querySelectorAll("#voteGrid .vcard")];
cardsB()[1].querySelector("[data-like]").click();
cardsB()[1].querySelector("[data-wish][data-day='2']").click();
await wait(800); // Stimmen werden nach 500 ms gesendet
B.document.getElementById("voteDialog").close();
B.document.getElementById("openVoteBtn").click(); // B lädt neu
await wait(300);
const votersOn1 = [...B.document.querySelectorAll("#voteGrid .vcard")][1].querySelectorAll(".mini").length;
check(votersOn1 === 2, "Handy B sieht Joshuas Stimme (2 Stimmen auf Gericht 2)");

// B übernimmt den Plan
B.document.getElementById("voteApplyBtn").click();
const planB = JSON.parse(B.localStorage.getItem("bringfrisch_current_plan"));
check(planB[2].title === titles[1], `Wunschtag Mittwoch respektiert (${planB[2].title})`);
await wait(1800); // Plan wird nach 1.5 s an den Worker gesendet

// A lädt neu -> bekommt den Plan von B
const A2 = phone("joshua");
await wait(400);
const planA = JSON.parse(A2.localStorage.getItem("bringfrisch_current_plan"));
check(planA[2].title === titles[1], "Handy A übernimmt den neueren WG-Plan");

// Kalender
const ics = await (await worker.fetch(new Request(`${WORKER_URL}/cal/cal-xyz.ics`), env)).text();
check(ics.includes(`SUMMARY:🍲 ${titles[1].replace(/,/g, "\\,")}`), "Kalender-Abo enthält das gewählte Gericht");

// Bring! füllen über den Worker
const n = parseInt(A2.document.getElementById("ctaCount").textContent.replace(/\D/g, ""), 10);
A2.document.getElementById("syncBtn").click();
await wait(500);
const names = new Set(bringList.map(i => i.name.toLowerCase()));
check(names.size === bringList.length && bringList.length > 0 && bringList.length <= n, `alle ${n} Positionen in Bring!, gleiche Namen zusammengefasst (${bringList.length} Einträge)`);
check(bringList.some(i => / \+ /.test(i.specification)) || bringList.length === n, "zusammengefasste Mengen z.B. «2 dl + 100 g»");
check(bringList.every(i => i.specification && !/\d\.\d{3}/.test(i.specification)), "Mengen sauber formatiert");
check(/schon auf Bring!/.test(A2.document.getElementById("basketLine").textContent), "Plan-Seite zeigt 'schon auf Bring!'");
check(parseInt(A2.document.getElementById("ctaCount").textContent.replace(/\D/g, ""), 10) === 0, "nach dem Sync nichts mehr zu kaufen");

check(errors.length === 0, "keine JS-Fehler " + errors.join(" | "));
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
globalThis.fetch = realFetch;
process.exit(fails ? 1 : 0);
