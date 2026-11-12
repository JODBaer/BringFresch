// UI-Test wie ein Mensch: echter Chrome/Edge (headless), Handy 390×844 mit Touch, tippt sich durch jede Seite und jede Funktion.
//   node ui_e2e.mjs            -> alle Abläufe, am Schluss «ALLES OK» oder «n FEHLER» (Exit-Code 1)
//   node ui_e2e.mjs --shots    -> zusätzlich Bildschirmfotos in tests/shots/ui/ (Fehlerfotos immer)
// Ohne Internet und ohne Zugangsdaten, jedes Mal gleich:
//   - static/ läuft über einen kleinen lokalen Webserver (wie GitHub Pages, mit Service Worker)
//   - feste Uhr (Di 10.11.2026 12:00, Do 12.11. für «nächste Woche», Mo 16.11. für den Wochenwechsel) + fester Zufall
//   - WG-Server: Anfragen der App an den Worker werden abgefangen und vom echten Worker-Code (worker/src/index.js)
//     hier im Prozess beantwortet – mit Speicher im RAM und einem nachgebauten Bring! (Listen «WG», «Ferien» und die reservierte «Home-test»).
// Browser: BROWSER=/pfad/zu/chrome, sonst Edge/Chrome/Chromium des Systems, sonst `npm run chrome` (lädt Chrome nach tests/.chrome).
//
// Neuen Schritt hinzufügen (siehe README «Tests»): in einem Ablauf unten
//   await step(A, "Was geprüft wird", async () => { await tap(A, "#knopf"); await toastIs(A, /Erwarteter Text/); });
import puppeteer from "puppeteer-core";
import http from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(here, "..", "static");
const SHOTS = process.argv.includes("--shots");
const shotDir = path.join(here, "shots", "ui");
mkdirSync(shotDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Browser finden
function findBrowser() {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 7 || !existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p, depth + 1);
      else if (/^(chrome|chrome\.exe|Google Chrome for Testing)$/.test(f)) found.push(p);
    }
  };
  walk(path.join(here, ".chrome"), 0); // npm run chrome
  return [
    process.env.BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/opt/pw-browsers/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ...found,
  ].find(p => p && existsSync(p));
}
const browserPath = findBrowser();
if (!browserPath) {
  console.log("FAIL  Kein Chrome/Edge gefunden. BROWSER=/pfad/zu/chrome setzen oder einmal `npm run chrome` ausführen.");
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// WG-Server (echter Worker-Code) + Bring!-Attrappe
const worker = (await import(pathToFileURL(path.join(here, "..", "worker", "src", "index.js")).href)).default;
const WORKER = "https://bringfrisch.bringfrisch-worker.workers.dev"; // DEFAULT_SYNC_URL der App
const PIN = "2468"; // nur für diesen Test-Worker im Speicher – nicht der WG-PIN
const kv = new Map(), kvMeta = new Map();
const env = {
  WG_PIN: PIN, MAIN_WG: "wg1", CAL_TOKEN: "cal-test", BRING_EMAIL: "bot@test.invalid", BRING_PASSWORD: "test",
  WG: {
    async get(k, t) { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    async put(k, v, o) { kv.set(k, v); if (o && o.metadata) kvMeta.set(k, o.metadata); else kvMeta.delete(k); },
    async getWithMetadata(k) { const v = kv.get(k); return { value: v == null ? null : v, metadata: kvMeta.get(k) || null }; },
    async delete(k) { kv.delete(k); },
    async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  },
};
const kvJson = k => (kv.has(k) ? JSON.parse(kv.get(k)) : null);
const bring = { L: { name: "WG", items: [] }, H: { name: "Ferien", items: [] }, T: { name: "Home-test", items: [] } };
const RECIPE_URL = "https://www.bettybossi.ch/de/rezepte/rezept/kuerbis-lasagne-10001234/";
const RECIPE_HTML = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Recipe", name: "Kürbis-Lasagne", recipeYield: "6 Personen", totalTime: "PT50M",
  recipeIngredient: ["600 g Butternuss-Kürbis", "250 g Lasagneblätter", "2 dl Halbrahm"],
})}</script></head><body><h1>Kürbis-Lasagne</h1></body></html>`;
// Der Worker ruft fetch() für Bring! und Rezeptseiten auf – hier beantwortet, nichts geht ins Internet
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const method = init.method || "GET";
  if (url.endsWith("/bringauth")) return Response.json({ uuid: "u", access_token: "t", bringListUUID: "L" });
  if (url.endsWith("/bringusers/u/lists")) return Response.json({ lists: Object.entries(bring).map(([listUuid, l]) => ({ listUuid, name: l.name })) });
  const bm = url.match(/\/bringlists\/(\w+)\/items$/); // Batch: ein Aufruf für viele Änderungen
  if (bm && bring[bm[1]] && method === "PUT") {
    const items = bring[bm[1]].items;
    for (const c of JSON.parse(init.body).changes) {
      const i = items.findIndex(x => x.name === c.itemId);
      if (c.operation === "REMOVE") { if (i >= 0) items.splice(i, 1); } else if (i >= 0) items[i].specification = c.spec; else items.push({ name: c.itemId, specification: c.spec });
    }
    return new Response(null, { status: 204 });
  }
  const lm = url.match(/\/bringlists\/(\w+)$/);
  if (lm && bring[lm[1]]) {
    const items = bring[lm[1]].items;
    if (method === "GET") return Response.json({ purchase: items.map(x => ({ ...x })) });
    const p = new URLSearchParams(init.body);
    if (p.get("remove")) {
      const i = items.findIndex(x => x.name === p.get("remove"));
      if (i >= 0) items.splice(i, 1);
    } else {
      const ex = items.find(x => x.name === p.get("purchase"));
      if (ex) ex.specification = p.get("specification");
      else items.push({ name: p.get("purchase"), specification: p.get("specification") });
    }
    return new Response(null, { status: 204 });
  }
  // Rezeptseiten der Wochenwahl: Vorschaubild (og:image) -> winziges PNG
  if (/^https:\/\/(fooby\.ch|www\.swissmilk\.ch|migusto\.migros\.ch|www\.bettybossi\.ch)\//.test(url) &&url.split("?")[0] !== RECIPE_URL) return new Response(`<html><head><meta property="og:image" content="https://bilder.test/${encodeURIComponent(url).slice(-40)}.png"></head></html>`, { headers: { "Content-Type": "text/html" } });
  if (url.startsWith("https://bilder.test/")) return new Response(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"), { headers: { "Content-Type": "image/png" } });
  if (url.split("?")[0] === RECIPE_URL) return new Response(RECIPE_HTML, { headers: { "Content-Type": "text/html" } });
  return new Response("kein Netz im Test", { status: 599 });
};
const wg = () => bring.L.items;
const wgNames = () => wg().map(x => x.name).sort();
const wgSnap = () => JSON.stringify([...wg()].sort((a, b) => a.name.localeCompare(b.name)));
const workerCall = async (p, init = {}) => (await worker.fetch(new Request(WORKER + p, { ...init, headers: { "X-WG-PIN": PIN, "Content-Type": "application/json", ...(init.headers || {}) } }), env));

// ---------------------------------------------------------------------------------------------
// Lokaler Webserver für static/
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(staticDir, p);
  if (!f.startsWith(staticDir) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end("nicht gefunden"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------------------------------------------------------------------------------------------
// Bericht
let fails = 0;
let shotNo = 0;
async function step(P, name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`PASS  ${P.name}: ${name}${process.env.UI_TIMES ? ` (${((Date.now() - t0) / 1000).toFixed(1)} s)` : ""}`);
  } catch (e) {
    fails++;
    console.log(`FAIL  ${P.name}: ${name}\n        ${String(e.message || e).split("\n")[0]}`);
    try {
      await P.page.screenshot({ path: path.join(shotDir, `FEHLER-${++shotNo}-${P.name}.png`) });
      // aufräumen, damit der nächste Schritt nicht auch scheitert: offene Fenster, Blatt, Menü, Pop-up schliessen
      await P.page.evaluate(() => {
        document.querySelectorAll("dialog[open]").forEach(d => d.close());
        document.querySelectorAll(".msheet.show, .mscrim.show, .navmenu.show, .wscrim.show").forEach(e => e.classList.remove("show"));
        const w = document.getElementById("wpop"); if (w) { w.hidden = true; w.classList.remove("show"); }
        document.querySelectorAll(".toast").forEach(t => t.remove());
      });
    } catch { /* Seite weg */ }
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

// ---------------------------------------------------------------------------------------------
// Ein «Handy»: eigener Browser-Kontext (eigener Speicher), feste Uhr, Touch, WG-Server abgefangen
const launchArgs = ["--no-first-run", "--no-default-browser-check", "--disable-gpu", ...(process.env.CI || process.platform === "linux" ? ["--no-sandbox", "--disable-dev-shm-usage"] : [])];
const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: launchArgs, protocolTimeout: 30000 });

async function phone({ name, os, scheme, now, preset = {}, context, url }) {
  context = context || (await browser.createBrowserContext());
  const page = await context.newPage();
  const P = { name, os, scheme, page, context, errors: [], allow: [], offline: false, blocked: [], calls: [] };
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // iPhone/Android wie echte Handys erkennen (Kalender-Abo: iPhone = Kalender-App, Android = Google Kalender)
  await page.setUserAgent(os === "ios"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.emulateTimezone("Europe/Zurich");
  await page.evaluateOnNewDocument((nowIso, preset) => {
    // Kalendertag fest; Date.now() läuft echt weiter (der WG-Server vergleicht Zeitstempel: neuerer Stand gewinnt)
    const Real = Date, fixed = new Real(nowIso).getTime();
    window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return Real.now(); } };
    // fester Zufall (Mulberry32), damit jeder Lauf dieselben Gerichte zeigt
    let s = 46;
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try {
      if (!localStorage.getItem("__ui_seeded")) {
        for (const [k, v] of Object.entries({ bringfrisch_welcome: "true", ...preset })) localStorage.setItem(k, v);
        localStorage.setItem("__ui_seeded", "1");
      }
    } catch (e) { /* ohne Speicher */ }
    // Das native Teilen-Blatt lässt sich headless nicht bedienen: wie ein Gerät ohne Teilen -> die App kopiert stattdessen
    try { delete Navigator.prototype.share; } catch (e) { /* egal */ }
    // Zwischenablage braucht headless Fokus/Erlaubnis: wir schreiben mit, was kopiert würde (window.__clip)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async t => { window.__clip = String(t); } } });
    // Andere Apps öffnen (location.href = "bring://" bzw. "webcal://…" nach kurzer Pause) geht headless nicht und würde
    // unter Windows sogar echte Programme starten oder Chrome blockieren: der Sprung wird nur mitgeschrieben (window.__nav).
    // Neue Fenster (z.B. Google Kalender «Hinzufügen») öffnen headless nichts: nur mitschreiben (window.__opened)
    window.open = u => { window.__opened = String(u); return null; };
    const realSetTimeout = window.setTimeout;
    window.setTimeout = function (fn, ms, ...rest) {
      if (typeof fn === "function" && /location\.href\s*=/.test(String(fn))) return realSetTimeout(() => { window.__nav = String(fn); }, ms);
      return realSetTimeout.call(this, fn, ms, ...rest);
    };
  }, now, preset);
  const record = t => { if (!P.allow.some(re => re.test(t))) P.errors.push(t); };
  page.on("pageerror", e => record(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") record(`console: ${m.text()}`); });
  await page.setRequestInterception(true);
  page.on("request", req => handle(P, req));
  await page.goto(url || `${BASE}?os=${os}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("#days .prow").length === 7, { timeout: 8000 });
  await page.evaluate(() => document.fonts.ready);
  return P;
}

async function handle(P, req) {
  const url = req.url();
  if (url.startsWith(WORKER)) {
    if (P.offline) return req.abort("internetdisconnected");
    try {
      const init = { method: req.method(), headers: req.headers() };
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) init.body = req.postData() || "";
      const res = await worker.fetch(new Request(url, init), env);
      P.calls.push(`${req.method()} ${new URL(url).pathname}`);
      return req.respond({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    } catch (e) {
      console.log(`        (Worker-Fehler ${url}: ${e.message})`);
      return req.abort("failed");
    }
  }
  if (url.startsWith(BASE) || url.startsWith("data:")) return req.continue();
  P.blocked.push(url); // nichts darf ins Internet
  return req.abort("blockedbyclient");
}

// ---------------------------------------------------------------------------------------------
// Bausteine wie ein Mensch: tippen, schreiben, auswählen, wischen, warten
async function settle(P, h = null) {
  // Bewegung abwarten (Blatt fährt hoch, Pop-up fliegt, Woche gleitet …): am Ziel und seinen Eltern sowie an
  // Blatt/Pop-up/Menü/Fenstern. Endlos-Animationen und Symbol-Animationen anderswo zählen nicht.
  await P.page.waitForFunction(el => {
    const busy = a => a.playState === "running" && !(a.effect && a.effect.getTiming().iterations === Infinity);
    const nodes = [...document.querySelectorAll(".msheet, .mscrim, .wpop, .wscrim, .navmenu, dialog[open], #days")];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) nodes.push(n);
    return nodes.every(n => n.getAnimations().every(a => !busy(a)));
  }, { timeout: 2500, polling: 50 }, h).catch(() => {});
}

// Antippen wie mit dem Finger: Element muss sichtbar, ruhig (bewegt sich nicht mehr) und nicht verdeckt sein –
// sonst wäre es auch für einen Menschen nicht sicher tippbar.
async function tap(P, sel) {
  let h = typeof sel === "string" ? await P.page.waitForSelector(sel, { visible: true, timeout: 6000 }).catch(() => null) : sel;
  if (!h) throw new Error(`nicht sichtbar: ${sel}`);
  let hit = { cover: "?" };
  const t0 = Date.now();
  for (let attempt = 0; Date.now() - t0 < 6000; attempt++) {
    // Liste neu gezeichnet (z.B. Grundvorrat nach dem Bring!-Abgleich)? Dann das neue Element nehmen, wie ein Mensch es sieht.
    // (Ein abgehängtes Element misst 0×0 – der Punkt läge auf dem Hintergrund des Dialogs: «nicht tippbar: <dialog>».)
    if (typeof sel === "string" && !(await h.evaluate(el => el.isConnected).catch(() => false))) {
      h = await P.page.waitForSelector(sel, { visible: true, timeout: 3000 }).catch(() => null);
      if (!h) throw new Error(`nicht mehr sichtbar: ${sel}`);
    }
    await settle(P, h);
    hit = await h.evaluate(async (el, attempt) => {
      const frame = () => new Promise(r => requestAnimationFrame(() => r()));
      const box = () => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 2) / 2).join(); };
      const before = box();
      await frame(); await frame(); await frame();
      if (box() !== before) return { ok: false, cover: "bewegt sich noch" };
      const probe = () => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return { x, y, ok: !!top && (top === el || el.contains(top) || (top.tagName === "LABEL" && top.contains(el))), cover: !top ? "nichts" : top.closest(".toast") ? "toast" : top.outerHTML.slice(0, 90) };
      };
      let p = probe();
      if (!p.ok && p.cover !== "toast" && attempt > 1) { el.scrollIntoView({ block: "center", behavior: "instant" }); await frame(); p = probe(); }
      return p;
    }, attempt);
    if (hit.ok) { await P.page.touchscreen.tap(hit.x, hit.y); return; }
    // Hinweis-Leiste (Toast) liegt drüber: wegwischen wie ein Mensch
    if (hit.cover === "toast") await P.page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
    else await sleep(60);
  }
  throw new Error(`${sel} ist nicht tippbar: ${hit.cover}`);
}

// Feld antippen und Text eintippen
async function typeInto(P, sel, text) {
  await tap(P, sel);
  await P.page.$eval(sel, e => { e.value = ""; });
  await P.page.keyboard.type(text, { delay: 5 });
}

// Auswahlliste: das native Auswahlrad lässt sich headless nicht bedienen; page.select wählt die Option
// und löst dieselben input/change-Ereignisse aus wie ein Mensch.
async function choose(P, sel, value) {
  await P.page.waitForSelector(sel, { timeout: 5000 });
  const r = await P.page.select(sel, value);
  expect(r.includes(value), `Option ${value} fehlt in ${sel}`);
}

// Nativer Farb-/Zeitwähler: headless nicht bedienbar -> Wert setzen und «change» auslösen wie nach dem Wählen
async function pickNative(P, sel, value) {
  await P.page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, value);
}

async function until(P, fn, msg, arg, timeout = 6000) {
  try { await P.page.waitForFunction(fn, { timeout, polling: 50 }, arg); }
  catch (e) { throw new Error(`${msg}${e.message && !/Waiting failed|timeout/i.test(e.message) ? " – " + e.message : ""}`); }
}
const text = (P, sel) => P.page.$eval(sel, e => e.textContent.trim());
const count = (P, sel) => P.page.$$eval(sel, l => l.length);
const isOpen = (P, id) => P.page.$eval(`#${id}`, d => d.open);
const clip = P => P.page.evaluate(() => window.__clip || "");
const clearToasts = P => P.page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
async function toastIs(P, re, timeout = 6000) {
  await until(P, ([src, fl]) => [...document.querySelectorAll(".toast")].some(t => new RegExp(src, fl).test(t.textContent)), `Hinweis ${re} erscheint nicht`, [re.source, re.flags], timeout);
  return P.page.evaluate(() => [...document.querySelectorAll(".toast")].map(t => t.textContent).join(" | "));
}
const dayTitle = (P, i) => text(P, `.prow[data-i="${i}"] .t`);
const dayNum = async (P, i) => +(await text(P, `.prow[data-i="${i}"] .num`));
const titles = P => P.page.$$eval("#days .prow .t", l => l.map(e => e.textContent));
const ctaCount = async P => parseInt((await text(P, "#ctaCount")).replace(/\D/g, "") || "0", 10);
const ls = (P, k) => P.page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return localStorage.getItem(k); } }, k);
async function shot(P, name) { if (SHOTS) { await settle(P); await P.page.screenshot({ path: path.join(shotDir, `${P.name}-${name}.png`) }); } }

// Bottom-Navigation: Plan, Einkauf, Rezepte & Saison, Einstellungen (jede direkt als Seite, kein Pop-up)
async function goTab(P, tab) {
  await tap(P, `.bnav [data-tab="${tab}"]`);
  await until(P, t => !document.getElementById(`tab-${t}`).hidden && [...document.querySelectorAll(".tab")].filter(s => !s.hidden).length === 1, `Tab ${tab} erscheint nicht`, tab);
}
async function noHScroll(P, tag) {
  const w = await P.page.evaluate(() => ({ doc: document.documentElement.scrollWidth, main: document.getElementById("scroller").scrollWidth, mainW: document.getElementById("scroller").clientWidth, vw: innerWidth }));
  expect(w.doc <= w.vw + 1 && w.main <= w.mainW + 1, `${tag}: seitliches Scrollen (${w.doc}/${w.main} > ${w.vw})`);
}
async function dialogNoHScroll(P, id) {
  const r = await P.page.$eval(`#${id}`, d => ({ sw: d.scrollWidth, cw: d.clientWidth, right: d.getBoundingClientRect().right, vw: innerWidth }));
  expect(r.sw <= r.cw + 1 && r.right <= r.vw + 1, `${id}: breiter als der Bildschirm`);
}
// Wischen (Finger): seitlich über die Tage = Woche wechseln, von oben nach unten = synchronisieren
async function swipe(P, x1, y1, x2, y2) {
  const t = P.page.touchscreen;
  await t.touchStart(x1, y1);
  for (let k = 1; k <= 10; k++) { await t.touchMove(x1 + (x2 - x1) * k / 10, y1 + (y2 - y1) * k / 10); await sleep(12); }
  // Finger am Ende kurz ruhig halten, dann heben: sonst «wirft» Chrome die Seite weiter (Fling), und das nächste
  // Tippen stoppt nur diese Bewegung statt zu klicken – genau wie auf einem echten Handy.
  await sleep(120);
  await t.touchMove(x2, y2);
  await sleep(120);
  await t.touchEnd();
  await sleep(300);
}
async function pullDown(P) { await settle(P); await swipe(P, 195, 180, 195, 360); }
async function closeDialog(P, id) {
  await tap(P, `#${id} [data-close]`);
  await until(P, id => !document.getElementById(id).open, `${id} geht nicht zu`, id);
}
async function background(P) {
  return P.page.evaluate(() => {
    const c = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).map(Number);
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  });
}
async function waitPushed(P) { await sleep(1800); } // Plan/Vorrat werden nach 0.8–1.5 s an den WG-Server geschickt

// ---------------------------------------------------------------------------------------------
// Ablauf A: iPhone, hell, Dienstag, zuerst ohne WG-Server
// ---------------------------------------------------------------------------------------------
const A = await phone({ name: "A-iphone-hell", os: "ios", scheme: "light", now: "2026-11-10T12:00:00" });

await step(A, "Start: Wochenwahl-Pop-up für KW 46, roter Punkt, iPhone-Stil, hell", async () => {
  await until(A, () => !document.getElementById("wpop").hidden && document.getElementById("wpop").classList.contains("show"), "Pop-up fehlt");
  expect((await text(A, "#wpopText")).includes("KW 46"), "Pop-up nennt nicht KW 46");
  expect(await A.page.$eval("#openVoteBtn", b => b.classList.contains("due")), "roter Punkt fehlt");
  expect(await A.page.$eval("html", h => h.classList.contains("glass")), "nicht im iPhone-Stil");
  expect((await background(A)) > 0.7, "Hintergrund nicht hell");
  await shot(A, "01-start-popup");
});

await step(A, "Pop-up «Später»: fliegt weg, roter Punkt bleibt", async () => {
  await tap(A, "#wlater");
  await until(A, () => document.getElementById("wpop").hidden, "Pop-up bleibt");
  expect(await A.page.$eval("#openVoteBtn", b => b.classList.contains("due")), "roter Punkt weg");
  expect(await text(A, "#weekLabel") === "KW 46 · November", `Kopfzeile: ${await text(A, "#weekLabel")}`);
  expect(await A.page.$eval("#weekChip", c => c.hidden), "Wochen-Chip am Dienstag sichtbar");
  await shot(A, "02-plan");
});

await step(A, "Plan: jeden Tag auf- und zuklappen, alle 7 Tage bleiben sichtbar", async () => {
  for (let i = 0; i < 7; i++) {
    await tap(A, `.prow[data-i="${i}"] .pday`);
    await until(A, i => document.querySelector(`.prow[data-i="${i}"]`).classList.contains("open") && document.querySelectorAll(".prow.open").length === 1, `Tag ${i} geht nicht auf`, i);
    await settle(A);
    const r = await A.page.evaluate(i => {
      const nav = document.querySelector(".bnav").getBoundingClientRect().top;
      const last = document.querySelector('.prow[data-i="6"]').getBoundingClientRect().bottom;
      const ing = document.querySelector(`.prow[data-i="${i}"] .ing`);
      return { fits: last <= nav + 0.5, ing: ing.getBoundingClientRect().height > 0 && ing.children.length > 0 };
    }, i);
    expect(r.fits && r.ing, `Tag ${i}: Zutaten sichtbar=${r.ing}, alle Tage sichtbar=${r.fits}`);
    if (i === 2) await shot(A, "03-tag-offen");
    await tap(A, `.prow[data-i="${i}"] .pday`);
    await until(A, i => !document.querySelector(`.prow[data-i="${i}"]`).classList.contains("open"), `Tag ${i} geht nicht zu`, i);
  }
});

await step(A, "Plan: Esser pro Person an- und abwählen (Portionen zählen mit, niemand = 0)", async () => {
  const start = await dayNum(A, 0);
  const members = await A.page.$$eval('.prow[data-i="0"] .av', l => l.map(b => b.dataset.member));
  expect(members.join() === "joshua,lukas,leonie,jo", `Personen: ${members}`);
  for (let k = 0; k < members.length; k++) {
    await tap(A, `.prow[data-i="0"] .av[data-member="${members[k]}"]`);
    await until(A, ([m, n]) => document.querySelector(`.prow[data-i="0"] .av[data-member="${m}"]`).classList.contains("off") && +document.querySelector('.prow[data-i="0"] .num').textContent === n,
      `${members[k]} abwählen: Portionen stimmen nicht`, [members[k], k === members.length - 1 ? 0 : start - k - 1]);
  }
  for (const m of members) await tap(A, `.prow[data-i="0"] .av[data-member="${m}"]`);
  await until(A, n => +document.querySelector('.prow[data-i="0"] .num').textContent === n && !document.querySelector('.prow[data-i="0"] .av.off'), "alle wieder an: Portionen falsch", start);
});

await step(A, "Plan: Reste-Puffer per Auswahl (+5) und per Antippen der Zahl (+6, dann +0)", async () => {
  const eaters = 4;
  await choose(A, '.prow[data-i="1"] select.buf', "5");
  await until(A, n => +document.querySelector('.prow[data-i="1"] .num').textContent === n, "Auswahl +5 wirkt nicht", eaters + 5);
  expect((await text(A, '.prow[data-i="1"] .plus')) === "+5", "Anzeige +5 fehlt");
  await tap(A, '.prow[data-i="1"] .num');
  await until(A, n => +document.querySelector('.prow[data-i="1"] .num').textContent === n, "Antippen: +6 fehlt", eaters + 6);
  await tap(A, '.prow[data-i="1"] .num');
  await until(A, n => +document.querySelector('.prow[data-i="1"] .num').textContent === n, "Antippen nach +6: zurück auf +0 fehlt", eaters);
  await choose(A, '.prow[data-i="1"] select.buf', "2");
  await until(A, n => +document.querySelector('.prow[data-i="1"] .num').textContent === n, "zurück auf +2", eaters + 2);
});

let pickedTitle = "";
await step(A, "Menü wechseln: Blatt öffnen, suchen, Gericht wählen, «Rückgängig»", async () => {
  const before = await dayTitle(A, 2);
  await tap(A, '.prow[data-i="2"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  expect((await text(A, "#msheetTitle")).startsWith("Mi: Menü wechseln"), "Titel des Blatts");
  expect((await A.page.$$eval("#mlist .msec", l => l.map(e => e.textContent))).includes("Weitere"), "Abschnitt «Weitere» fehlt");
  await shot(A, "04-menu-blatt");
  const target = await A.page.$eval("#mlist .opt[data-id]:nth-of-type(3) .n", e => e.textContent);
  const word = target.split(/\s+/).find(w => w.length >= 4) || target;
  await typeInto(A, "#msearch", word);
  await until(A, w => [...document.querySelectorAll("#mlist .opt[data-id] .n")].every(n => n.textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) && document.querySelector("#mlist [data-new]"), `Suche «${word}» filtert nicht`, word);
  const opt = await A.page.evaluateHandle(t => [...document.querySelectorAll("#mlist .opt[data-id]")].find(o => o.querySelector(".n").textContent === t), target);
  await tap(A, opt);
  await until(A, ([t]) => document.querySelector('.prow[data-i="2"] .t').textContent === t && !document.getElementById("msheet").classList.contains("show"), "Gericht nicht übernommen", [target]);
  await toastIs(A, new RegExp(`^Mi: `));
  await tap(A, ".toast button");
  await until(A, t => document.querySelector('.prow[data-i="2"] .t').textContent === t, "«Rückgängig» stellt nicht wieder her", before);
  // nochmals wählen und behalten
  await tap(A, '.prow[data-i="2"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  const first = await A.page.$eval("#mlist .opt[data-id] .n", e => e.textContent);
  await tap(A, "#mlist .opt[data-id]");
  await until(A, t => document.querySelector('.prow[data-i="2"] .t').textContent === t, "Gericht nicht übernommen", first);
  pickedTitle = first;
});

await step(A, "Menü-Blatt schliessen: mit ✕ und durch Tippen daneben", async () => {
  await tap(A, '.prow[data-i="3"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  await tap(A, "#msheetClose");
  await until(A, () => !document.getElementById("msheet").classList.contains("show"), "✕ schliesst nicht");
  await tap(A, '.prow[data-i="3"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  await settle(A);
  await A.page.touchscreen.tap(195, 40); // oben neben das Blatt
  await until(A, () => !document.getElementById("msheet").classList.contains("show"), "Tippen daneben schliesst nicht");
});

await step(A, "Eigenes Menü eintippen («… eintragen»)", async () => {
  await tap(A, '.prow[data-i="3"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  await typeInto(A, "#msearch", "Omas Testsuppe");
  await until(A, () => document.querySelector("#mlist [data-new]"), "«eintragen» fehlt");
  await tap(A, "#mlist [data-new]");
  await until(A, () => document.querySelector('.prow[data-i="3"] .t').textContent === "Omas Testsuppe", "eigenes Menü nicht im Plan");
});

let allCount = 0;
await step(A, "Rezept-Katalog: über das Blatt öffnen, Filter Alle/Vegi/Fleisch/Saison/Eigene, Suche", async () => {
  await tap(A, '.prow[data-i="4"] .t');
  await until(A, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  await tap(A, "#mlist [data-catalog]");
  await until(A, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  expect((await text(A, "#catalogSubtitle")) === "für Freitag · 4 Esser", `Untertitel: ${await text(A, "#catalogSubtitle")}`);
  allCount = await count(A, "#catalogList .recipe");
  const counts = {};
  for (const f of ["vegi", "fleisch", "season", "custom", "all"]) {
    await tap(A, `#catalogFilters [data-filter="${f}"]`);
    await until(A, f => document.querySelector(`#catalogFilters [data-filter="${f}"]`).getAttribute("aria-pressed") === "true", `Filter ${f} nicht aktiv`, f);
    counts[f] = await count(A, "#catalogList .recipe");
  }
  expect(counts.vegi > 0 && counts.vegi < allCount && counts.fleisch > 0 && counts.fleisch < allCount && counts.season > 0 && counts.season <= allCount && counts.all === allCount, `Filter-Zahlen ${JSON.stringify(counts)} / ${allCount}`);
  await tap(A, '#catalogFilters [data-filter="custom"]');
  await until(A, () => [...document.querySelectorAll("#catalogList .recipe b")].map(b => b.textContent).join() === "Omas Testsuppe", "Filter Eigene zeigt nicht nur das eigene Menü");
  await tap(A, '#catalogFilters [data-filter="all"]');
  await typeInto(A, "#catalogSearch", "kartoffel");
  await until(A, n => { const k = document.querySelectorAll("#catalogList .recipe").length; return k > 0 && k < n; }, "Suche «kartoffel» filtert nicht", allCount);
  await shot(A, "05-katalog");
  await dialogNoHScroll(A, "catalogDialog");
});

await step(A, "Rezept-Katalog: Gericht einplanen, «Zufällig», mit ✕ schliessen", async () => {
  const t = await A.page.$eval("#catalogList .recipe b", b => b.textContent);
  await tap(A, "#catalogList [data-assign]");
  await until(A, t => !document.getElementById("catalogDialog").open && document.querySelector('.prow[data-i="4"] .t').textContent === t, "Einplanen klappt nicht", t);
  await toastIs(A, /^Freitag: /);
  await tap(A, '.prow[data-i="4"] .t');
  await tap(A, "#mlist [data-catalog]");
  await until(A, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await clearToasts(A);
  await tap(A, "#randomPickBtn");
  await until(A, t => !document.getElementById("catalogDialog").open && document.querySelector('.prow[data-i="4"] .t').textContent !== t, "Zufällig klappt nicht", t);
  await toastIs(A, /^Freitag: /);
  await tap(A, '.prow[data-i="4"] .t');
  await tap(A, "#mlist [data-catalog]");
  await until(A, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await closeDialog(A, "catalogDialog");
});

await step(A, "Eigenes Rezept von Hand: Titel aus Link, Formular, Speichern & einplanen, Mengen umgerechnet", async () => {
  await tap(A, '.prow[data-i="5"] .t');
  await tap(A, "#mlist [data-catalog]");
  await until(A, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(A, "#newRecipeBtn");
  await until(A, () => document.getElementById("recipeDialog").open && !document.getElementById("catalogDialog").open, "Rezept-Formular geht nicht auf");
  // ohne WG-Server: Titel wird aus dem Link abgeleitet
  await typeInto(A, "#recipeUrl", "https://www.bettybossi.ch/de/rezepte/rezept/lauch-gratin");
  await tap(A, "#recipeServings"); // Feld verlassen -> «change»
  await until(A, () => document.getElementById("recipeTitle").value === "Lauch Gratin", "Titel aus Link fehlt");
  await typeInto(A, "#recipeTitle", "Testgratin");
  await choose(A, "#recipeDiet", "fleisch");
  await typeInto(A, "#recipeServings", "3");
  await typeInto(A, "#recipeIngredients", "300 g Lauch\n2 dl Halbrahm");
  await shot(A, "06-eigenes-rezept");
  await dialogNoHScroll(A, "recipeDialog");
  await tap(A, '#recipeForm button[type="submit"]');
  await until(A, () => !document.getElementById("recipeDialog").open && document.querySelector('.prow[data-i="5"] .t').textContent === "Testgratin", "eigenes Rezept nicht im Plan");
  expect((await text(A, '.prow[data-i="5"] .meta')) === "Fleisch · 30 Min.", `Meta: ${await text(A, '.prow[data-i="5"] .meta')}`);
  await tap(A, '.prow[data-i="5"] .pday');
  // 6 Portionen (4 + 2 Reste) aus einem Rezept für 3: 300 g -> 600 g
  await until(A, () => [...document.querySelectorAll('.prow[data-i="5"] .ing li')].map(l => l.textContent).join("|") === "600 g Lauch|4 dl Halbrahm", "Zutaten nicht auf 6 Portionen umgerechnet");
  await tap(A, '.prow[data-i="5"] .pday');
});

await step(A, "Eigenes Rezept löschen (Katalog → Eigene → Löschen → Wirklich?)", async () => {
  await tap(A, '.prow[data-i="6"] .t');
  await tap(A, "#mlist [data-catalog]");
  await until(A, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(A, '#catalogFilters [data-filter="custom"]');
  await until(A, () => document.querySelectorAll("#catalogList .recipe").length === 2, "zwei eigene Rezepte erwartet");
  const del = await A.page.evaluateHandle(() => [...document.querySelectorAll("#catalogList .recipe")].find(r => r.querySelector("b").textContent === "Omas Testsuppe").querySelector("[data-delete]"));
  await tap(A, del);
  await until(A, () => [...document.querySelectorAll("#catalogList [data-delete]")].some(b => b.textContent === "Wirklich?"), "Nachfrage «Wirklich?» fehlt");
  await tap(A, del);
  await toastIs(A, /Rezept gelöscht/);
  await until(A, () => [...document.querySelectorAll("#catalogList .recipe b")].map(b => b.textContent).join() === "Testgratin", "Rezept nicht gelöscht");
  await tap(A, '#catalogFilters [data-filter="all"]');
  await closeDialog(A, "catalogDialog");
});

await step(A, "Bring! ohne WG-Server: Chip zählt, Übergabe mit Teilen (→ Kopieren), Nur kopieren, Kopieren & Bring! öffnen", async () => {
  const n = await ctaCount(A);
  expect(n > 0 && /Artikel/.test(await text(A, "#ctaCount")), `Chip: ${await text(A, "#ctaCount")}`);
  await tap(A, "#syncBtn");
  await until(A, () => document.getElementById("handoffDialog").open, "Übergabe geht nicht auf");
  const preview = await text(A, "#handoffPreview");
  expect(preview.split("\n").length >= n, `Vorschau hat ${preview.split("\n").length} Zeilen, Chip ${n}`);
  await shot(A, "07-uebergabe");
  await dialogNoHScroll(A, "handoffDialog");
  await tap(A, "#shareListBtn"); // ohne Teilen-Blatt (headless): App kopiert
  await toastIs(A, /^Liste kopiert$/);
  expect((await clip(A)) === preview, "kopierter Text ≠ Vorschau");
  await clearToasts(A);
  await tap(A, "#copyOnlyBtn");
  await toastIs(A, /Artikel kopiert$/);
  // bring:// kann headless nicht geöffnet werden – geprüft: Hinweis + der Sprung zur Bring!-App wurde ausgelöst
  await clearToasts(A);
  await tap(A, "#copyOpenBringBtn");
  await toastIs(A, /Kopiert – Bring! wird geöffnet/);
  await until(A, () => /bring:\/\//.test(window.__nav || ""), "Bring!-App wird nicht geöffnet");
  expect(A.page.url().startsWith(BASE), "Seite ist weggesprungen");
  await closeDialog(A, "handoffDialog");
});

await step(A, "Einkauf: Abschnitte Kaufen/Auf Bring!/Vorrat, Liste kopieren", async () => {
  await goTab(A, "shop");
  await noHScroll(A, "Einkauf");
  // Kaufen = Zeilen aus dem Plan + knapper Vorrat; Vorrat = Zeilen der drei Listen (ohne «Alles da»)
  const rowsOf = { toBuy: "#shopList [data-shop], #shopList [data-vitem]", onBring: "#shopList [data-shop]", staples: "#shopList .vsec [data-vleer]" };
  for (const f of ["onBring", "staples", "toBuy"]) {
    await tap(A, `#tab-shop .seg [data-filter="${f}"]`);
    await until(A, f => document.querySelector(`#tab-shop .seg [data-filter="${f}"]`).getAttribute("aria-pressed") === "true", `Abschnitt ${f} nicht aktiv`, f);
    const rows = await count(A, rowsOf[f]);
    const n = +(await text(A, `#cnt${f[0].toUpperCase()}${f.slice(1)}`));
    expect(rows === n, `${f}: ${rows} Zeilen, Zähler ${n}`);
  }
  await shot(A, "08-einkauf");
  await tap(A, "#copyListBtn");
  const t = await toastIs(A, /Artikel kopiert/);
  expect((await clip(A)).split("\n").length === parseInt(t, 10), "kopierte Zeilen ≠ Anzahl");
});

await step(A, "Einkauf ohne WG-Server: Zeile antippen = Hinweis", async () => {
  await tap(A, '#tab-shop .seg [data-filter="toBuy"]');
  await clearToasts(A);
  const rowName = await A.page.$eval("#shopList [data-shop]", b => b.dataset.shop);
  await tap(A, `#shopList [data-shop="${rowName}"]`);
  await toastIs(A, /Ohne WG-Server/);
});

let leerIdx = "", leerName = "";
await step(A, "Einkauf «Vorrat»: Zeile antippen = leer (nichts geht auf Bring!), steht unter «Kaufen» als knapp, Leiste «Für Bring!»", async () => {
  await tap(A, '#tab-shop .seg [data-filter="staples"]');
  await until(A, () => document.getElementById("cookSw") && document.getElementById("vorratTray").hidden, "Vorrat-Liste fehlt / Leiste schon da");
  await tap(A, "#vAll summary");
  await until(A, () => document.getElementById("vAll").open, "«Alles da» geht nicht auf");
  leerIdx = await A.page.$eval("#vAll [data-vleer]", b => b.dataset.vleer);
  leerName = await A.page.$eval(`#vAll [data-vleer="${leerIdx}"] .l`, e => e.textContent.trim());
  await clearToasts(A);
  await tap(A, `#vAll [data-vleer="${leerIdx}"]`);
  await toastIs(A, /leer – kommt mit «Prüfen» auf Bring!/);
  await until(A, i => { const r = document.querySelector(`#shopList .vsec [data-vleer="${i}"]`); return r && r.getAttribute("aria-pressed") === "true" && r.classList.contains("zero"); }, "Zeile nicht leer / nicht unter «Sonst knapp»", leerIdx);
  await until(A, n => !document.getElementById("vorratTray").hidden && document.getElementById("vorratTray").textContent.includes(n), "Leiste «Für Bring!» fehlt", leerName);
  expect((await ls(A, "bringfrisch_user_staples"))[+leerIdx].in_stock === false, "leer nicht gespeichert");
  await tap(A, '#tab-shop .seg [data-filter="toBuy"]');
  await until(A, i => document.querySelector(`#shopList [data-vitem="${i}"]`), "knapper Vorrat nicht unter «Kaufen»", leerIdx);
  // Antippen = Blatt zum Artikel
  await tap(A, `#shopList [data-vitem="${leerIdx}"]`);
  await until(A, n => document.getElementById("stapleItemDialog").open && document.getElementById("vTitle").textContent === n, "Blatt zum Artikel geht nicht auf", leerName);
  await closeDialog(A, "stapleItemDialog");
  await shot(A, "08b-einkauf-knapp");
});

await step(A, "Schalter «Woche gekocht»: bucht ab, was der Plan braucht; zurück = rückgängig", async () => {
  await tap(A, '#tab-shop .seg [data-filter="staples"]');
  const used = await count(A, "#shopList .vsec.woche [data-vleer]");
  expect(used > 0, "der Plan braucht nichts aus dem Vorrat");
  const qtys = () => A.page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("bringfrisch_user_staples")).map(window.BF_CORE.vQty)));
  const before = await qtys();
  await clearToasts(A);
  await tap(A, "#cookSw");
  await toastIs(A, /Woche gekocht: \d+ Artikel abgebucht/);
  await until(A, () => document.getElementById("cookSw").getAttribute("aria-checked") === "true" && /abgebucht/.test(document.querySelector(".vsec.woche h3").textContent), "Schalter nicht an");
  expect((await ls(A, "bringfrisch_user_staples")).some(s => s.booked), "nichts abgebucht");
  await clearToasts(A);
  await tap(A, "#cookSw");
  await toastIs(A, /Abbuchen rückgängig gemacht/);
  await until(A, () => document.getElementById("cookSw").getAttribute("aria-checked") === "false", "Schalter nicht aus");
  const after = await ls(A, "bringfrisch_user_staples");
  expect((await qtys()) === before && !after.some(s => s.booked), "Rückgängig stellt die Mengen nicht her");
});

await step(A, "«Prüfen»: Gegenüberstellung Kaufen | Vorrat, antippen = wählen, ohne WG-Server = kopieren; Zeile nochmals = wieder da", async () => {
  await tap(A, "#trayCheckBtn");
  await until(A, () => document.getElementById("compareDialog").open, "Gegenüberstellung geht nicht auf");
  const key = `v:${leerIdx}`;
  expect(await A.page.$eval(`[data-cmp="${key}"]`, b => b.getAttribute("aria-pressed") === "true"), "knapper Vorrat nicht vorausgewählt");
  expect((await count(A, '#compareCols [data-cmp^="p:"]')) > 3, "links fehlt «Kaufen» aus dem Plan");
  await shot(A, "08c-gegenueberstellung");
  await dialogNoHScroll(A, "compareDialog");
  const n0 = parseInt(await text(A, "#compareSendBtn"), 10);
  await tap(A, `[data-cmp="${key}"]`);
  await until(A, n => parseInt(document.getElementById("compareSendBtn").textContent, 10) === n - 1, "Abwählen zählt nicht", n0);
  await tap(A, `[data-cmp="${key}"]`);
  await clearToasts(A);
  await tap(A, "#compareSendBtn");
  await toastIs(A, /Artikel kopiert – in Bring! einfügen/);
  expect((await clip(A)).includes(leerName) && (await clip(A)).split("\n").length === n0, "kopierte Liste falsch");
  await until(A, () => !document.getElementById("compareDialog").open, "Gegenüberstellung bleibt offen");
  await tap(A, '#tab-shop .seg [data-filter="staples"]');
  await tap(A, `#shopList .vsec [data-vleer="${leerIdx}"]`);
  await until(A, () => document.getElementById("vorratTray").hidden, "nach «wieder da» noch knapp");
});

await step(A, "Grundvorrat (ohne Server): Kacheln, Blatt (Menge, Leer…Voll, Einheit), lange drücken = − + und ✕ mit Rückgängig, Dringend, hinzufügen mit Vorschlag, Inventur", async () => {
  await tap(A, "#openStaplesBtn");
  await until(A, () => document.getElementById("staplesDialog").open && document.querySelectorAll("#staplesList .qt[data-staple]").length > 5, "Grundvorrat geht nicht auf");
  expect((await text(A, "#staplesHint")).startsWith("Antippen = alles zum Artikel"), "Hinweis falsch");
  expect(/Artikel · \d+ knapp/.test(await text(A, "#stapleSum")), "Übersicht in einer Zeile fehlt");
  const idx = await A.page.$eval("#staplesList .qt[data-staple]:not(.zero):not(.low)", b => b.dataset.staple);
  const sel = `#staplesList [data-staple="${idx}"]`;
  // Blatt
  await tap(A, sel);
  await until(A, () => document.getElementById("stapleItemDialog").open, "Blatt geht nicht auf");
  await tap(A, '#vBody [data-v="set"][data-n="1"]');
  await until(A, i => JSON.parse(localStorage.getItem("bringfrisch_user_staples"))[i].qty === 1, "«Fast leer» setzt nicht 1", +idx);
  await tap(A, '#vBody [data-v="q+"]');
  await until(A, i => JSON.parse(localStorage.getItem("bringfrisch_user_staples"))[i].qty === 2, "+ zählt nicht", +idx);
  await tap(A, '#vBody [data-v="unit"][data-u="Stk"]');
  await until(A, () => document.getElementById("vSize"), "«1 Stück =» fehlt bei Stück");
  await tap(A, '#vBody [data-v="unit"][data-u="Znacht"]');
  await tap(A, '#vBody [data-v="set"]:last-child');
  await until(A, i => JSON.parse(localStorage.getItem("bringfrisch_user_staples"))[i].in_stock === true, "«Voll» nicht gespeichert", +idx);
  await shot(A, "09a-grundvorrat-blatt");
  await dialogNoHScroll(A, "stapleItemDialog");
  await closeDialog(A, "stapleItemDialog");
  // Lange drücken: Karte dreht sich (− + und ✕)
  const n0 = await count(A, "#staplesList .qt[data-staple]");
  const box = await (await A.page.$(sel)).boundingBox();
  await A.page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(750);
  await A.page.touchscreen.touchEnd();
  await until(A, i => document.querySelector(`#staplesList .qt.back[data-back="${i}"]`), "Karte dreht sich nicht", idx);
  const q0 = +(await text(A, "#staplesList .qt.back output"));
  await tap(A, '#staplesList .qt.back [data-step="1"]');
  await until(A, q => +document.querySelector("#staplesList .qt.back output").textContent === q + 1, "+ auf der Karte zählt nicht", q0);
  await shot(A, "09b-grundvorrat-karte");
  await clearToasts(A);
  await tap(A, "#staplesList .qt.back .xs");
  await toastIs(A, /weggenommen/);
  await until(A, n => document.querySelectorAll("#staplesList .qt[data-staple]").length === n - 1, "✕ nimmt nicht weg", n0);
  await tap(A, ".toast button");
  await until(A, n => document.querySelectorAll("#staplesList .qt[data-staple]").length === n, "Rückgängig bringt den Artikel nicht zurück", n0);
  // Aufteilung Dringend
  await tap(A, '#staplesDialog [data-grp="dringend"]');
  await until(A, () => /Knapp/.test(document.querySelector("#staplesList .bsec h3").textContent), "Aufteilung «Dringend» fehlt");
  await tap(A, '#staplesDialog [data-grp="abteilung"]');
  // Hinzufügen: Vorschlag aus Bring!, schon da wird erkannt; Unbekanntes als eigener Artikel
  await typeInto(A, "#newStaple", "Olivenoel");
  await until(A, () => /Olivenöl/.test(document.getElementById("stapleSugg").textContent) && /ist schon da/.test(document.getElementById("stapleSugg").textContent), "Vorschlag «Olivenöl – ist schon da» fehlt");
  await typeInto(A, "#newStaple", "Testsenf");
  await until(A, () => /Eigener Artikel/.test(document.getElementById("stapleSugg").textContent), "eigener Artikel wird nicht angeboten");
  await tap(A, '#addStapleForm button[type="submit"]');
  await until(A, () => document.querySelector('#staplesList .qt[title="Testsenf"]'), "eigener Artikel fehlt");
  // Inventur
  await tap(A, "#invBtn");
  await until(A, () => document.getElementById("invDialog").open && /Inventur · 1 von/.test(document.getElementById("invTitle").textContent), "Inventur geht nicht auf");
  await tap(A, "#invSkip");
  await until(A, () => /Inventur · 2 von/.test(document.getElementById("invTitle").textContent), "«Stimmt so» geht nicht weiter");
  await tap(A, '#invBody [data-inv]:last-child');
  await until(A, () => /Inventur · 3 von/.test(document.getElementById("invTitle").textContent), "Inventur-Knopf geht nicht weiter");
  await closeDialog(A, "invDialog");
  await until(A, () => /Letzte:/.test(document.getElementById("invCard").textContent), "Inventur nicht vermerkt");
  await shot(A, "09-grundvorrat");
  await dialogNoHScroll(A, "staplesDialog");
  await closeDialog(A, "staplesDialog");
});

await step(A, "Rezepte & Saison: Monat wechseln zeigt andere Saison", async () => {
  await goTab(A, "season");
  await noHScroll(A, "Saison");
  expect(await A.page.$eval("#monthSelect", s => s.value) === "11", "nicht November");
  const nov = await text(A, "#fieldGrid");
  const head = await text(A, "#newsHeadline");
  await choose(A, "#monthSelect", "6");
  await until(A, ([n, h]) => document.getElementById("fieldGrid").textContent.trim() !== n && document.getElementById("newsHeadline").textContent.trim() !== h, "Juni zeigt dasselbe", [nov, head]);
  await shot(A, "10-saison-juni");
  await choose(A, "#monthSelect", "11");
});

await step(A, "Saison: Bilder, Hochdeutsch; Gemüse antippen = «… Rezept» kopiert, ergänzen, Suchen-Link", async () => {
  await goTab(A, "season");
  const names = await A.page.$$eval("#fieldGrid .veg b", l => l.map(b => b.textContent));
  expect(names.length > 5 && names.every(n => !/^Schweizer /.test(n)), `«Schweizer» noch im Namen: ${names.join(", ")}`);
  expect(names.includes("Feldsalat") && !names.some(n => /Nüsslisalat|Rüebli|Randen|Kabis/.test(n)), `Schweizer Begriffe: ${names.join(", ")}`);
  expect(await A.page.$$eval("#fieldGrid .veg .vemoji", l => l.every(e => e.textContent.trim().length > 0)), "Bild (Emoji) fehlt");
  await A.page.evaluate(() => { const b = [...document.querySelectorAll("#fieldGrid .veg")].find(x => x.dataset.veg === "Spinat"); b.id = "vegSpinat"; });
  await clearToasts(A);
  await tap(A, "#vegSpinat");
  await toastIs(A, /Spinat Rezept.*kopiert/);
  expect((await clip(A)) === "Spinat Rezept", `kopiert: «${await clip(A)}»`);
  expect((await A.page.$eval("#recipeSearchQ", e => e.value)) === "Spinat Rezept ", "Suchfeld nicht gefüllt");
  await A.page.keyboard.type("Risotto");
  await until(A, () => document.getElementById("recipeSearchGo").href.endsWith("q=Spinat%20Rezept%20Risotto"), "Suchen-Link nicht ergänzt");
  expect(await A.page.$eval("#recipeSearchGo", a => a.target === "_blank"), "Suche öffnet nicht in neuem Tab");
  await noHScroll(A, "Saison mit Suche");
  await shot(A, "10-saison-suche");
});

await step(A, "Einstellungen: Über BringFrisch (Version, GitHub, Impressum)", async () => {
  await goTab(A, "wg");
  expect(/^\d+\.\d+\.\d+$/.test(await text(A, "#appVersionTop")), "Version fehlt");
  expect((await A.page.$eval("#repoLink", a => a.href)) === "https://github.com/jodbaer/BringFresch" && /Impressum/.test(await text(A, "#tab-wg")), "GitHub-Link/Impressum fehlt");
});

await step(A, "Über BringFrisch: Version + «Aktualisieren» in einer Zeile, gleicht ab und prüft die Version; Statusleiste im Design", async () => {
  await goTab(A, "wg");
  const top = await A.page.evaluate(() => { const c = document.getElementById("versionCard"); return { inAbout: !!c.closest(".card") && c.closest(".card").previousElementSibling.textContent.includes("Über BringFrisch"), btn: !!c.querySelector("#updateBtn"), v: document.getElementById("appVersionTop").textContent, repo: document.getElementById("repoLinkTop").href }; });
  expect(top.inAbout && top.btn && /^\d+\.\d+\.\d+$/.test(top.v) && top.repo === "https://bringfrisch-test.bringfrisch-worker.workers.dev/", `Version/Aktualisieren nicht unter «Über»: ${JSON.stringify(top)}`);
  await clearToasts(A);
  await tap(A, "#updateBtn");
  await toastIs(A, /Alles aktuell|Neueste Version/);
  expect(/Neueste Version ✓/.test(await text(A, "#updateState")), "Status nach Aktualisieren fehlt");
  const tc = await A.page.evaluate(() => ({ meta: document.getElementById("themeColor").getAttribute("content"), bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(), sb: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content }));
  expect(tc.meta && tc.meta === tc.bg && tc.sb === "default", `Statusleiste nicht im Design: ${JSON.stringify(tc)}`);
});

await step(A, "Einstellungen über ⋮: nicht verbunden, «Mehr» offen", async () => {
  await goTab(A, "wg");
  await noHScroll(A, "Einstellungen");
  expect((await text(A, "#syncStatus")).startsWith("Nicht verbunden"), "Status");
  expect(await A.page.$eval("#setMore", d => d.open), "«Mehr» zu");
  expect(await A.page.$eval("#bringListField", d => d.hidden), "Listenauswahl ohne Server sichtbar");
  await shot(A, "11-einstellungen");
});

await step(A, "Mitbewohner: hinzufügen (Vegi), Ernährung ändern (Vegan), entfernen", async () => {
  await typeInto(A, "#newMemberName", "Mia");
  await choose(A, "#newMemberDiet", "vegi");
  await tap(A, '#addMemberForm button[type="submit"]');
  await until(A, () => document.querySelectorAll("#members .member").length === 5 && document.querySelectorAll('.prow[data-i="0"] .av').length === 5, "Mia fehlt im Plan");
  expect(await A.page.$eval('.prow[data-i="0"] .who', w => w.classList.contains("many")), "5 Personen: kompakte Kreise fehlen");
  await choose(A, "#members .member:last-child select", "vegan");
  await until(A, () => (JSON.parse(localStorage.getItem("bringfrisch_members")).find(m => m.name === "Mia") || {}).diet === "vegan", "Ernährung nicht gespeichert");
  await tap(A, "#members .member:last-child [data-remove]");
  await until(A, () => document.querySelector("#members .member:last-child [data-remove]").textContent === "Entfernen?", "Nachfrage fehlt");
  await tap(A, "#members .member:last-child [data-remove]");
  await until(A, () => document.querySelectorAll("#members .member").length === 4 && document.querySelectorAll('.prow[data-i="0"] .av').length === 4, "Mia nicht entfernt");
});

await step(A, "Wer isst wann: Person an einem Tag ab/an, Gäste +1 … zurück auf 0", async () => {
  const num0 = await dayNum(A, 0);
  await tap(A, '#attendance [data-day="0"][data-member="joshua"]');
  await until(A, () => document.querySelector('#attendance [data-day="0"][data-member="joshua"]').getAttribute("aria-pressed") === "false" && document.querySelector('.prow[data-i="0"] .av[data-member="joshua"]').classList.contains("off"), "Joshua am Montag nicht ab");
  await tap(A, '#attendance [data-day="0"][data-member="joshua"]');
  await until(A, () => document.querySelector('#attendance [data-day="0"][data-member="joshua"]').getAttribute("aria-pressed") === "true", "Joshua nicht zurück");
  for (let g = 1; g <= 5; g++) {
    await tap(A, '#attendance [data-guests="0"]');
    await until(A, ([g, n]) => document.querySelector('#attendance [data-guests="0"]').textContent === String(g % 5) && +document.querySelector('.prow[data-i="0"] .num').textContent === n + (g % 5), `Gäste ${g % 5}`, [g, num0]);
  }
});

await step(A, "Ohne Server: Kalender und Abgleichen sagen, was fehlt", async () => {
  await clearToasts(A);
  await tap(A, "#calendarBtn");
  await toastIs(A, /Zuerst mit dem WG-Server verbinden/);
  await clearToasts(A);
  await tap(A, "#syncNowBtn");
  await toastIs(A, /Zuerst die WG-PIN eingeben/);
});

let planLink = "";
await step(A, "Plan-Link teilen (ohne Teilen-Blatt → kopiert)", async () => {
  await clearToasts(A);
  await tap(A, "#sharePlanBtn");
  await toastIs(A, /Plan-Link kopiert/);
  planLink = await clip(A);
  expect(planLink.startsWith(BASE) && planLink.includes("#plan="), `Link: ${planLink.slice(0, 60)}`);
});

await step(A, "Znacht-Zeit 19:15 (Zeitwähler) wird gespeichert", async () => {
  await pickNative(A, "#dinnerTime", "19:15");
  expect((await ls(A, "bringfrisch_dinner_time")) === "19:15", "Zeit nicht gespeichert");
});

await step(A, "Stil umschalten: iPhone ↔ Android", async () => {
  expect((await text(A, "#setOsBtn")) === "iPhone", "Knopf zeigt nicht iPhone");
  await tap(A, "#setOsBtn");
  await until(A, () => document.documentElement.classList.contains("m3") && document.getElementById("setOsBtn").textContent === "Android", "kein Android-Stil");
  await shot(A, "12-android-stil");
  await tap(A, "#setOsBtn");
  await until(A, () => document.documentElement.classList.contains("glass") && localStorage.getItem("bf-os") === "glass", "nicht zurück auf iPhone");
});

await step(A, "Hell / Dunkel / Automatisch: Schalter unter Stil (pro Handy)", async () => {
  const bg = () => A.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  const light = await bg();
  await choose(A, "#modeSelect", "dark");
  await until(A, () => document.documentElement.classList.contains("dark") && localStorage.getItem("bf-mode") === "dark", "nicht dunkel");
  expect((await bg()) !== light, `Hintergrund bleibt hell (${light})`);
  await shot(A, "12b-dunkel");
  await choose(A, "#modeSelect", "auto");
  await until(A, () => !document.documentElement.classList.contains("dark") && localStorage.getItem("bf-mode") === null, "Automatisch (System hell) nicht hell");
});

await step(A, "Akzentfarbe: Pistazie, Himmelblau, eigene Farbe, «Hellgrün» = Standard", async () => {
  const prim = () => A.page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
  for (const v of ["#93c572", "#8ecae6"]) {
    await tap(A, `#accentPick button[data-accent="${v}"]`);
    await until(A, v => document.querySelector(`#accentPick button[data-accent="${v}"]`).getAttribute("aria-pressed") === "true" && document.documentElement.style.getPropertyValue("--primary"), `Akzent ${v} wirkt nicht`, v);
  }
  const blue = await prim();
  await pickNative(A, '#accentPick input[type="color"]', "#ff8800");
  await until(A, b => document.querySelector("#accentPick .custom").getAttribute("aria-pressed") === "true" && document.documentElement.style.getPropertyValue("--primary") !== b, "eigene Akzentfarbe wirkt nicht", blue);
  await shot(A, "13-akzent-eigen");
  await tap(A, '#accentPick button[data-accent=""]');
  await until(A, () => !document.documentElement.style.getPropertyValue("--primary") && document.querySelector('#accentPick button[data-accent=""]').getAttribute("aria-pressed") === "true", "Standard-Akzent nicht zurück");
});

await step(A, "Hintergrund: Weiss, Sand, eigene Farbe, «Standard» setzt zurück", async () => {
  for (const v of ["#f7f7f5", "#f4ede1"]) {
    await tap(A, `#bgPick button[data-bg="${v}"]`);
    await until(A, v => document.querySelector(`#bgPick button[data-bg="${v}"]`).getAttribute("aria-pressed") === "true" && document.documentElement.style.getPropertyValue("--bg"), `Hintergrund ${v} wirkt nicht`, v);
  }
  await pickNative(A, '#bgPick input[type="color"]', "#e8f0ff");
  await until(A, () => document.querySelector("#bgPick .custom").getAttribute("aria-pressed") === "true", "eigener Hintergrund wirkt nicht");
  await tap(A, '#bgPick button[data-bg=""]');
  await until(A, () => !document.documentElement.style.getPropertyValue("--bg") && JSON.parse(localStorage.getItem("bf-theme")).bg === "", "Standard-Hintergrund nicht zurück");
});

await step(A, "WG-PIN: falscher PIN zeigt Fehler, richtiger PIN verbindet", async () => {
  A.allow.push(/status of 401/);
  await typeInto(A, "#syncPin", "0000");
  await tap(A, '#syncForm button[type="submit"]');
  await until(A, () => document.getElementById("syncStatus").textContent === "Falscher WG-PIN", "Fehler bei falschem PIN fehlt");
  A.allow.pop();
  await typeInto(A, "#syncPin", PIN);
  await tap(A, '#syncForm button[type="submit"]');
  await until(A, () => document.getElementById("syncStatus").textContent === "Verbunden ✓", "nicht verbunden");
  await until(A, () => !document.getElementById("bringListField").hidden && document.getElementById("bringListSelect").options.length === 2 && document.getElementById("bringListName").textContent === "WG", "Bring!-Listen fehlen");
  await waitPushed(A);
  expect(kvJson("plan") && kvJson("plan").dinnerTime === "19:15", "Plan (mit Znacht-Zeit) nicht beim WG-Server");
  expect(kvJson("vorrat") && kvJson("vorrat").staples.some(s => s.name === "Testsenf"), "Grundvorrat nicht beim WG-Server");
  await shot(A, "14-verbunden");
});

await step(A, "Bring!-Liste wählen: «Ferien», dann zurück auf «WG»; «Home-test» nicht wählbar", async () => {
  const opts = await A.page.$$eval("#bringListSelect option", os => os.map(o => o.textContent));
  expect(!opts.includes("Home-test") && opts.includes("Ferien"), `Auswahl zeigt: ${opts.join(", ")}`);
  await clearToasts(A);
  await choose(A, "#bringListSelect", "H");
  await toastIs(A, /Bring!-Liste: Ferien ✓/);
  expect(kv.get("bringList") === "H" && (await text(A, "#bringListName")) === "Ferien", "Ferien nicht gewählt");
  await clearToasts(A);
  await choose(A, "#bringListSelect", "L");
  await toastIs(A, /Bring!-Liste: WG ✓/);
  expect(kv.get("bringList") === "L", "WG nicht gewählt");
});

await step(A, "Abgleichen", async () => {
  await clearToasts(A);
  await tap(A, "#syncNowBtn");
  await toastIs(A, /^Synchronisiert ✓/);
});

await step(A, "Kalender abonnieren (iPhone): persönlicher Link, Kalender-App öffnet, Abo enthält den Plan um 19:15", async () => {
  // webcal:// öffnet headless nichts; geprüft wird der kopierte Link und was ein Kalender dort abholt
  await clearToasts(A);
  await tap(A, "#calendarBtn");
  await toastIs(A, /Kalender öffnet sich – «Abonnieren» tippen/);
  const link = await clip(A);
  const me = await A.page.evaluate(() => JSON.parse(localStorage.getItem("bringfrisch_me")) || JSON.parse(localStorage.getItem("bringfrisch_members"))[0].id);
  expect(link === `${WORKER}/cal/cal-test.ics?me=${me}`, `Link ${link}`);
  await until(A, () => /webcal:/.test(window.__nav || ""), "Kalender-App wird nicht geöffnet");
  const ics = await (await worker.fetch(new Request(link), env)).text();
  const plan = await titles(A);
  expect(ics.includes("DTSTART;TZID=Europe/Zurich:20261109T191500") && ics.includes(`SUMMARY:🍲 ${plan[0].replace(/,/g, "\\,")}`), "Kalender ohne Montag 19:15 / Gericht");
  expect(A.page.url().startsWith(BASE), "Seite ist weggesprungen");
});

await step(A, "Einstellungen: direkt die Seite (kein Pop-up); «Abgleichen»", async () => {
  await goTab(A, "wg");
  expect(!(await A.page.$("#navMenu")), "altes ⋮-Menü ist noch da");
  expect(await A.page.$eval("#tab-wg", t => !t.hidden && t.querySelector(".set-hero").getBoundingClientRect().height > 40), "Einstellungen nicht direkt sichtbar");
  await shot(A, "15-einstellungen");
  await clearToasts(A);
  await A.page.evaluate(() => { document.getElementById("setMore").open = true; });
  await tap(A, "#syncNowBtn");
  await toastIs(A, /^Synchronisiert ✓/);
});

await step(A, "Einstellungen: Wochenwahl öffnen → «Einfach zufällig planen» → «Rückgängig»", async () => {
  await goTab(A, "plan");
  const before = await titles(A);
  await goTab(A, "wg");
  await A.page.evaluate(() => { document.getElementById("setMore").open = true; });
  await tap(A, "#setVoteBtn");
  await until(A, () => document.getElementById("voteDialog").open && document.querySelectorAll("#voteGrid .vcard").length === 14, "Wochenwahl geht nicht auf");
  await clearToasts(A);
  await tap(A, "#voteRandomBtn");
  await toastIs(A, /Neue Woche geplant/);
  expect(!(await isOpen(A, "voteDialog")), "Wochenwahl bleibt offen");
  expect((await titles(A)).join() !== before.join(), "Plan unverändert");
  await tap(A, ".toast button");
  await until(A, b => [...document.querySelectorAll("#days .t")].map(e => e.textContent).join() === b, "Rückgängig stellt Plan nicht her", before.join());
});

await step(A, "Plan: Knopf «Wechseln» sieht aus wie ein Knopf (Text drin, nicht darüber)", async () => {
  await goTab(A, "plan");
  await tap(A, '.prow[data-i="1"] .pday');
  await until(A, () => !!document.querySelector('.prow[data-i="1"].open .links [data-pick]'), "Tag geht nicht auf");
  const r = await A.page.evaluate(() => {
    const b = document.querySelector('.prow[data-i="1"] .links [data-pick]'), br = b.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(b); const tr = range.getBoundingClientRect();
    return { h: br.height, w: br.width, inside: tr.top >= br.top - 1 && tr.bottom <= br.bottom + 1 && tr.left >= br.left - 1 && tr.right <= br.right + 1, fs: parseFloat(getComputedStyle(b).fontSize) };
  });
  expect(r.h >= 30 && r.w >= 70 && r.inside && r.fs >= 13, `«Wechseln» kaputt: ${JSON.stringify(r)}`);
  await tap(A, '.prow[data-i="1"] .pday');
});

await step(A, "Plan: Rezept-Link öffnet in neuem Tab – Original-Seite oder «Rezept suchen» auf Fooby", async () => {
  await goTab(A, "plan");
  const links = await A.page.evaluate(() => [...document.querySelectorAll("#days .prow:not(.unplanned)")]
    .filter(r => !/schnell|Reste/.test(r.querySelector(".meta").textContent))
    .map(r => { const a = r.querySelector(".links a"); return { title: r.querySelector(".t").textContent, href: a && a.href, text: a && a.textContent, target: a && a.target }; }));
  expect(links.length > 0, "keine geplanten Menüs");
  for (const l of links) {
    expect(l.href && l.href.startsWith("https://") && l.target === "_blank", `${l.title}: kein Rezept-Link (${JSON.stringify(l)})`);
    const search = /fooby\.ch\/de\/suche/.test(l.href);
    expect(search === /Rezept suchen/.test(l.text), `${l.title}: Linktext passt nicht (${l.text})`);
    if (search) expect(decodeURIComponent(l.href).includes(l.title), `${l.title}: Suche ohne Menü-Namen (${l.href})`);
  }
});

await step(A, "Navigation: jeder Tab, kein seitliches Scrollen", async () => {
  for (const t of ["plan", "shop", "season", "wg", "plan"]) {
    await goTab(A, t);
    await noHScroll(A, t);
  }
  expect((await A.page.$eval('.bnav [data-tab="plan"]', b => b.getAttribute("aria-current"))) === "page", "Plan nicht markiert");
});

await step(A, "keine JS-Fehler, nichts ins Internet", async () => {
  expect(A.errors.length === 0, A.errors.join(" | "));
  expect(A.blocked.length === 0, `ins Internet: ${A.blocked.join(", ")}`);
});

// Plan-Link auf einem zweiten Handy (iPhone, dunkel) öffnen
const A2 = await phone({ name: "A2-iphone-dunkel", os: "ios", scheme: "dark", now: "2026-11-10T12:00:00", url: planLink });
await step(A2, "Plan-Link öffnen: Plan übernommen, dunkel", async () => {
  await toastIs(A2, /Wochenplan aus Link übernommen/);
  expect((await titles(A2)).join() === (await titles(A)).join(), "anderer Plan als auf Handy A");
  expect((await background(A2)) < 0.3, "Hintergrund nicht dunkel");
  await until(A2, () => !document.getElementById("wpop").hidden, "Pop-up fehlt");
  await tap(A2, "#wlater");
  await until(A2, () => document.getElementById("wpop").hidden, "Pop-up bleibt");
  await shot(A2, "01-plan-dunkel");
  for (const t of ["shop", "season", "wg"]) { await goTab(A2, t); await noHScroll(A2, t); await shot(A2, `02-${t}`); }
  expect(A2.errors.length === 0, A2.errors.join(" | "));
});
await A2.context.close();

// ---------------------------------------------------------------------------------------------
// Ablauf B: Android, dunkel, Dienstag, verbunden (PIN schon eingegeben) – Wochenwahl und Bring!
// ---------------------------------------------------------------------------------------------
const B = await phone({
  name: "B-android-dunkel", os: "android", scheme: "dark", now: "2026-11-10T12:00:00",
  preset: { bringfrisch_sync: JSON.stringify({ url: WORKER, pin: PIN }), bringfrisch_me: JSON.stringify("lukas") },
});

await step(B, "Start verbunden: WG-Plan geladen, Android-Stil, dunkel", async () => {
  await until(B, () => document.getElementById("syncStatus").textContent === "Verbunden ✓", "nicht verbunden");
  expect((await titles(B)).join() === (await titles(A)).join(), "WG-Plan von Handy A nicht übernommen");
  expect(await B.page.$eval("html", h => h.classList.contains("m3")), "nicht Android-Stil");
  expect((await background(B)) < 0.3, "nicht dunkel");
  await until(B, () => !document.getElementById("wpop").hidden && document.getElementById("wpop").classList.contains("show"), "Pop-up fehlt");
  await shot(B, "01-start-popup");
});

let cand = [];
await step(B, "Pop-up «Wochenwahl starten» öffnet die Wochenwahl mit 14 Gerichten", async () => {
  await tap(B, "#wgo");
  await until(B, () => document.getElementById("voteDialog").open && document.querySelectorAll("#voteGrid .vcard").length === 14, "Wochenwahl geht nicht auf");
  expect((await text(B, "#voteSubtitle")).startsWith("KW 46 ·"), "Untertitel");
  cand = await B.page.$$eval("#voteGrid .vt", l => l.map(e => e.textContent));
  await shot(B, "02-wochenwahl");
  await dialogNoHScroll(B, "voteDialog");
});

const card = k => `#voteGrid .vcard:nth-child(${k + 1})`;
// Memory-Karte: Bild antippen = umdrehen = wählen; Rückseite mit Wunschtag und «Abwählen»
const isLiked = (P, k) => P.page.$eval(`${card(k)} [data-like]`, b => b.getAttribute("aria-pressed") === "true");
async function flipOpen(P, k) {
  if (await P.page.$eval(card(k), c => c.classList.contains("open"))) return;
  await tap(P, `${card(k)} .vfront`);
  await until(P, s => document.querySelector(s).classList.contains("open"), `Karte ${k} dreht nicht um`, card(k));
}
async function likeCard(P, k) {
  if (await P.page.$eval(card(k), c => c.classList.contains("open"))) { if (!(await isLiked(P, k))) await tap(P, `${card(k)} [data-like]`); }
  else await flipOpen(P, k);
  await until(P, s => document.querySelector(`${s} [data-like]`).getAttribute("aria-pressed") === "true", `Gericht ${k} nicht gewählt`, card(k));
}
async function unlikeCard(P, k) { await flipOpen(P, k); await tap(P, `${card(k)} [data-like]`); }
await step(B, "Wochenwahl als Leonie (Memory: Umdrehen = wählen): 3 Gerichte, Wunschtag Mi, «egal», Titel + 🌐 vorne und hinten, zurückdrehen bleibt gewählt, eines abwählen", async () => {
  await choose(B, "#voteMe", "leonie");
  for (const k of [0, 1, 2]) await likeCard(B, k);
  expect((await text(B, "#voteMine")) === "3 gewählt", "Zähler");
  await flipOpen(B, 0);
  await tap(B, `${card(0)} [data-wish][data-day="2"]`);
  await until(B, s => document.querySelector(`${s} [data-wish][data-day="2"]`).getAttribute("aria-pressed") === "true", "Wunschtag nicht gesetzt", card(0));
  expect((await text(B, `${card(0)} .vwish`)) === "Mi", "Wunschtag fehlt vorne auf dem Bild");
  await tap(B, `${card(0)} [data-wish][data-day="-1"]`); // «egal» = kein Wunschtag
  await until(B, s => document.querySelector(`${s} .egal`).getAttribute("aria-pressed") === "true" && !document.querySelector(`${s} [data-day="2"][aria-pressed="true"]`), "«egal» setzt den Wunschtag nicht zurück", card(0));
  await tap(B, `${card(0)} [data-wish][data-day="2"]`);
  await until(B, s => document.querySelector(`${s} [data-wish][data-day="2"]`).getAttribute("aria-pressed") === "true", "Wunschtag nicht wieder gesetzt", card(0));
  const links = await B.page.$$eval(`${card(0)} .vgo`, l => l.map(a => ({ href: a.href, label: a.getAttribute("aria-label"), target: a.target, w: a.getBoundingClientRect().width })));
  expect(links.length === 2 && links.every(a => a.href.startsWith("https://") && a.target === "_blank" && a.w >= 32 && /^(Rezept auf .+|Auf Fooby suchen) ↗$/.test(a.label)), `🌐-Link zum Rezept vorne und hinten (${JSON.stringify(links)})`);
  const bands = await B.page.$$eval(`${card(0)} .vband`, l => l.map(b => b.textContent));
  expect(bands.length === 2 && bands[0] === bands[1] && /Min\./.test(bands[0]), `Titel und Beschreibung vorne und hinten gleich (${JSON.stringify(bands)})`);
  await shot(B, "02a-wochenwahl-rueckseite");
  await tap(B, `${card(0)} .vback .vbt`); // irgendwo auf die Rückseite tippen = zurück aufs Bild
  await until(B, s => !document.querySelector(s).classList.contains("open"), "Antippen dreht nicht zurück aufs Bild", card(0));
  expect(await isLiked(B, 0), "zurückdrehen hat abgewählt");
  await unlikeCard(B, 2);
  await until(B, () => document.getElementById("voteMine").textContent === "2 gewählt", "Abwählen klappt nicht");
  expect((await text(B, "#voteWho")) === "1 von 4 haben gewählt", await text(B, "#voteWho"));
});

await step(B, "Wochenwahl: Bilder von der Rezeptseite (WG-Server legt sie ab, Handy merkt sie sich)", async () => {
  await until(B, () => document.querySelectorAll("#voteGrid .vimg.ok").length > 0 && [...document.querySelectorAll("#voteGrid .vimg.ok")].every(e => /blob:/.test(e.style.backgroundImage)), "keine Bilder in der Wochenwahl", null, 15000);
  expect([...kv.keys()].some(k => k.startsWith("img:")), "Bild nicht im WG-Server abgelegt");
  expect(await B.page.evaluate(async () => (await (await caches.open("bf-img")).keys()).length > 0), "Bild nicht im Handy-Cache");
  await shot(B, "02b-wochenwahl-bilder");
});

await step(B, "Wochenwahl als Jo (gleiches Handy, sofort gewechselt): 2 Gerichte; beide Stimmen kommen beim WG-Server an", async () => {
  await choose(B, "#voteMe", "jo"); // innerhalb von 0.5 s nach Leonies letzter Wahl (Regression: Stimme ging verloren)
  for (const k of [1, 3]) await likeCard(B, k);
  await until(B, () => document.getElementById("voteMine").textContent === "2 gewählt", "Jo: 2 gewählt fehlt");
  await until(B, s => document.querySelectorAll(`${s} .mini`).length === 2, "Gericht 2 hat nicht 2 Stimmen", card(1));
  expect((await text(B, "#voteRank .rank-row .t")) === cand[1], "Ranking: Gericht mit 2 Stimmen nicht zuoberst");
  await sleep(900);
  const lv = kvJson("week:2026-W46:vote:leonie"), jv = kvJson("week:2026-W46:vote:jo");
  expect(lv && lv.likes.length === 2 && lv.days && Object.values(lv.days)[0] === 2, `Leonies Stimme beim Server: ${JSON.stringify(lv)}`);
  expect(jv && jv.likes.length === 2, `Jos Stimme beim Server: ${JSON.stringify(jv)}`);
});

await step(B, "«Neu mischeln»: Gerichte ohne Stimme werden ersetzt, gewählte bleiben", async () => {
  await clearToasts(B);
  await tap(B, "#voteShuffleBtn");
  await toastIs(B, /neu gemischelt/);
  const now = await B.page.$$eval("#voteGrid .vt", l => l.map(e => e.textContent));
  expect(now[0] === cand[0] && now[1] === cand[1] && now[3] === cand[3], "gewählte Gerichte haben gewechselt");
  expect(now.some((t, k) => ![0, 1, 3].includes(k) && t !== cand[k]), "nichts neu gemischelt");
  cand = now;
});

await step(B, "«+ Gericht»: Katalog im Wochenwahl-Modus, Gericht dazu → 15 Gerichte", async () => {
  await tap(B, "#voteAddBtn");
  await until(B, () => document.getElementById("catalogDialog").open && !document.getElementById("voteDialog").open, "Katalog geht nicht auf");
  expect((await text(B, "#catalogSubtitle")) === "Gericht zur Wochenwahl hinzufügen", "Untertitel");
  expect(await B.page.$eval("#randomPickBtn", b => b.hidden), "«Zufällig» sichtbar");
  const k = await B.page.evaluate(c => [...document.querySelectorAll("#catalogList .recipe")].findIndex(r => !c.includes(r.querySelector("b").textContent)), cand);
  const t = await B.page.$eval(`#catalogList .recipe:nth-child(${k + 1}) b`, b => b.textContent);
  await clearToasts(B);
  await tap(B, `#catalogList .recipe:nth-child(${k + 1}) [data-assign]`);
  await until(B, () => document.getElementById("voteDialog").open && document.querySelectorAll("#voteGrid .vcard").length === 15, "nicht 15 Gerichte");
  await toastIs(B, /ist in der Wochenwahl/);
  expect((await text(B, "#voteGrid .vcard:last-child .vt")) === t, "neues Gericht fehlt");
});

await step(B, "7 Gerichte übernehmen: Wunschtag Mi, Plan geändert, roter Punkt weg", async () => {
  await clearToasts(B);
  await tap(B, "#voteApplyBtn");
  await toastIs(B, /Plan übernommen/);
  expect(!(await isOpen(B, "voteDialog")), "Wochenwahl bleibt offen");
  const plan = await titles(B);
  expect(plan[2] === cand[0], `Mittwoch: ${plan[2]} statt ${cand[0]}`);
  expect([cand[1], cand[3]].every(t => plan.includes(t)), "gewählte Gerichte fehlen im Plan");
  expect(!(await B.page.$eval("#openVoteBtn", b => b.classList.contains("due"))), "roter Punkt noch da");
  await shot(B, "03-plan-nach-wahl");
});

let n0 = 0, shopNames = [];
await step(B, "Bring! füllen: alle Artikel landen in Bring! «WG», Chip «✓ in Bring!»", async () => {
  await waitPushed(B);
  n0 = await ctaCount(B);
  shopNames = await B.page.$$eval("#shopList [data-shop]", l => l.map(b => b.dataset.shop)); // Einkaufszeilen (Abschnitt «Kaufen»)
  expect(n0 > 5 && wg().length === 0, `Chip ${n0}, Bring! hat schon ${wg().length}`);
  await clearToasts(B);
  await tap(B, "#syncBtn");
  await toastIs(B, new RegExp(`^${n0} Artikel in Bring! ✓`));
  expect(wg().length === n0 && bring.H.items.length === 0, `Bring! WG ${wg().length}, Ferien ${bring.H.items.length}`);
  await until(B, () => document.getElementById("ctaCount").textContent === "✓ in Bring!", "Chip zeigt nicht ✓");
  await shot(B, "04-bring-gefuellt");
});

await step(B, "«Rückgängig» nach dem Füllen: neue Artikel wieder weg; nochmals füllen", async () => {
  await tap(B, ".toast button");
  await toastIs(B, /Rückgängig gemacht/);
  expect(wg().length === 0, `noch ${wg().length} auf Bring!`);
  await until(B, n => parseInt(document.getElementById("ctaCount").textContent, 10) === n, "Chip zählt nicht wieder", n0);
  await clearToasts(B);
  await tap(B, "#syncBtn");
  await toastIs(B, /Artikel in Bring! ✓/);
  expect(wg().length === n0, "nicht wieder gefüllt");
});

await step(B, "Nochmals füllen ohne Änderung: fragt nichts", async () => {
  await clearToasts(B);
  await tap(B, "#syncBtn");
  await toastIs(B, /Alles schon auf Bring! ✓/);
  expect(!(await isOpen(B, "dupDialog")), "Nachfrage offen");
});

let foreign = "";
await step(B, "Plan ändert sich + fremder Eintrag: Nachfrage mit Vorauswahl (Bot-Artikel an, fremde aus), «Abbrechen» sendet nichts", async () => {
  // Jemand hat einen Artikel in Bring! gekauft und selbst neu eingetragen -> gehört jetzt ihm
  const fi = wg().findIndex(x => shopNames.includes(x.name)); // ein Artikel, der in der Einkaufsliste genau so heisst
  expect(fi >= 0, "kein passender Artikel");
  foreign = wg()[fi].name;
  wg().splice(fi, 1);
  await workerCall("/bring/list");
  wg().push({ name: foreign, specification: "1 Packung" });
  await choose(B, '.prow[data-i="0"] select.buf', "6");
  await until(B, () => /mehr/.test(document.getElementById("ctaCount").textContent), "Chip zeigt keine Mehrmenge");
  const snap = wgSnap();
  await tap(B, "#syncBtn");
  await until(B, () => document.getElementById("dupDialog").open, "Nachfrage erscheint nicht");
  const rows = await B.page.$$eval("#dupList .duprow", l => l.map(r => ({ name: r.querySelector("b").textContent, on: r.querySelector("input").checked, foreign: r.textContent.includes("von jemand anderem") })));
  const f = rows.find(r => r.name === foreign);
  expect(f && f.foreign && !f.on, `fremder Eintrag ${foreign}: ${JSON.stringify(f)}`);
  expect(rows.filter(r => !r.foreign).length > 0 && rows.filter(r => !r.foreign).every(r => r.on), "Bot-Artikel nicht vorausgewählt");
  await shot(B, "05-nachfrage");
  await dialogNoHScroll(B, "dupDialog");
  await tap(B, "#dupCancelBtn");
  await until(B, () => !document.getElementById("dupDialog").open, "Nachfrage bleibt offen");
  await sleep(300);
  expect(wgSnap() === snap, "trotz Abbrechen gesendet");
});

await step(B, "Nachfrage: fremden Eintrag dazu ankreuzen, «Senden», dann «Rückgängig» = alte Mengen", async () => {
  const snap = wgSnap();
  await clearToasts(B);
  await tap(B, "#syncBtn");
  await until(B, () => document.getElementById("dupDialog").open, "Nachfrage erscheint nicht");
  const i = await B.page.$$eval("#dupList .duprow", (l, n) => l.findIndex(r => r.querySelector("b").textContent === n), foreign);
  await tap(B, `#dupList [data-dup="${i}"]`);
  await until(B, i => document.querySelector(`#dupList [data-dup="${i}"]`).checked, "Ankreuzen klappt nicht", i);
  await tap(B, "#dupSendBtn");
  await toastIs(B, /Artikel in Bring! ✓/);
  const spec = wg().find(x => x.name === foreign).specification;
  expect(spec.startsWith("1 Packung + "), `fremde Menge nicht ergänzt: ${spec}`);
  expect(wgSnap() !== snap && wg().length === n0, "Mengen nicht geändert / Artikel dazu");
  await tap(B, ".toast button");
  await toastIs(B, /Rückgängig gemacht/);
  expect(wgSnap() === snap, "Rückgängig stellt die alten Mengen nicht her");
  await choose(B, '.prow[data-i="0"] select.buf', "2");
});

await step(B, "Einkauf verbunden: Zeile «Auf Bring!» antippen = weg, in «Kaufen» antippen = wieder drauf; fremder Eintrag bleibt", async () => {
  await goTab(B, "shop");
  await tap(B, '#tab-shop .seg [data-filter="onBring"]');
  await until(B, () => document.querySelectorAll("#shopList [data-shop]").length > 0, "nichts auf Bring!");
  const names = await B.page.$$eval("#shopList [data-shop]", l => l.map(b => b.dataset.shop));
  const pick = names.find(n => wg().some(x => x.name === n) && wg().filter(x => x.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(x.name.toLowerCase())).length === 1 && n !== foreign);
  expect(pick, "keine eindeutige Zeile gefunden");
  const len = wg().length;
  await clearToasts(B);
  await tap(B, `#shopList [data-shop="${pick}"]`);
  await toastIs(B, /von Bring! genommen/);
  expect(wg().length === len - 1 && !wg().some(x => x.name === pick), `${pick} noch auf Bring!`);
  await tap(B, '#tab-shop .seg [data-filter="toBuy"]');
  await clearToasts(B);
  await tap(B, `#shopList [data-shop="${pick}"]`);
  await toastIs(B, /auf Bring! ✓/);
  expect(wg().length === len, `${pick} nicht wieder drauf`);
  // fremder Eintrag: Bot nimmt ihn nicht weg
  // fremder Eintrag: «Auf Bring!» antippen -> Bot nimmt ihn nicht weg, sagt wer ihn abhaken muss
  await tap(B, '#tab-shop .seg [data-filter="onBring"]');
  await clearToasts(B);
  await tap(B, `#shopList [data-shop="${foreign}"]`);
  await toastIs(B, /hat jemand anderes auf Bring! gesetzt/);
  expect(wg().some(x => x.name === foreign), "fremder Eintrag wurde gelöscht");
  await shot(B, "06-einkauf");
  await noHScroll(B, "Einkauf");
});

await step(B, "Grundvorrat verbunden: «leer» merkt nur, «Prüfen» → Gegenüberstellung → auf Bring! mit Vermerk «Vorrat», Rückgängig; in Bring! gekauft = eine Packung dazu (Herunterziehen)", async () => {
  await tap(B, '#tab-shop .seg [data-filter="staples"]');
  await until(B, () => document.getElementById("vAll"), "Vorrat-Liste fehlt");
  if (!(await B.page.$eval("#vAll", d => d.open))) await tap(B, "#vAll summary");
  // ein Artikel, der noch nicht auf Bring! steht und im Bild ist
  const idx = await B.page.evaluate(() => {
    const free = [...document.querySelectorAll("#vAll [data-vleer]")].filter(b => !b.querySelector(".vcart"));
    free[0].scrollIntoView({ block: "center" });
    return free[0].dataset.vleer;
  });
  const before = wgNames();
  await tap(B, `#vAll [data-vleer="${idx}"]`);
  await until(B, i => { const r = document.querySelector(`#shopList .vsec [data-vleer="${i}"]`); return r && r.getAttribute("aria-pressed") === "true"; }, "nicht leer gemeldet", idx);
  await sleep(300);
  expect(wgNames().join() === before.join(), "«leer» hat schon etwas auf Bring! gesetzt");
  const send = async () => {
    await tap(B, "#trayCheckBtn");
    await until(B, () => document.getElementById("compareDialog").open, "Gegenüberstellung geht nicht auf");
    // nur den Vorrat senden: Plan-Artikel abwählen
    for (const k of await B.page.$$eval('#compareCols [data-cmp^="p:"][aria-pressed="true"]:not([disabled])', l => l.map(b => b.dataset.cmp))) await tap(B, `#compareCols [data-cmp="${k}"]`);
    expect(await B.page.$eval(`[data-cmp="v:${idx}"]`, b => b.getAttribute("aria-pressed") === "true"), "leerer Artikel nicht vorausgewählt");
    await clearToasts(B);
    await tap(B, "#compareSendBtn");
    await toastIs(B, /auf Bring! ✓/);
  };
  await send();
  const added = wgNames().filter(n => !before.includes(n));
  expect(added.length === 1 && /^Vorrat · /.test(wg().find(x => x.name === added[0]).specification), `nicht genau 1 Vorrat-Artikel mit Vermerk: ${added}`);
  await tap(B, ".toast button");
  await toastIs(B, /Rückgängig gemacht/);
  expect(!wgNames().includes(added[0]), "Rückgängig nimmt ihn nicht weg");
  await send();
  expect(wgNames().includes(added[0]), "nicht wieder auf Bring!");
  await until(B, i => document.querySelector(`#shopList .vsec [data-vleer="${i}"] .vcart`), "Einkaufswagen am Artikel fehlt", idx);
  await shot(B, "07-grundvorrat");
  // In Bring! abgehakt (gekauft)
  wg().splice(wg().findIndex(x => x.name === added[0]), 1);
  await goTab(B, "plan");
  await clearToasts(B);
  await pullDown(B);
  await toastIs(B, /Synchronisiert ✓/);
  await goTab(B, "shop");
  const st = (await ls(B, "bringfrisch_user_staples"))[+idx];
  expect(st.in_stock === true && st.qty > 0 && !st.sent && st.since === "2026-11", `gekaufter Vorrat nicht wieder da: ${JSON.stringify(st)}`);
  await waitPushed(B);
  expect(kvJson("vorrat").staples[+idx].qty === st.qty, "WG-Server kennt die neue Menge nicht");
});

await step(B, "Herunterziehen holt den neueren Plan eines anderen Handys", async () => {
  await goTab(B, "plan");
  await waitPushed(B);
  const doc = kvJson("plan");
  doc.plan[6] = { ...doc.plan[6], id: "remote-1", title: "Fondue vom anderen Handy", ingredients: [] };
  await workerCall("/plan", { method: "PUT", body: JSON.stringify({ week: doc.week, plan: doc.plan, members: doc.members, dinnerTime: doc.dinnerTime }) });
  await clearToasts(B);
  await pullDown(B);
  await toastIs(B, /Synchronisiert ✓/);
  await until(B, () => document.querySelector('.prow[data-i="6"] .t').textContent === "Fondue vom anderen Handy", "neuer Plan nicht geladen");
});

await step(B, "WG-Server nicht erreichbar: «Bring! füllen» zeigt Fehler und die Übergabe (Teilen/Kopieren)", async () => {
  await choose(B, '.prow[data-i="1"] select.buf', "4");
  B.offline = true;
  B.allow.push(/net::ERR|Failed to load resource|Failed to fetch/);
  await clearToasts(B);
  await tap(B, "#syncBtn");
  await toastIs(B, /^Bring!: /);
  await until(B, () => document.getElementById("handoffDialog").open, "Übergabe erscheint nicht");
  await shot(B, "08-offline-uebergabe");
  await tap(B, "#copyOnlyBtn");
  await toastIs(B, /Artikel kopiert/);
  await closeDialog(B, "handoffDialog");
  B.offline = false;
  await waitPushed(B); // Plan-Änderung geht beim nächsten Mal mit
  await choose(B, '.prow[data-i="1"] select.buf', "2");
  await waitPushed(B);
  B.allow.pop();
});

await step(B, "Rezept-Link importieren (WG-Server holt Titel, Portionen, Zutaten), einplanen, löschen", async () => {
  await tap(B, '.prow[data-i="5"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, "#newRecipeBtn");
  await until(B, () => document.getElementById("recipeDialog").open, "Formular geht nicht auf");
  await clearToasts(B);
  await typeInto(B, "#recipeUrl", RECIPE_URL);
  await tap(B, "#recipeInstructions");
  await toastIs(B, /3 Zutaten übernommen/);
  expect((await B.page.$eval("#recipeTitle", e => e.value)) === "Kürbis-Lasagne" && (await B.page.$eval("#recipeServings", e => e.value)) === "6", "Titel/Portionen nicht übernommen");
  expect((await B.page.$eval("#recipeIngredients", e => e.value)).split("\n").length === 3, "Zutaten nicht übernommen");
  expect((await B.page.$eval("#recipeDiet", e => e.value)) === "vegi", "Kürbis-Lasagne fälschlich als Fleisch erkannt");
  // Fleisch im Titel -> «Fleisch» vorgewählt (z.B. «Wirzwickel mit Hackfleisch»)
  await B.page.$eval("#recipeTitle", e => { e.value = "Wirzwickel mit Hackfleisch"; });
  await B.page.$eval("#recipeIngredients", e => { e.value = ""; });
  await B.page.$eval("#recipeUrl", e => { e.value = ""; });
  await typeInto(B, "#recipeUrl", RECIPE_URL + "?2");
  await tap(B, "#recipeInstructions");
  await until(B, () => document.getElementById("recipeDiet").value === "fleisch", "Hackfleisch nicht als Fleisch erkannt");
  await B.page.$eval("#recipeTitle", e => { e.value = "Kürbis-Lasagne"; });
  await B.page.$eval("#recipeDiet", e => { e.value = "vegi"; });
  await B.page.$eval("#recipeUrl", (e, u) => { e.value = u; }, RECIPE_URL);
  await shot(B, "09-rezept-link");
  await tap(B, '#recipeForm button[type="submit"]');
  await until(B, () => document.querySelector('.prow[data-i="5"] .t').textContent === "Kürbis-Lasagne", "nicht eingeplant");
  // Seite ohne Rezeptdaten: WG-Server meldet es, Titel kommt aus dem Link
  await tap(B, '.prow[data-i="4"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, "#newRecipeBtn");
  B.allow.push(/status of 4\d\d|status of 5\d\d/);
  await clearToasts(B);
  await typeInto(B, "#recipeUrl", "https://example.com/rezepte/gute-suppe");
  await tap(B, "#recipeInstructions");
  await toastIs(B, /Zutaten von Hand einfügen|nicht erreichbar|Keine Rezeptdaten/);
  await until(B, () => document.getElementById("recipeTitle").value === "Gute Suppe", "Titel aus Link fehlt");
  B.allow.pop();
  await closeDialog(B, "recipeDialog");
  // Link direkt ins Suchfeld des Menüs einfügen (wie aus dem Teilen-Menü: Text + Link) -> «Rezept von diesem Link holen»
  await tap(B, '.prow[data-i="6"] .t');
  await typeInto(B, "#msearch", `Schau mal: ${RECIPE_URL} 😋`);
  await until(B, () => !!document.querySelector("#mlist [data-link]"), "Link-Option in der Menü-Suche fehlt");
  await clearToasts(B);
  await tap(B, "#mlist [data-link]");
  await until(B, () => document.getElementById("recipeDialog").open, "Formular geht nach Link nicht auf");
  await toastIs(B, /3 Zutaten übernommen/);
  expect((await B.page.$eval("#recipeUrl", e => e.value)) === RECIPE_URL, "Link nicht aus dem Text gelöst");
  await tap(B, '#recipeForm button[type="submit"]');
  await until(B, () => document.querySelector('.prow[data-i="6"] .t').textContent === "Kürbis-Lasagne", "Link-Rezept nicht am Sonntag eingeplant");
  await tap(B, '.prow[data-i="4"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, '#catalogFilters [data-filter="custom"]');
  // eigene Rezepte reisen jetzt mit den WG-Einstellungen: es können auch die von Handy A dabei sein
  const lasagne = () => [...document.querySelectorAll("#catalogList .recipe")].filter(c => c.querySelector("b").textContent === "Kürbis-Lasagne");
  await until(B, () => [...document.querySelectorAll("#catalogList .recipe")].filter(c => c.querySelector("b").textContent === "Kürbis-Lasagne").length === 1, "eigenes Rezept fehlt (oder doppelt)");
  await B.page.evaluate(() => { const c = [...document.querySelectorAll("#catalogList .recipe")].find(c => c.querySelector("b").textContent === "Kürbis-Lasagne"); c.querySelector("[data-delete]").id = "delLasagne"; });
  await tap(B, "#delLasagne");
  await tap(B, "#delLasagne");
  await toastIs(B, /Rezept gelöscht/);
  await until(B, () => ![...document.querySelectorAll("#catalogList .recipe b")].some(b => b.textContent === "Kürbis-Lasagne"), "nicht gelöscht");
  void lasagne;
  await closeDialog(B, "catalogDialog");
});

await step(B, "Rezepte-Tab: Webseiten zum Stöbern, eigene Webseite hinzufügen/entfernen", async () => {
  await goTab(B, "season");
  const n = await B.page.$$eval("#recipeSites a.btile", a => a.length);
  expect(n >= 5, `nur ${n} Rezept-Webseiten`);
  expect(await B.page.$eval("#recipeSites a.btile", a => a.target === "_blank" && a.href.startsWith("https://")), "Webseite öffnet nicht in neuem Tab");
  await tap(B, "#siteAddBtn");
  await typeInto(B, "#siteName", "Meine Seite");
  await typeInto(B, "#siteUrl", "kochblog.example.ch/rezepte");
  await tap(B, '#siteForm button[type="submit"]');
  await until(B, () => [...document.querySelectorAll("#recipeSites .btile")].some(b => /Meine Seite/.test(b.textContent)), "eigene Webseite fehlt");
  expect(await B.page.$eval("#recipeSites [data-site-del]", b => b.previousElementSibling.href === "https://kochblog.example.ch/rezepte"), "https:// nicht ergänzt");
  await tap(B, "#recipeSites [data-site-del]");
  await until(B, () => !document.querySelector("#recipeSites [data-site-del]"), "eigene Webseite nicht entfernt");
});

await step(B, "Rezepte-Tab: Link einfügen → Zutaten geholt, Personen anpassen, nur speichern; dann bearbeiten (Plan rechnet neu)", async () => {
  await goTab(B, "season");
  await clearToasts(B);
  await typeInto(B, "#quickLink", RECIPE_URL);
  await tap(B, "#quickLinkBtn");
  await until(B, () => document.getElementById("recipeDialog").open, "Formular geht nicht auf");
  await toastIs(B, /3 Zutaten übernommen/);
  expect(/Laut Webseite für 6/.test(await text(B, "#recipeServingsHint")), "Personen-Hinweis fehlt");
  expect((await text(B, "#recipeSubmitBtn")) === "Speichern", "Knopf sollte nur speichern");
  await B.page.$eval("#recipeServings", e => { e.value = "4"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
  const planBefore = await titles(B);
  await tap(B, "#recipeSubmitBtn");
  await toastIs(B, /gespeichert/);
  expect((await titles(B)).join() === planBefore.join(), "nur speichern hat den Plan geändert");
  await until(B, () => /für 4 Personen/.test(document.getElementById("myRecipes").textContent), "Meine Rezepte: Personen falsch");
  // einplanen, dann Personen ändern -> Plan und Einkaufsliste rechnen neu
  await goTab(B, "plan");
  await tap(B, '.prow[data-i="3"] .t');
  await typeInto(B, "#msearch", "Kürbis-Lasagne");
  await until(B, () => !!document.querySelector("#mlist [data-id^='custom-']"), "eigenes Rezept nicht in der Suche");
  await tap(B, "#mlist [data-id^='custom-']");
  const ctaBefore = await ctaCount(B);
  const amt = () => document.querySelector('.prow[data-i="3"] .ing b') ? document.querySelector('.prow[data-i="3"] .ing b').textContent : "";
  await tap(B, '.prow[data-i="3"] .pday');
  const a1 = await B.page.evaluate(amt);
  await tap(B, '.prow[data-i="3"] .pday');
  await goTab(B, "season");
  await B.page.evaluate(() => { const row = [...document.querySelectorAll("#myRecipes .myrec")].find(r => r.querySelector("b").textContent === "Kürbis-Lasagne"); row.querySelector("[data-my-edit]").id = "editLasagne"; });
  await tap(B, "#editLasagne");
  await until(B, () => document.getElementById("recipeDialog").open && document.getElementById("recipeFormTitle").textContent === "Rezept bearbeiten", "Bearbeiten geht nicht auf");
  expect((await B.page.$eval("#recipeIngredients", e => e.value)).split("\n").length === 3, "Zutaten nicht im Formular");
  await B.page.$eval("#recipeServings", e => { e.value = "8"; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await tap(B, "#recipeSubmitBtn");
  await toastIs(B, /gespeichert/);
  await goTab(B, "plan");
  await tap(B, '.prow[data-i="3"] .pday');
  const a2 = await B.page.evaluate(amt);
  await tap(B, '.prow[data-i="3"] .pday');
  expect(a1 && a2 && a1 !== a2, `Menge im Plan nicht neu gerechnet (${a1} → ${a2})`);
  void ctaBefore;
});

await step(B, "Katalog: «Anpassen» macht eine eigene Kopie (z.B. andere Personenzahl)", async () => {
  await tap(B, '.prow[data-i="2"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, '#catalogFilters [data-filter="all"]');
  const title = await B.page.$eval("#catalogList [data-edit]", b => b.closest(".recipe").querySelector("b").textContent);
  expect((await B.page.$eval("#catalogList [data-edit]", b => b.textContent)) === "Anpassen", "Katalog-Rezept: «Anpassen» fehlt");
  await tap(B, "#catalogList [data-edit]");
  await until(B, () => document.getElementById("recipeDialog").open && /eigene Kopie/.test(document.getElementById("recipeFormTitle").textContent), "Anpassen geht nicht auf");
  expect((await B.page.$eval("#recipeTitle", e => e.value)) === title && (await B.page.$eval("#recipeIngredients", e => e.value)).trim().length > 0, "Kopie nicht vorausgefüllt");
  await B.page.$eval("#recipeServings", e => { e.value = "2"; e.dispatchEvent(new Event("change", { bubbles: true })); });
  await tap(B, "#recipeSubmitBtn");
  await until(B, t => document.querySelector('.prow[data-i="2"] .t').textContent === t, "Kopie nicht eingeplant", title);
  const mine = await ls(B, "bringfrisch_custom_recipes");
  expect(mine.some(r => r.title === title && r.servings === 2), "Kopie mit 2 Personen nicht gespeichert");
});

await step(B, "Geteilte Rezepte: eigene gehen standardmässig an alle WGs, Rezepte einer anderen WG im Katalog («Andere WGs»)", async () => {
  // eigene Rezepte dieser WG liegen nach dem Speichern der Einstellungen im gemeinsamen Bestand
  for (let i = 0; i < 50 && !(kvJson("shared:wg1") || { recipes: [] }).recipes.length; i++) await new Promise(r => setTimeout(r, 100));
  const mine = kvJson("shared:wg1");
  expect(mine && mine.recipes.length > 0 && (kvJson("shared:index") || []).includes("wg1"), `eigene Rezepte nicht geteilt: ${JSON.stringify(mine)}`);
  // eine andere WG hat ein Rezept geteilt
  kv.set("shared:index", JSON.stringify([...(kvJson("shared:index") || []), "sonnenhof"]));
  kv.set("shared:sonnenhof", JSON.stringify({ name: "Sonnenhof", updated: 1, recipes: [{ id: "custom-9", title: "Sonnenhof-Curry", diet: "vegi", servings: 4, prep_time_min: 30, ingredients: [{ name: "Kichererbsen", amount: "400", unit: "g" }], season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }] }));
  await goTab(B, "wg");
  await tap(B, "#syncNowBtn");
  await until(B, () => (JSON.parse(localStorage.getItem("bringfrisch_shared_recipes") || "[]")).some(r => r.title === "Sonnenhof-Curry"), "geteiltes Rezept nicht abgeholt");
  await goTab(B, "plan");
  await tap(B, '.prow[data-i="3"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, '#catalogFilters [data-filter="shared"]');
  await until(B, () => { const r = [...document.querySelectorAll("#catalogList .recipe")]; return r.length === 1 && r[0].querySelector("b").textContent === "Sonnenhof-Curry" && /geteilt/.test(r[0].querySelector("small").textContent); }, "Filter «Andere WGs» zeigt das Rezept der anderen WG nicht");
  expect((await B.page.$eval("#catalogList [data-edit]", b => b.textContent)) === "Anpassen", "Rezept einer anderen WG: nur «Anpassen» (eigene Kopie), nicht bearbeiten");
  await tap(B, "#catalogList [data-assign]");
  await until(B, () => document.querySelector('.prow[data-i="3"] .t').textContent === "Sonnenhof-Curry", "Rezept der anderen WG nicht eingeplant");
  // neues eigenes Rezept: «Mit allen WGs teilen» ist vorgewählt
  await tap(B, '.prow[data-i="3"] .t');
  await tap(B, "#mlist [data-catalog]");
  await until(B, () => document.getElementById("catalogDialog").open, "Katalog geht nicht auf");
  await tap(B, '#catalogFilters [data-filter="all"]');
  await tap(B, "#newRecipeBtn");
  await until(B, () => document.getElementById("recipeDialog").open && document.getElementById("recipeShared").checked, "«Mit allen WGs teilen» nicht vorgewählt");
  await shot(B, "09b-rezept-teilen");
  await closeDialog(B, "recipeDialog");
});

await step(B, "Navigation: jeder Tab, kein seitliches Scrollen; keine JS-Fehler, nichts ins Internet", async () => {
  for (const t of ["shop", "season", "wg", "plan"]) { await goTab(B, t); await noHScroll(B, t); await shot(B, `10-${t}`); }
  expect(B.errors.length === 0, B.errors.join(" | "));
  expect(B.blocked.length === 0, `ins Internet: ${B.blocked.join(", ")}`);
});
await B.context.close();

// ---------------------------------------------------------------------------------------------
// Ablauf C: Android, hell, Donnerstag – nächste Woche planen; Montag: geplante Woche wird zur laufenden
// ---------------------------------------------------------------------------------------------
const C = await phone({
  name: "C-android-donnerstag", os: "android", scheme: "light", now: "2026-11-12T12:00:00",
  preset: { bringfrisch_sync: JSON.stringify({ url: WORKER, pin: PIN }), bringfrisch_me: JSON.stringify("joshua") },
});
let cur = [];
await step(C, "Donnerstag: Pop-up für KW 47, «Später», roter Punkt, Chip «KW 47 →»", async () => {
  await until(C, () => document.getElementById("syncStatus").textContent === "Verbunden ✓", "nicht verbunden");
  await until(C, () => !document.getElementById("wpop").hidden && document.getElementById("wpop").classList.contains("show"), "Pop-up fehlt");
  expect((await text(C, "#wpopText")).includes("KW 47"), "Pop-up nennt nicht KW 47");
  await tap(C, "#wlater");
  await until(C, () => document.getElementById("wpop").hidden, "Pop-up bleibt");
  expect(await C.page.$eval("#openVoteBtn", b => b.classList.contains("due")), "roter Punkt fehlt");
  expect((await text(C, "#weekChip")) === "KW 47 →", `Chip ${await text(C, "#weekChip")}`);
  cur = await titles(C);
  await shot(C, "01-donnerstag");
});

await step(C, "Chip → nächste Woche: 7 Tage «noch offen», nichts einzukaufen", async () => {
  await tap(C, "#weekChip");
  await until(C, () => document.getElementById("secTitle").textContent === "Nächste Woche" && document.querySelectorAll("#days .prow.unplanned").length === 7, "nächste Woche nicht offen");
  expect((await text(C, "#weekLabel")) === "KW 47 · nächste Woche" && (await text(C, "#weekChip")) === "← KW 46", "Beschriftung");
  expect((await titles(C)).every(t => t === "noch offen"), "Titel nicht «noch offen»");
  expect((await text(C, "#shopSummary")).startsWith("Nächste Woche (KW 47) · 0 Zutaten"), await text(C, "#shopSummary"));
  await tap(C, '.prow[data-i="0"] .pday');
  await until(C, () => /Noch kein Menü/.test(document.querySelector('.prow[data-i="0"] .ing').textContent), "Hinweis im offenen Tag fehlt");
  await tap(C, '.prow[data-i="0"] .pday');
  await shot(C, "02-naechste-woche");
  await noHScroll(C, "nächste Woche");
});

await step(C, "Offenen Tag planen: Gericht wählen, Plan der KW 47 beim WG-Server, Kalender nur für geplante Tage", async () => {
  await tap(C, '.prow[data-i="0"] .t');
  await until(C, () => document.getElementById("msheet").classList.contains("show"), "Blatt geht nicht auf");
  const t = await C.page.$eval("#mlist .opt[data-id] .n", e => e.textContent);
  await tap(C, "#mlist .opt[data-id]");
  await until(C, t => document.querySelector('.prow[data-i="0"] .t').textContent === t && !document.querySelector('.prow[data-i="0"]').classList.contains("unplanned"), "Tag nicht geplant", t);
  await until(C, () => !/ 0 Zutaten/.test(document.getElementById("shopSummary").textContent), "Einkauf zählt den geplanten Tag nicht");
  await waitPushed(C);
  const doc = kvJson("plan:2026-W47");
  expect(doc && doc.plan[0].title === t && doc.plan.slice(1).every(d => d.empty), "KW 47 nicht beim Server");
  expect(kvJson("plan").plan.map(d => d.title).join() === cur.join(), "laufende Woche verändert");
  const ics = await (await worker.fetch(new Request(`${WORKER}/cal/cal-test.ics`), env)).text();
  expect(ics.includes(":20261116T") && !ics.includes(":20261117T"), "Kalender: offene Tage drin oder Montag fehlt");
});

await step(C, "Chip zurück, dann seitlich wischen: nächste Woche und zurück", async () => {
  await tap(C, "#weekChip");
  await until(C, c => document.getElementById("secTitle").textContent === "Wochenplan" && [...document.querySelectorAll("#days .t")].map(e => e.textContent).join() === c, "nicht zurück zur laufenden Woche", cur.join());
  const y = await C.page.$eval('.prow[data-i="3"]', r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
  await settle(C);
  await swipe(C, 340, y, 60, y);
  await until(C, () => document.getElementById("secTitle").textContent === "Nächste Woche", "Wischen nach links wechselt nicht");
  await settle(C);
  await swipe(C, 60, y, 340, y);
  await until(C, () => document.getElementById("secTitle").textContent === "Wochenplan", "Wischen nach rechts wechselt nicht");
});

let w47 = [];
await step(C, "Kalender-Symbol mit rotem Punkt: Wochenwahl für KW 47, 1 Stimme, übernehmen → alle Tage geplant", async () => {
  await tap(C, "#openVoteBtn");
  await until(C, () => document.getElementById("voteDialog").open && document.querySelectorAll("#voteGrid .vcard").length === 14, "Wochenwahl geht nicht auf");
  expect((await text(C, "#voteSubtitle")).startsWith("KW 47 (nächste Woche)"), await text(C, "#voteSubtitle"));
  expect((await text(C, "#secTitle")) === "Nächste Woche", "Ansicht nicht auf nächster Woche");
  await likeCard(C, 4);
  await clearToasts(C);
  await tap(C, "#voteApplyBtn");
  await toastIs(C, /Plan übernommen \(6 ohne Stimme aufgefüllt\)/);
  expect((await count(C, "#days .prow.unplanned")) === 0, "noch offene Tage");
  expect(!(await C.page.$eval("#openVoteBtn", b => b.classList.contains("due"))), "roter Punkt noch da");
  w47 = await titles(C);
  await waitPushed(C);
  expect(kvJson("plan:2026-W47").plan.map(d => d.title).join() === w47.join(), "KW 47 nicht beim Server");
  await shot(C, "03-kw47-geplant");
  expect(C.errors.length === 0, C.errors.join(" | "));
});
await C.page.close();

const C2 = await phone({ name: "C2-android-montag", os: "android", scheme: "light", now: "2026-11-16T12:00:00", context: C.context });
await step(C2, "Montag: die geplante KW 47 ist jetzt die laufende Woche", async () => {
  expect((await text(C2, "#weekLabel")) === "KW 47 · November", await text(C2, "#weekLabel"));
  expect((await titles(C2)).join() === w47.join(), "Plan der KW 47 nicht übernommen");
  expect(await C2.page.$eval("#weekChip", c => c.hidden), "Chip am Montag sichtbar");
  await sleep(900);
  expect(await C2.page.$eval("#wpop", p => p.hidden), "Pop-up, obwohl schon gewählt");
  await shot(C2, "01-montag");
  expect(C2.errors.length === 0 && C2.blocked.length === 0, [...C2.errors, ...C2.blocked].join(" | "));
});

// ---------------------------------------------------------------------------------------------
// Ablauf D: iPhone, dunkel, ganz neues Handy – Willkommen (WG-Name + PIN), «Wer bist du?», Rechtliches
// ---------------------------------------------------------------------------------------------
const D = await phone({ name: "D-iphone-erster-start", os: "ios", scheme: "dark", now: "2026-11-10T12:00:00", preset: { bringfrisch_welcome: "false" } });
await step(D, "Erster Start: WG-Name + PIN, falscher PIN zeigt Fehler, dann «Wer bist du?» antippen", async () => {
  await until(D, () => document.getElementById("welcomeDialog").open && !document.getElementById("welcomeJoin").hidden, "Willkommen fehlt");
  expect((await count(D, "#welcomeJoin .legal a")) === 3, "Links Nutzungsbedingungen/Datenschutz/Cookies fehlen");
  await shot(D, "01-willkommen");
  D.allow.push(/status of 401/);
  await typeInto(D, "#welcomeWg", "WG1");
  await typeInto(D, "#welcomePin", "0000");
  await tap(D, '#welcomeJoin button[type="submit"]');
  await until(D, () => /Falscher/.test(document.getElementById("welcomeStatus").textContent), "Fehler bei falschem PIN fehlt");
  D.allow.pop();
  await typeInto(D, "#welcomePin", PIN);
  await tap(D, '#welcomeJoin button[type="submit"]');
  await until(D, () => !document.getElementById("welcomeWho").hidden && document.querySelectorAll("#welcomeMembers [data-me]").length > 1, "«Wer bist du?» fehlt");
  await shot(D, "02-wer-bist-du");
  const id = await D.page.$eval("#welcomeMembers [data-me]:last-child", b => b.dataset.me);
  await tap(D, "#welcomeMembers [data-me]:last-child");
  await until(D, () => !document.getElementById("welcomeDialog").open, "Willkommen bleibt offen");
  expect(await D.page.evaluate(() => JSON.parse(localStorage.getItem("bringfrisch_me"))) === id, "«Ich bin» nicht gespeichert");
  expect(await D.page.evaluate(() => JSON.parse(localStorage.getItem("bringfrisch_sync")).wg === "WG1" && !!JSON.parse(localStorage.getItem("bringfrisch_terms")).at), "WG-Name/Zustimmung nicht gemerkt");
  await until(D, () => document.getElementById("syncStatus").textContent === "Verbunden ✓", "nicht verbunden");
});
await step(D, "Du bist: eigener Kreis umrandet; Zeit pro Tag ändern gilt für alle (mit Name); Kalender nur meine Abende", async () => {
  await until(D, () => !document.getElementById("wpop").hidden, "nach dem Willkommen kommt die Wochenwahl nicht");
  await tap(D, "#wlater");
  await until(D, () => document.getElementById("wpop").hidden && !document.getElementById("wscrim").classList.contains("show"), "Pop-up bleibt");
  const me = await D.page.evaluate(() => JSON.parse(localStorage.getItem("bringfrisch_me")));
  expect((await count(D, '.prow[data-i="0"] .av.me')) === 1 && (await D.page.$eval('.prow[data-i="0"] .av.me', b => b.dataset.member)) === me, "eigener Kreis nicht umrandet");
  await tap(D, '.prow[data-i="0"] .pday');
  await until(D, () => document.querySelector('.prow[data-i="0"]').classList.contains("open"), "Tag geht nicht auf");
  await clearToasts(D);
  await pickNative(D, '.prow[data-i="0"] [data-time]', "20:15");
  await toastIs(D, /Montag: Znacht um 20:15 – gilt für alle/);
  const myName = await D.page.evaluate(id => JSON.parse(localStorage.getItem("bringfrisch_members")).find(m => m.id === id).name, me);
  expect((await text(D, '.prow[data-i="0"] .meta .by')) === `🕖 20:15 (${myName})`, "Zeit mit Name fehlt in der Zeile");
  await waitPushed(D);
  expect(kvJson("plan").plan[0].time === "20:15" && kvJson("plan").plan[0].time_by === myName, "Zeit nicht beim WG-Server");
  await shot(D, "03-zeit-pro-tag");
  await goTab(D, "wg");
  expect((await D.page.$eval("#meSelect", s => s.value)) === me, "«Du bist» zeigt nicht mich");
  // wie ein Android-Handy: Abo über Google Kalender
  await D.page.evaluate(() => { window.__opened = ""; Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 (Linux; Android 15; Pixel 8)" }); });
  await D.page.$eval("#setMore", d => { d.open = true; });
  await clearToasts(D);
  await tap(D, "#calendarBtn");
  await until(D, () => /calendar\.google\.com\/calendar\/r\?cid=webcal/.test(window.__opened), "Google Kalender öffnet nicht");
  const opened = decodeURIComponent(await D.page.evaluate(() => window.__opened));
  expect(opened.includes(`/cal/cal-test.ics?me=${me}`), `Abo nicht persönlich: ${opened}`);
  await shot(D, "04-kalender");
});
await step(D, "Einstellungen: kleine Links, Datenschutz öffnet die Seite Rechtliches", async () => {
  await tap(D, '[data-tab="wg"]');
  expect((await count(D, "#legalLinks a")) === 3, "Links in den Einstellungen fehlen");
  await D.page.$eval("#legalLinks", e => e.scrollIntoView());
  await Promise.all([D.page.waitForNavigation({ waitUntil: "load" }), tap(D, '#legalLinks a[href$="#datenschutz"]')]);
  expect(/Rechtliches/.test(await text(D, "h1")) && /keine Cookies/i.test(await text(D, "#cookies + p")), "Seite Rechtliches falsch");
  await shot(D, "05-rechtliches");
  expect(D.errors.length === 0, D.errors.join(" | "));
});
await D.context.close();

await browser.close();
server.close();
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
