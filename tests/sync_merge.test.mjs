// Abgleich-Test: zwei Handys ändern gleichzeitig Verschiedenes -> nichts geht verloren; eine falsch gestellte Handy-Uhr
// gewinnt nicht. Zwei Handys (jsdom) + Worker (im Prozess), kein Netz. Start: cd tests && node sync_merge.test.mjs
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");
const { fixWindow, STANDARD_NOW } = require("./determinism.js");
const { appHtml } = require("./app_html.js");

const root = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "static");
const worker = (await import("file:///" + path.join(root, "..", "worker", "src", "index.js").replace(/\\/g, "/"))).default;

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

const store = new Map(), old = new Map();
let staleMs = 0;
const env = {
  WG_PIN: "4711", CAL_TOKEN: "cal", BRING_EMAIL: "bot@x.ch", BRING_PASSWORD: "pw",
  WG: {
    // Wie Cloudflare KV: direkt nach dem Speichern kann ein Lesen noch kurz den alten Stand liefern (staleMs > 0)
    async get(k, t) { const o = old.get(k); const v = o && Date.now() < o.until ? o.value : store.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { if (staleMs) old.set(k, { value: store.get(k), until: Date.now() + staleMs }); store.set(k, v); },
    async delete(k) { store.delete(k); },
    async list({ prefix = "" } = {}) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  },
};
const realFetch = globalThis.fetch;
const bringList = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith("/bringlists/L/items") && init.method === "PUT") { // Batch
    for (const c of JSON.parse(init.body).changes) {
      const i = bringList.findIndex(x => x.name === c.itemId);
      if (c.operation === "REMOVE") { if (i >= 0) bringList.splice(i, 1); } else if (i < 0) bringList.push({ name: c.itemId, specification: c.spec });
    }
    return new Response(null, { status: 204 });
  }
  if (url.endsWith("/bringlists/L") && init.method === "PUT") {
    const p = new URLSearchParams(init.body);
    if (p.get("remove")) { const i = bringList.findIndex(x => x.name === p.get("remove")); if (i >= 0) bringList.splice(i, 1); }
    else if (!bringList.some(x => x.name === p.get("purchase"))) bringList.push({ name: p.get("purchase"), specification: p.get("specification") });
    return new Response(null, { status: 204 });
  }
  if (url.endsWith("/bringauth")) return Response.json({ uuid: "u", access_token: "t", bringListUUID: "L" });
  if (url.endsWith("/bringusers/u/lists")) return Response.json({ lists: [{ listUuid: "L", name: "WG" }] });
  if (url.endsWith("/bringlists/L")) return Response.json({ purchase: bringList });
  return new Response("?", { status: 599 });
};

const html = appHtml(root); // alle <script src> aus index.html eingebettet (app_html.js)
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
let conflicts = 0;

// skew = so viele Millisekunden geht die Uhr dieses Handys falsch
function phone(me, { skew = 0, preset = {} } = {}) {
  return new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new w.Event("close")); } };
      fixWindow(w, { now: STANDARD_NOW, realNow: true });
      if (skew) { const real = w.Date.now; w.Date.now = () => real() + skew; }
      Object.entries({ bringfrisch_sync: { url: "https://wg.test", pin: "4711" }, bringfrisch_me: me, bringfrisch_welcome: true, ...preset })
        .forEach(([k, v]) => w.localStorage.setItem(k, JSON.stringify(v)));
      w.fetch = async (u, init = {}) => {
        const res = await worker.fetch(new Request(String(u), { ...init, headers: { ...(init.headers || {}), Origin: "https://jodbaer.github.io" } }), env);
        if (res.status === 409) conflicts++;
        return res;
      };
    },
  }).window;
}
function pull(win) {
  if (!win.document.getElementById("wpop").hidden) win.document.getElementById("wlater").click();
  win.document.querySelectorAll("dialog[open]").forEach(d => d.close());
  const ev = (type, y) => { const e = new win.Event(type); Object.defineProperty(e, "touches", { value: y == null ? [] : [{ clientY: y }] }); win.dispatchEvent(e); };
  ev("touchstart", 10); ev("touchmove", 60); ev("touchmove", 120); ev("touchend");
}
const row = (w, i) => w.document.querySelectorAll("#days .prow")[i];
const av = (w, i, n) => row(w, i).querySelectorAll(".av")[n];
const setBuf = (w, i, v) => { const b = row(w, i).querySelector(".buf"); b.value = String(v); b.dispatchEvent(new w.Event("change", { bubbles: true })); };
const serverPlan = () => JSON.parse(store.get("plan")).plan;
const localPlan = w => JSON.parse(w.localStorage.getItem("bringfrisch_current_plan"));

// Ausgangslage: A setzt den Plan der WG, B übernimmt ihn
const A = phone("joshua");
await wait(300);
av(A, 6, 3).click(); // Sonntag: Jo isst nicht mit -> Plan geht an den Server
await wait(1900);
const B = phone("jo");
await wait(400);
check(serverPlan()[6].eaters.length === 3 && localPlan(B)[6].eaters.length === 3, "Ausgangslage: beide Handys haben denselben Plan");
const titles = serverPlan().map(d => d.title);

// 1. Gleichzeitig: A ändert Montag, B ändert Mittwoch (beide senden nach 1.5 s, keiner hat den Stand des anderen gesehen)
av(A, 0, 1).click();   // Montag: Lukas weg
setBuf(B, 2, 5);        // Mittwoch: 5 Reste-Portionen
await wait(2300);
let sp = serverPlan();
check(conflicts >= 1, `der Server hat das zweite Speichern nicht einfach überschrieben (409: ${conflicts})`);
check(!sp[0].eaters.includes("lukas"), "Server: Änderung von A am Montag ist da");
check(sp[2].leftover_buffer === 5, "Server: Änderung von B am Mittwoch ist da");
check(sp.map(d => d.title).join("|") === titles.join("|"), "Menüs unverändert");
pull(A); pull(B);
await wait(900);
check(!localPlan(A)[0].eaters.includes("lukas") && localPlan(A)[2].leftover_buffer === 5, "Handy A zeigt beide Änderungen");
check(!localPlan(B)[0].eaters.includes("lukas") && localPlan(B)[2].leftover_buffer === 5, "Handy B zeigt beide Änderungen");

// 2. Beide ändern denselben Tag: der zuletzt Speichernde gilt für diesen Tag, der Rest bleibt
setBuf(A, 4, 6);
await wait(50);
setBuf(B, 4, 3);
await wait(2300);
sp = serverPlan();
check([3, 6].includes(sp[4].leftover_buffer) && !sp[0].eaters.includes("lukas") && sp[2].leftover_buffer === 5, `gleicher Tag: ein Stand gilt (${sp[4].leftover_buffer}), andere Tage bleiben`);

// 3. Grundvorrat: A meldet Olivenöl leer, B gleichzeitig Zucker leer -> beides bleibt
const stA = JSON.parse(A.localStorage.getItem("bringfrisch_user_staples"));
const mark = (w, re) => { const list = JSON.parse(w.localStorage.getItem("bringfrisch_user_staples")); return list.find(s => re.test(s.name)); };
check(stA.length > 10, "Grundvorrat vorhanden");
// «leer» melden wie beim Einkauf: Bereich «Vorrat», Zeile antippen (Variante C)
const leer = (w, name) => {
  w.document.querySelector('#tab-shop .seg [data-filter="staples"]').click();
  w.document.getElementById("vAll").open = true;
  [...w.document.querySelectorAll("#shopList [data-vleer]")].find(r => r.querySelector(".l").textContent.trim() === name).click();
};
for (const [w, name] of [[A, "Olivenöl"], [B, "Zucker"]]) leer(w, name);
await wait(2600);
pull(A); pull(B);
await wait(1200);
const sv = JSON.parse(store.get("vorrat")).staples;
check(sv.find(s => /Olivenöl/.test(s.name)).in_stock === false && sv.find(s => /zucker/i.test(s.name)).in_stock === false, "Server: Olivenöl und Zucker sind beide leer gemeldet");
check(mark(A, /zucker/i).in_stock === false && mark(B, /Olivenöl/).in_stock === false, "beide Handys kennen beide Meldungen");

// 4. Handy-Uhr geht einen Tag vor: sein unveränderter Stand darf neuere Änderungen der anderen nicht verdrängen
const C = phone("lukas", { skew: 86400000 });
await wait(400);
setBuf(C, 1, 4);        // C ändert Dienstag (Stempel «morgen»)
await wait(1900);
setBuf(A, 5, 6);        // danach ändert A den Samstag
await wait(1900);
pull(C);
await wait(900);
check(localPlan(C)[5].leftover_buffer === 6, "Handy mit falscher Uhr übernimmt die spätere Änderung von A");
check(serverPlan()[1].leftover_buffer === 4 && serverPlan()[5].leftover_buffer === 6, "Server hat beide Änderungen");

// 5. Handy von früher (ohne gemerkten Stand): verhält sich wie bisher, neuerer Server-Stand gilt
const D = phone("leonie", { preset: { bringfrisch_plan_updated: 5 } });
await wait(400);
check(localPlan(D)[5].leftover_buffer === 6 && D.localStorage.getItem("bringfrisch_base_plan"), "Handy ohne gemerkten Stand lädt den WG-Plan und merkt ihn sich");

// 6. Speicher des Servers antwortet kurz mit dem alten Stand (Cloudflare KV): eigene Änderungen dürfen nicht zurückspringen
staleMs = 4000;
setBuf(A, 3, 1);        // A ändert Donnerstag ...
await wait(1900);
pull(A);                // ... und zieht gleich herunter: der Server liefert noch den alten Plan
await wait(900);
check(localPlan(A)[3].leftover_buffer === 1, "nach Speichern + Herunterziehen bleibt die eigene Änderung (alter Stand vom Server wird nicht übernommen)");
setBuf(A, 0, 3);        // zweite Änderung, solange der Server noch den alten Stand liest
await wait(2300);
check(localPlan(A)[3].leftover_buffer === 1 && localPlan(A)[0].leftover_buffer === 3, "zweite Änderung kurz danach: die erste bleibt");
{
  const w = A;
  leer(w, "Senf");
  await wait(1500);
  pull(w);
  await wait(900);
  leer(w, "Honig");
  await wait(1500);
  pull(w);
  await wait(900);
  check(mark(w, /Senf/).in_stock === false && mark(w, /Honig/).in_stock === false, "Grundvorrat: zwei Meldungen nacheinander bleiben beide, auch wenn der Server kurz den alten Stand liefert");
}
await wait(4200);       // Speicher ist wieder aktuell
staleMs = 0;
pull(A);
await wait(900);
check(serverPlan()[3].leftover_buffer === 1 && serverPlan()[0].leftover_buffer === 3 && localPlan(A)[3].leftover_buffer === 1, "danach stimmen Server und Handy überein");
const svEnd = JSON.parse(store.get("vorrat")).staples;
check(svEnd.find(s => /Senf/.test(s.name)).in_stock === false && svEnd.find(s => /Honig/.test(s.name)).in_stock === false, "Server kennt beide Vorrat-Meldungen");

check(errors.length === 0, "keine JS-Fehler " + errors.join(" | "));
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
globalThis.fetch = realFetch;
process.exit(fails ? 1 : 0);
