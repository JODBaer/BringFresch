// End-to-End gegen den ECHTEN Server und das ECHTE Bring!-Konto des Bots.
// Lädt die Live-App (GitHub Pages) in jsdom, verbindet mit dem WG-PIN und spielt den ganzen Ablauf:
//   Verbinden -> Bring!-Liste anzeigen -> Wochenwahl (als Joshua) -> 7 Gerichte übernehmen
//   -> Plan geht an den Server -> Kalender-Abo -> «Bring! füllen» -> Artikel auf der Bring!-Liste
//
// Start (Windows, fragt den PIN verdeckt):  powershell -ExecutionPolicy Bypass -File tests\e2e_live.ps1
// Danach aufräumen (Artikel von der Liste nehmen):  … e2e_live.ps1 -Cleanup
//
// Achtung: schreibt eine echte Stimme von Joshua + den Plan für diese Woche auf den Server.
import { createRequire } from "module";
import { writeFileSync, readFileSync } from "fs";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");

const APP = "https://jodbaer.github.io/BringFresch/static/";
const PIN = process.env.WG_PIN || "";
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const CLEANUP = process.argv.includes("--cleanup");
const lines = [];
let fails = 0;
const log = s => { console.log(s); lines.push(s); };
const check = (c, m) => { log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; return c; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const done = () => {
  log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
  if (outFile) writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
  process.exit(fails ? 1 : 0);
};

if (!PIN) { log("FAIL  kein WG-PIN (Umgebungsvariable WG_PIN)"); done(); }

// Live-App holen (genau das, was die Handys bekommen)
const get = async f => {
  const r = await fetch(APP + f, { cache: "no-store" });
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.text();
};
const page = await get("index.html");
const sources = {};
for (const m of page.matchAll(/<script src="([^"]+)"><\/script>/g)) sources[m[1]] = await get(m[1]);
const html = page.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>${sources[f]}</script>`);
const SERVER = (sources["app.js"].match(/DEFAULT_SYNC_URL = "([^"]*)"/) || [])[1];
log(`App:    ${APP}`);
log(`Server: ${SERVER}`);

// Direkter Server-Zugriff für Kontrollen
const api = async (p, init = {}) => {
  const r = await fetch(SERVER + p, { ...init, headers: { "X-WG-PIN": PIN, "Content-Type": "application/json", ...(init.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
};

if (CLEANUP) {
  const last = JSON.parse(readFileSync(new URL("./.e2e-items.json", import.meta.url), "utf8"));
  let removed = 0;
  for (let i = 0; i < last.length; i += 40) {
    removed += (await api("/bring/remove", { method: "POST", body: JSON.stringify({ names: last.slice(i, i + 40) }) })).removed;
  }
  const left = (await api("/bring/list")).items.filter(x => last.includes(x));
  check(left.length === 0, `${removed} Test-Artikel von der Bring!-Liste entfernt`);
  done();
}

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
const dom = new JSDOM(html, {
  url: APP, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new w.Event("close")); } };
    w.navigator.clipboard = { writeText: async () => {} };
    w.localStorage.setItem("bringfrisch_me", JSON.stringify("joshua"));
    w.fetch = (u, init) => fetch(u, init); // echtes Netz
  },
});
const W = dom.window, $ = id => W.document.getElementById(id);
await wait(300);

log("\n[1] Verbinden");
$("syncPin").value = PIN;
$("syncForm").dispatchEvent(new W.Event("submit", { cancelable: true }));
for (let i = 0; i < 40 && !$("syncStatus").textContent.startsWith("Verbunden"); i++) await wait(250);
if (!check($("syncStatus").textContent.startsWith("Verbunden"), `Status: «${$("syncStatus").textContent}»`)) done();

log("\n[2] Bring!-Liste wählen");
for (let i = 0; i < 40 && $("bringListField").hidden; i++) await wait(250);
const opts = [...$("bringListSelect").options];
check(opts.length > 0, `Auswahl zeigt: ${opts.map(o => (o.selected ? "→" : "") + o.textContent).join(", ")}`);
// «Home-test» gehört der Test-Version (auf dem WG-Server nicht wählbar). Hier wird die Liste NICHT umgestellt.
check(!opts.some(o => o.textContent === "Home-test"), "«Home-test» ist auf dem WG-Server nicht wählbar");
const active = (await api("/bring/lists")).active;
check(opts.some(o => o.value === active), `Server schreibt in die gewählte WG-Liste (${(opts.find(o => o.value === active) || {}).textContent})`);

log("\n[3] Wochenwahl (als Joshua)");
$("openVoteBtn").click();
for (let i = 0; i < 40 && W.document.querySelectorAll("#voteGrid .vcard").length < 14; i++) await wait(250);
const cards = () => [...W.document.querySelectorAll("#voteGrid .vcard")];
check(cards().length === 14, `${cards().length} Gerichte im Memory`);
await wait(3000); // Abgleich mit dem Server (Kandidaten + Stimmen der anderen) abwarten
const titles = cards().map(c => c.querySelector(".vt").textContent);
log("        gewählt: " + titles.slice(0, 3).join(" | "));
for (const i of [0, 1, 2]) {
  const b = cards()[i].querySelector("[data-like]");
  if (b.getAttribute("aria-pressed") !== "true") b.click(); // schon gewählt (früherer Lauf)? nicht abwählen
}
await wait(1500);
$("voteApplyBtn").click();
const plan = JSON.parse(W.localStorage.getItem("bringfrisch_current_plan"));
check(plan.length === 7 && titles.slice(0, 3).every(t => plan.some(d => d.title === t)), "die 3 gewählten Gerichte stehen im Plan");
log("        " + plan.map((d, i) => `${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}: ${d.title}`).join("\n        "));

log("\n[4] Plan auf dem Server + Kalender");
await wait(2500);
const remote = await api("/plan");
check(remote.plan && remote.plan.map(d => d.title).join("|") === plan.map(d => d.title).join("|"), `Server hat den Plan (Woche ${remote.week})`);
const { url: cal } = await api("/cal-link");
const ics = await (await fetch(cal)).text();
check(ics.startsWith("BEGIN:VCALENDAR"), "Kalender-Abo antwortet");
check((ics.match(/BEGIN:VEVENT/g) || []).length >= 1, `${(ics.match(/BEGIN:VEVENT/g) || []).length} Znacht-Termine im Kalender`);

log("\n[5] Bring! füllen");
const before = (await api("/bring/list")).items;
const n = parseInt($("ctaCount").textContent.replace(/\D/g, ""), 10);
check(n > 0, `${n} Artikel zu kaufen`);
$("syncBtn").click();
for (let i = 0; i < 80 && $("syncBtn").disabled !== false; i++) await wait(250);
await wait(1500);
const after = (await api("/bring/list")).items;
const added = after.filter(x => !before.includes(x));
// gleiche Namen mit verschiedenen Einheiten werden zu einem Bring!-Eintrag zusammengefasst
check(added.length > 0 && after.length >= added.length, `Bring!-Liste hat jetzt ${after.length} Artikel (${added.length} neu, ${n} Positionen in der App)`);
log("        " + after.slice(0, 40).join(", "));
check(/✓ in Bring!/.test($("ctaCount").textContent), "App: danach «✓ in Bring!»");
writeFileSync(new URL("./.e2e-items.json", import.meta.url), JSON.stringify(added));

check(errors.length === 0, "keine JS-Fehler " + errors.join(" | "));
done();
