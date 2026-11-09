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
const waitFor = async (cond, ms) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await wait(50); };

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
    const p = new URLSearchParams(init.body);
    if (p.get("remove")) { const i = bringList.findIndex(x => x.name === p.get("remove")); if (i >= 0) bringList.splice(i, 1); return new Response(null, { status: 204 }); }
    const ex = bringList.find(x => x.name === p.get("purchase"));
    if (ex) ex.specification = p.get("specification"); else bringList.push({ name: p.get("purchase"), specification: p.get("specification") });
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
await waitFor(() => /✓ in Bring!/.test(A2.document.getElementById("ctaCount").textContent), 4000); // ein Aufruf pro Artikel, je nach Woche verschieden lang
const names = new Set(bringList.map(i => i.name.toLowerCase()));
check(names.size === bringList.length && bringList.length > 0 && bringList.length <= n, `alle ${n} Positionen in Bring!, gleiche Namen zusammengefasst (${bringList.length} Einträge)`);
check(bringList.some(i => / \+ /.test(i.specification)) || bringList.length === n, "zusammengefasste Mengen z.B. «2 dl + 100 g»");
const catalog = A2.BRING_CATALOG || {};
const known = bringList.filter(i => catalog[i.name]);
check(known.length / bringList.length >= 0.8, `${known.length}/${bringList.length} Einträge sind Bring!-Katalogartikel (mit Bild): ${bringList.slice(0, 6).map(i => i.name + " [" + i.specification + "]").join(", ")}`);
check(bringList.every(i => i.specification && !/\d\.\d{3}/.test(i.specification)), "Mengen sauber formatiert");
check(/✓ in Bring!/.test(A2.document.getElementById("ctaCount").textContent), `nach dem Füllen: Chip «✓ in Bring!» (${A2.document.getElementById("ctaCount").textContent}, ${bringList.length} Einträge)`);

// Nochmals «Bring! füllen»: alles schon drauf, nichts geändert -> nichts senden, nicht fragen
const before2 = bringList.length;
A2.document.getElementById("syncBtn").click();
await wait(300);
check(!A2.document.getElementById("dupDialog").open && bringList.length === before2, "zweites «Bring! füllen» ohne Änderung: nichts doppelt, keine Frage");

// Ein zweites Rezept braucht dasselbe (mehr Gäste am Montag) -> nachfragen, Menge erhöhen
const p2 = JSON.parse(A2.localStorage.getItem("bringfrisch_current_plan"));
const firstIng = p2[0].ingredients[0];
const specBefore = JSON.stringify(bringList.map(i => [i.name, i.specification]));
A2.document.querySelectorAll("#days .prow")[0].querySelector(".buf").value = "6";
A2.document.querySelectorAll("#days .prow")[0].querySelector(".buf").dispatchEvent(new A2.Event("change", { bubbles: true }));
await wait(100);
check(/mehr/.test(A2.document.getElementById("ctaCount").textContent), `Knopf zeigt «mehr» (${A2.document.getElementById("ctaCount").textContent})`);
A2.document.getElementById("syncBtn").click();
await wait(300);
const dlg = A2.document.getElementById("dupDialog");
check(dlg.open && dlg.querySelectorAll("#dupList input:checked").length > 0, "fragt nach: schon vorhandene Artikel, Mengen-Erhöhung vorausgewählt");
check(/für /.test(dlg.querySelector("#dupList").textContent), "zeigt, für welches Rezept");
A2.document.getElementById("dupSendBtn").click();
await wait(400);
const specAfter = JSON.stringify(bringList.map(i => [i.name, i.specification]));
check(specAfter !== specBefore && bringList.length === before2, "Mengen auf Bring! erhöht, keine doppelten Einträge");

// Rückgängig: alles wie vorher
A2.document.querySelector(".toast button").click();
await wait(400);
check(JSON.stringify(bringList.map(i => [i.name, i.specification])) === specBefore, "«Rückgängig» stellt die alten Mengen wieder her");
void firstIng;

// Fremder Eintrag: Artikel wurde gekauft, dann trägt Leonie ihn mit eigener Menge neu ein
const victim = bringList[0].name;
bringList.splice(0, 1);
A2.document.querySelectorAll("dialog[open]").forEach(dl => dl.close());
A2.document.getElementById("openStaplesBtn").click(); // App lädt die Liste neu: Server merkt «gekauft» und vergisst den Eintrag
await wait(400);
A2.document.getElementById("staplesDialog").close();
bringList.push({ name: victim, specification: "1 Pack (Leonie)" });
A2.document.getElementById("syncBtn").click();
await wait(400);
// nach dem Artikelnamen suchen, nicht im ganzen Text («für Kürbis-Risotto» steht auch bei Rahm)
const rowF = [...A2.document.querySelectorAll("#dupList .duprow")].find(r => r.querySelector("b").textContent === victim);
check(!!rowF && /von jemand anderem/.test(rowF.textContent) && !rowF.querySelector("input").checked, `fremder Eintrag «${victim}» wird gefragt, nicht vorausgewählt`);
rowF.querySelector("input").checked = true;
A2.document.getElementById("dupSendBtn").click();
await wait(400);
check(/^1 Pack \(Leonie\) \+ /.test(bringList.find(i => i.name === victim).specification), "Menge ergänzt, Leonies Angabe bleibt stehen");
A2.document.getElementById("syncBtn").click();
await wait(300);
A2.document.getElementById("dupDialog").open && A2.document.getElementById("dupCancelBtn").click();

// Grundvorrat wie Bring!: antippen = drauf, nochmals = wieder weg
bringList.push({ name: "Salz", specification: "von Leonie" }); // jemand anderes
A2.document.getElementById("openStaplesBtn").click();
await wait(300);
const tile = name => [...A2.document.querySelectorAll("#staplesList .btile")].find(t => t.querySelector(".bname").textContent === name);
check(!!tile("Pfeffer") && !!tile("Olivenöl"), "Vorrat zeigt Bring!-Artikel (Pfeffer, Olivenöl)");
check(A2.document.querySelectorAll("#staplesList .bsec h3")[0].textContent.length > 0, "Vorrat in Bring!-Abteilungen");
tile("Pfeffer").click();
await wait(300);
check(bringList.some(x => x.name === "Pfeffer") && tile("Pfeffer").classList.contains("on"), "Pfeffer antippen -> auf Bring!, Kachel rot");
tile("Pfeffer").click();
await wait(300);
check(!bringList.some(x => x.name === "Pfeffer") && !tile("Pfeffer").classList.contains("on"), "nochmals antippen -> wieder weg");
check(tile("Salz").classList.contains("on"), "Salz (von Leonie) ist rot");
tile("Salz").click();
await wait(300);
check(bringList.some(x => x.name === "Salz"), "Bot nimmt Salz von Leonie NICHT weg");
tile("Olivenöl").click();
await wait(300);
bringList.splice(bringList.findIndex(x => x.name === "Olivenöl"), 1); // in Bring! gekauft/abgehakt
A2.document.getElementById("staplesDialog").close();
A2.document.getElementById("openStaplesBtn").click();
await wait(300);
check(!tile("Olivenöl").classList.contains("on"), "gekauftes Olivenöl ist wieder «da»");

// Nach «Bring! füllen»: Grundvorrat in der Einkaufsliste antippen -> doch auf Bring! (z.B. Öl ist leer)
A2.document.getElementById("staplesDialog").close();
A2.document.querySelector('#tab-shop .seg [data-filter="staples"]').click();
await wait(100);
const row = A2.document.querySelector('#shopList [data-shop][aria-pressed="false"]');
if (row) {
  const nm = row.dataset.shop;
  const before3 = bringList.length;
  row.click();
  await wait(400);
  check(bringList.length === before3 + 1, `Grundvorrat «${nm}» nach dem Füllen noch auf Bring! gesetzt`);
  A2.document.querySelector('#tab-shop .seg [data-filter="onBring"]').click();
  const back = [...A2.document.querySelectorAll("#shopList [data-shop]")].find(r => r.dataset.shop === nm);
  check(!!back && back.classList.contains("on"), `«${nm}» steht jetzt unter «Schon auf Bring!» (durchgestrichen)`);
  back.click();
  await wait(400);
  check(bringList.length === before3, `nochmals antippen nimmt «${nm}» wieder weg`);
} else check(false, "kein Grundvorrat im Wochenplan zum Testen");

// Grundvorrat gilt für die ganze WG: Handy B sieht, was Handy A als «auf Bring!»/leer markiert hat
A2.document.getElementById("openStaplesBtn").click();
await wait(300);
tile("Olivenöl").click();
await wait(1500); // Vorrat wird nach 0.8 s an den Server geschickt
const B2 = phone("jo");
await wait(500);
const stB = JSON.parse(B2.localStorage.getItem("bringfrisch_user_staples"));
check(stB.find(x => /Olivenöl/.test(x.name)).in_stock === false, "Handy B übernimmt den WG-Vorrat (Olivenöl leer)");

// Herunterziehen: A ändert etwas und zieht -> sofort beim Server; B zieht -> hat es
function pull(win) {
  if (!win.document.getElementById("wpop").hidden) win.document.getElementById("wlater").click(); // Wochenwahl-Pop-up «Später»
  const ev = (type, y) => { const e = new win.Event(type); Object.defineProperty(e, "touches", { value: y == null ? [] : [{ clientY: y }] }); win.dispatchEvent(e); };
  ev("touchstart", 10); ev("touchmove", 60); ev("touchmove", 120); ev("touchend");
}
A2.document.querySelectorAll("dialog[open]").forEach(d => d.close());
A2.document.querySelectorAll("#days .prow")[3].querySelector(".buf").value = "5";
A2.document.querySelectorAll("#days .prow")[3].querySelector(".buf").dispatchEvent(new A2.Event("change", { bubbles: true }));
pull(A2);
await wait(800);
check(JSON.parse(store.get("plan")).plan[3].leftover_buffer === 5, "Herunterziehen schickt meine Änderung sofort an den Server");
const B3 = phone("jo");
await wait(300);
await wait(600);
pull(B3);
await wait(800);
check(JSON.parse(B3.localStorage.getItem("bringfrisch_current_plan"))[3].leftover_buffer === 5, "anderes Handy: Herunterziehen holt den neuen Stand");
check(/Synchronisiert/.test((B3.document.querySelector(".toast") || {}).textContent || ""), "Meldung «Synchronisiert ✓»");

check(errors.length === 0, "keine JS-Fehler " + errors.join(" | "));
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
globalThis.fetch = realFetch;
process.exit(fails ? 1 : 0);
