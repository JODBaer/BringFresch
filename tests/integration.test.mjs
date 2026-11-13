// Integrationstest: zwei Handys (jsdom) + Worker (in-process) + simuliertes Bring!.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");
const { fixWindow, STANDARD_NOW } = require("./determinism.js");
const { appHtml } = require("./app_html.js");

const root = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "static");
const workerMod = await import("file:///" + path.join(root, "..", "worker", "src", "index.js").replace(/\\/g, "/"));
const worker = workerMod.default;

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
    async delete(k) { store.delete(k); },
    async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  },
};
const bringList = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith("/bringauth")) return Response.json({ uuid: "u", access_token: "t", bringListUUID: "L" });
  if (url.endsWith("/bringusers/u/lists")) return Response.json({ lists: [{ listUuid: "L", name: "WG" }] });
  if (url.endsWith("/bringlists/L/items") && init.method === "PUT") { // Batch (ein Aufruf für viele Änderungen)
    for (const c of JSON.parse(init.body).changes) {
      const i = bringList.findIndex(x => x.name === c.itemId);
      if (c.operation === "REMOVE") { if (i >= 0) bringList.splice(i, 1); } else if (i >= 0) bringList[i].specification = c.spec; else bringList.push({ name: c.itemId, specification: c.spec });
    }
    return new Response(null, { status: 204 });
  }
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
const html = appHtml(root); // alle <script src> aus index.html eingebettet (app_html.js)
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));

function phone(me, fakeNow, { fresh = false } = {}) {
  const dom = new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new w.Event("close")); } };
      w.navigator.clipboard = { writeText: async () => {} };
      // festes Datum (Standard Dienstag KW 46) + fester Zufall; Date.now() läuft echt (Worker: neuerer Stand gewinnt)
      fixWindow(w, { now: fakeNow || STANDARD_NOW, realNow: true });
      if (!fresh) {
        w.localStorage.setItem("bringfrisch_sync", JSON.stringify({ url: WORKER_URL, pin: "4711" }));
        w.localStorage.setItem("bringfrisch_me", JSON.stringify(me));
      }
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
check(A.document.getElementById("bringListName").textContent === "WG" && !A.document.getElementById("setMore").open, "Einstellungen zeigen die Bring!-Liste, «Mehr» bleibt zu");

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

// Alte App-Version hat beim Mischen dasselbe Gericht zweimal auf den WG-Server geschrieben: beim Öffnen bereinigt
const candKey = [...store.keys()].find(k => /^week:2026-W\d+:candidates$/.test(k));
const orig = JSON.parse(store.get(candKey));
store.set(candKey, JSON.stringify([...orig.slice(0, 13), orig[0]]));
B.document.getElementById("voteDialog").close();
B.document.getElementById("openVoteBtn").click();
await wait(300);
const idsB = [...B.document.querySelectorAll("#voteGrid .vcard")].map(c => c.dataset.id);
check(idsB.length === 14 && new Set(idsB).size === 14 && idsB[0] === orig[0], "doppelte Karte vom Server weg, wieder 14 verschiedene Gerichte");
check(new Set(JSON.parse(store.get(candKey))).size === 14, "bereinigte Wochenwahl für alle auf den WG-Server zurückgeschrieben");

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

// Grundvorrat (Variante C): Kacheln mit Menge; «leer» beim Einkauf merkt nur – auf Bring! erst nach «Prüfen»
bringList.push({ name: "Salz", specification: "von Leonie" }); // jemand anderes
A2.document.getElementById("openStaplesBtn").click();
await wait(300);
const tile = name => [...A2.document.querySelectorAll("#staplesList .qt[data-staple]")].find(t => t.querySelector(".n").textContent.trim() === name);
check(!!tile("Pfeffer") && !!tile("Olivenöl"), "Vorrat zeigt Bring!-Artikel als Kacheln (Pfeffer, Olivenöl)");
check(A2.document.querySelectorAll("#staplesList .bsec h3")[0].textContent.length > 0, "Vorrat in Bring!-Abteilungen");
check(/~10 Znacht/.test(tile("Olivenöl").textContent), "alter Vorrat ohne Menge = eine volle Packung (~10 Znacht)");
A2.document.getElementById("staplesDialog").close();
A2.document.querySelector('#tab-shop .seg [data-filter="staples"]').click();
await wait(100);
const vrowOf = name => [...A2.document.querySelectorAll("#shopList [data-vleer]")].find(r => r.querySelector(".l").textContent.trim() === name);
A2.document.getElementById("vAll").open = true;
const nBring = bringList.length;
vrowOf("Olivenöl").click(); // Zeile antippen = Blatt zum Artikel, dort «Leer»
check(A2.document.getElementById("stapleItemDialog").open, "Vorrat: Zeile antippen öffnet das Blatt zum Artikel");
A2.document.querySelector('#vBody [data-v="set"][data-n="0"]').click();
A2.document.getElementById("stapleItemDialog").close();
await wait(300);
check(vrowOf("Olivenöl").getAttribute("aria-pressed") === "true" && bringList.length === nBring, "Vorrat: im Blatt «Leer» = leer (durchgestrichen), Bring! bleibt unberührt");
check(!A2.document.getElementById("vorratTray").hidden && /Olivenöl/.test(A2.document.getElementById("vorratTray").textContent), "Leiste «Für Bring!» zeigt Olivenöl");
A2.document.getElementById("trayCheckBtn").click();
await wait(100);
const chip = name => [...A2.document.querySelectorAll("#compareCols [data-cmp]")].find(c => c.firstChild.textContent.trim() === name);
check(A2.document.getElementById("compareDialog").open && chip("Olivenöl") && chip("Olivenöl").getAttribute("aria-pressed") === "true", "Gegenüberstellung: Olivenöl rechts unter «Vorrat», vorausgewählt");
A2.document.querySelectorAll('#compareCols [data-cmp^="p:"][aria-pressed="true"]:not(:disabled)').forEach(c => c.click());
A2.document.getElementById("compareSendBtn").click();
await wait(400);
const oil = bringList.find(x => x.name === "Olivenöl");
check(!!oil && /^Vorrat · /.test(oil.specification) && bringList.length === nBring + 1, `nach dem Senden steht Olivenöl auf Bring! mit Vermerk «Vorrat · …» (${oil && oil.specification})`);
check(bringList.some(x => x.name === "Salz" && x.specification === "von Leonie"), "Salz von Leonie bleibt unangetastet");
bringList.splice(bringList.findIndex(x => x.name === "Olivenöl"), 1); // in Bring! gekauft/abgehakt
A2.document.getElementById("openStaplesBtn").click();
await wait(300);
check(/~10 Znacht/.test(tile("Olivenöl").textContent) && !tile("Olivenöl").classList.contains("zero"), "in Bring! gekauft = Olivenöl wieder da (eine Packung)");
A2.document.getElementById("staplesDialog").close();

// Grundvorrat gilt für die ganze WG: Handy B sieht, was Handy A als leer gemeldet hat
vrowOf("Olivenöl").click(); // Blatt
A2.document.querySelector('#vBody [data-v="set"][data-n="0"]').click(); // «Leer»
A2.document.getElementById("stapleItemDialog").close();
await wait(1500); // Vorrat wird nach 0.8 s an den Server geschickt
const B2 = phone("jo");
await wait(500);
const stB = JSON.parse(B2.localStorage.getItem("bringfrisch_user_staples"));
check(stB.find(x => /Olivenöl/.test(x.name)).in_stock === false && stB.find(x => /Olivenöl/.test(x.name)).qty === 0, "Handy B übernimmt den WG-Vorrat (Olivenöl leer)");

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

// Ab Donnerstag: Joshua plant die nächste Woche, Jo sieht sie nach dem Synchronisieren
const T = "2026-11-12T12:00:00";
const N1 = phone("joshua", T);
await wait(400);
const wpop = N1.document.getElementById("wpop");
if (!wpop.hidden) N1.document.getElementById("wlater").click();
N1.document.getElementById("weekChip").click();
N1.document.querySelectorAll("#days .prow")[1].querySelector(".t").click();
const pickN = N1.document.querySelector("#mlist .opt[data-id]");
const nextTitle = pickN.querySelector(".n").textContent;
pickN.click();
await wait(1900); // nächste Woche wird nach 1.5 s an den Worker gesendet
check(!!store.get("plan:2026-W47") && JSON.parse(store.get("plan:2026-W47")).plan[1].title === nextTitle, `nächste Woche im WG-Server (${nextTitle})`);
const curTitle = JSON.parse(store.get("plan")).plan[1].title;
check(curTitle !== nextTitle || JSON.parse(store.get("plan")).week !== "2026-W47", "laufender WG-Plan bleibt unberührt");
const N2 = phone("jo", T);
await wait(500);
if (!N2.document.getElementById("wpop").hidden) N2.document.getElementById("wlater").click();
N2.document.getElementById("weekChip").click();
check(N2.document.querySelectorAll("#days .prow")[1].querySelector(".t").textContent === nextTitle, "Jo sieht Joshuas Plan für nächste Woche");

// WG-Einstellungen: Joshua fügt Mia hinzu (5. Person), ändert Znacht-Zeit und speichert für alle -> Jo hat es nach dem Herunterziehen
const S1 = phone("joshua");
await wait(500);
S1.document.querySelectorAll("dialog[open]").forEach(d => d.close());
if (!S1.document.getElementById("wpop").hidden) S1.document.getElementById("wlater").click();
S1.document.getElementById("newMemberName").value = "Mia";
S1.document.getElementById("addMemberForm").dispatchEvent(new S1.Event("submit", { cancelable: true }));
S1.document.getElementById("dinnerTime").value = "19:00";
S1.document.getElementById("dinnerTime").dispatchEvent(new S1.Event("change"));
S1.document.getElementById("settingsSaveBtn").click();
await wait(600);
const savedSettings = JSON.parse(store.get("settings") || "{}").settings || {};
check(savedSettings.members && savedSettings.members.length === 5 && savedSettings.dinnerTime === "19:00", `«Speichern & an alle senden»: 5 Mitbewohner + Znacht 19:00 im WG-Server (${(savedSettings.members || []).length})`);
const S2 = phone("jo");
await wait(500);
pull(S2);
await wait(800);
const s2Members = JSON.parse(S2.localStorage.getItem("bringfrisch_members") || "[]");
check(s2Members.length === 5 && s2Members.some(m => m.name === "Mia") && S2.document.getElementById("dinnerTime").value === "19:00", `Jo hat nach dem Herunterziehen 5 Mitbewohner und 19:00 (${s2Members.map(m => m.name).join(", ")})`);
const who = S2.document.querySelector("#days .prow .who");
check(who.classList.contains("many") && who.style.getPropertyValue("--cols") === "3" && who.querySelectorAll(".av").length === 5 && who.querySelectorAll(".av.r2").length === 2, "Plan bei 5 Personen: zwei Reihen, 3 oben + 2 unten");

// Zweite WG: neues Handy, erster Start -> WG-Name + PIN -> «Wer bist du?»; Daten getrennt von der ersten WG
store.set("wgs:sonnenhof", JSON.stringify({ name: "Sonnenhof", salt: "ab", pinHash: await workerMod.pinHash("ab", "135790"), calToken: "cal-sonnenhof-xxxxxxxxxx" }));
const mainSettingsBefore = store.get("settings"), mainPlanBefore = store.get("plan");
const join = async (W, wg, pin) => {
  W.document.getElementById("welcomeWg").value = wg;
  W.document.getElementById("welcomePin").value = pin;
  W.document.getElementById("welcomeJoin").dispatchEvent(new W.Event("submit", { cancelable: true }));
  await wait(400);
};
const W1 = phone(null, null, { fresh: true });
await wait(300);
check(W1.document.getElementById("welcomeDialog").open, "neues Handy: Willkommen (WG-Name + PIN)");
await join(W1, "Sonnenhof", "4711");
check(/Falscher WG-Name oder PIN/.test(W1.document.getElementById("welcomeStatus").textContent) && !W1.localStorage.getItem("bringfrisch_sync"), "falscher PIN: Meldung, nichts gespeichert");
await join(W1, "Sonnenhof", "135790");
check(!W1.document.getElementById("welcomeWho").hidden && !W1.document.querySelector("#welcomeMembers [data-me]"), "leere WG: «Wer bist du?» ohne fremde Namen");
W1.document.getElementById("welcomeName").value = "Mia";
W1.document.getElementById("welcomeDiet").value = "vegi";
W1.document.getElementById("welcomeAdd").dispatchEvent(new W1.Event("submit", { cancelable: true }));
await wait(2500);
const shSettings = JSON.parse(store.get("w:sonnenhof:settings") || "{}").settings || {};
check(!W1.document.getElementById("welcomeDialog").open && shSettings.members && shSettings.members.map(m => m.name).join() === "Mia", `erste Person der zweiten WG: nur Mia (${(shSettings.members || []).map(m => m.name)})`);
check(JSON.parse(W1.localStorage.getItem("bringfrisch_sync")).wg === "Sonnenhof" && JSON.parse(W1.localStorage.getItem("bringfrisch_terms")).version, "WG-Name gemerkt, Bedingungen akzeptiert (mit Datum)");
check(store.get("settings") === mainSettingsBefore && store.get("plan") === mainPlanBefore, "erste WG unberührt (Mitbewohner, Plan)");
const shPlan = JSON.parse(store.get("w:sonnenhof:plan") || "null");
check(shPlan && shPlan.plan.every(d => d.empty || d.eaters.join() === shSettings.members[0].id), "Plan der zweiten WG: nur Mia isst mit");
const W2 = phone(null, null, { fresh: true });
await wait(300);
await join(W2, "sonnenhof", "135790");
const btns = [...W2.document.querySelectorAll("#welcomeMembers [data-me]")];
check(btns.map(b => b.textContent).join() === "Mia", "zweites Handy der zweiten WG: «Wer bist du?» zeigt Mia");
btns[0].click();
await wait(300);
check(!W2.document.getElementById("welcomeDialog").open && JSON.parse(W2.localStorage.getItem("bringfrisch_me")) === shSettings.members[0].id, "angetippt = «Ich bin» gespeichert");

check(errors.length === 0, "keine JS-Fehler " + errors.join(" | "));
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
globalThis.fetch = realFetch;
process.exit(fails ? 1 : 0);
