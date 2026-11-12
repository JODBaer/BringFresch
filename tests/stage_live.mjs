// Live-Test gegen den TEST-Server (bringfrisch-test: Test-Seite und Test-Server in einem Worker) und das echte Bring! – nur die Liste «Home-test» des Bots.
// Die WG-Liste wird nie berührt: der Test-Server kann gar nicht in eine andere Liste schreiben (ONLY_LIST_NAME).
//
//   Lokal (fragt den Test-PIN verdeckt):  powershell -ExecutionPolicy Bypass -File tests\stage_live.ps1
//   GitHub Actions:                        Secret STAGE_PIN, siehe .github/workflows/stage.yml
//
// Ablauf: Server erreichbar -> nur «Home-test» sichtbar -> Artikel setzen/ändern/wegnehmen
//         -> Test-App (dist-stage) in jsdom: verbinden, «Bring! füllen», alles auf «Home-test» -> aufräumen.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");
const { fixWindow } = require("./determinism.js");
const { appHtml } = require("./app_html.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = process.env.STAGE_URL || "https://bringfrisch-test.bringfrisch-worker.workers.dev";
const ORIGIN = "https://bringfrisch-test.bringfrisch-worker.workers.dev";
const PIN = process.env.STAGE_PIN || "";
const LISTS = ["Home-test", "Home"]; // «Home» = alter Name, bis die Liste in Bring! umbenannt ist
let LIST = LISTS[0];
const RUN = process.env.GITHUB_RUN_ID || String(Date.now()).slice(-6);

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; return c; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (cond, ms) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await wait(200); return cond(); };
const finish = () => { console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK"); process.exit(fails ? 1 : 0); };

if (!PIN) { console.log("FAIL  kein Test-PIN (Umgebungsvariable STAGE_PIN)"); process.exit(1); }

const api = async (p, init = {}) => {
  const r = await fetch(SERVER + p, { ...init, headers: { Origin: ORIGIN, "X-WG-PIN": PIN, "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p}: ${d.error || "HTTP " + r.status}`);
  return d;
};
const removeMine = async () => {
  const mine = (await api("/bring/list")).mine;
  for (let i = 0; i < mine.length; i += 40) await api("/bring/remove", { method: "POST", body: { names: mine.slice(i, i + 40) } });
  return mine.length;
};

console.log(`Test-Server: ${SERVER}\nBring!-Liste: ${LIST}\n`);

// 1. Server + Sicherheitsnetz: es darf nur «Home-test» geben, sonst sofort abbrechen (nichts schreiben)
check((await (await fetch(SERVER + "/health")).json()).ok === true, "Test-Server erreichbar");
const { lists, active } = await api("/bring/lists");
if (lists.length === 1) LIST = lists[0].name;
if (!check(lists.length === 1 && LISTS.some(n => n.toLowerCase().replace(/[^a-z0-9]/g, "") === lists[0].name.toLowerCase().replace(/[^a-z0-9]/g, "")) && lists[0].uuid === active, `Test-Server schreibt nur in «${LIST}» (sieht: ${lists.map(l => l.name).join(", ")})`)) finish();
const cors = await fetch(SERVER + "/health", { headers: { Origin: ORIGIN } });
check(cors.headers.get("access-control-allow-origin") === ORIGIN, "CORS erlaubt die Test-Seite");

// Reste eines früheren Laufs wegräumen (nur was der Bot selbst gesetzt hat)
const old = await removeMine();
if (old) console.log(`(aufgeräumt: ${old} Artikel aus einem früheren Lauf)`);

try {
  // 2. Bring! direkt über den Server: setzen, Menge ändern, wegnehmen
  const A = `BringFrisch Test A ${RUN}`, B = `BringFrisch Test B ${RUN}`;
  const s1 = await api("/bring/sync", { method: "POST", body: { items: [{ name: A, spec: "1 Stk" }, { name: B, spec: "200 g" }] } });
  check(s1.ok && s1.pushed === 2, "2 Test-Artikel an Bring! gesendet");
  check(s1.mode === "batch", `Bring! nimmt die Batch-Schnittstelle an (Modus «${s1.mode}»; «single» = Rückfall, Batch abgelehnt)`);
  let l = await api("/bring/list");
  check(l.items.includes(A) && l.items.includes(B) && l.mine.includes(A), `beide stehen auf «${LIST}» und gehören dem Bot`);
  const s2 = await api("/bring/sync", { method: "POST", body: { items: [{ name: A, spec: "3 Stk" }] } });
  check(s2.mode === "batch", `Menge ändern über die Batch-Schnittstelle (Modus «${s2.mode}»; «mixed» = Batch hat nichts geändert, einzeln nachgeschickt)`);
  l = await api("/bring/list");
  check((l.details.find(d => d.name === A) || {}).spec === "3 Stk", "Menge auf Bring! geändert (1 Stk -> 3 Stk)");
  const rm = await api("/bring/remove", { method: "POST", body: { names: [A, B] } });
  l = await api("/bring/list");
  check(rm.removed === 2 && !l.items.includes(A) && !l.items.includes(B), "beide wieder weg");

  // 3. Die Test-App wie auf dem Handy: verbinden und «Bring! füllen»
  const b = spawnSync(process.execPath, [path.join(here, "..", "tools", "build_stage.mjs")], { encoding: "utf8" });
  if (!check(b.status === 0, "Test-App gebaut (dist-stage)")) { console.log(b.stderr); finish(); }
  const dist = path.join(here, "..", "dist-stage");
  const html = appHtml(dist); // alle <script src> eingebettet (app_html.js)
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message));
  const dom = new JSDOM(html, {
    url: ORIGIN + "/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new w.Event("close")); } };
      w.navigator.clipboard = { writeText: async () => {} };
      fixWindow(w, { realNow: true });
      w.localStorage.setItem("bringfrisch_sync", JSON.stringify({ url: SERVER, pin: PIN }));
      w.localStorage.setItem("bringfrisch_me", JSON.stringify("joshua"));
      w.localStorage.setItem("bringfrisch_wahl_2026-W46", "true");
      w.fetch = (u, init = {}) => fetch(u, { ...init, headers: { ...(init.headers || {}), Origin: ORIGIN } }); // echtes Netz
    },
  });
  const W = dom.window, $ = id => W.document.getElementById(id);
  check(await waitFor(() => $("syncStatus").textContent.startsWith("Verbunden"), 20000), `Test-App verbunden («${$("syncStatus").textContent}»)`);
  check(await waitFor(() => $("bringListName").textContent === LIST, 20000), `Einstellungen zeigen «${LIST}»`);
  const n = parseInt($("ctaCount").textContent.replace(/\D/g, ""), 10) || 0;
  check(n > 0, `Plan braucht ${n} Artikel`);
  $("syncBtn").click();
  await wait(1500);
  if ($("dupDialog").open) $("dupSendBtn").click(); // falls von Hand schon etwas auf «Home-test» steht
  check(await waitFor(() => /✓ in Bring!/.test($("ctaCount").textContent), 90000), `«Bring! füllen» fertig («${$("ctaCount").textContent}»)`);
  l = await api("/bring/list");
  check(l.mine.length > 0 && l.mine.length <= n, `${l.mine.length} Artikel auf «${LIST}», z.B. ${l.details.slice(0, 4).map(d => `${d.name} [${d.spec}]`).join(", ")}`);
  check(l.details.every(d => !/\d\.\d{3}/.test(d.spec)), "Mengen sauber formatiert");
  check(errors.length === 0, `keine JS-Fehler ${errors.slice(0, 3).join(" | ")}`);
  W.close();
} catch (e) {
  check(false, `Abbruch: ${e.message}`);
} finally {
  // 4. Aufräumen: alles, was der Bot gesetzt hat, wieder weg
  try {
    const n = await removeMine();
    const left = (await api("/bring/list")).mine.length;
    check(left === 0, `aufgeräumt: ${n} Artikel von «${LIST}» entfernt`);
  } catch (e) { check(false, `Aufräumen: ${e.message}`); }
}
finish();
