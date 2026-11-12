// Offline-Liste: alles, was index.html lädt (Skripte, CSS, Schrift, Symbole, Manifest), muss in STATIC_ASSETS von
// static/sw.js stehen – sonst fehlt die Datei offline und die App startet nicht. Prüft auch die Reihenfolge der
// App-Skripte (app.js = Grundlage zuerst, app_start.js zuletzt) und dass der Test-Lader (app_html.js) alles einbettet.
// Start: cd tests && node assets.test.mjs
import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { appHtml, appScripts } = require("./app_html.js");

const root = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "static");
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; return ok; };

const page = readFileSync(path.join(root, "index.html"), "utf8");
const sw = readFileSync(path.join(root, "sw.js"), "utf8");
const list = /const STATIC_ASSETS = \[([\s\S]*?)\];/.exec(sw);
check(!!list, "sw.js: STATIC_ASSETS gefunden");
const assets = list ? [...list[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map(m => (m[1] || m[2]).replace(/^\.\//, "")) : [];
check(/const CACHE_NAME = '[^']+'/.test(sw), "sw.js: CACHE_NAME gefunden");

// Was index.html lädt: Skripte + lokale Links (CSS, Schrift, Manifest, Symbole)
const scripts = appScripts(root);
const links = [...page.matchAll(/<link [^>]*href="([^"]+)"/g)].map(m => m[1]).filter(h => !/^[a-z]+:|^\/\//i.test(h));
check(scripts.length > 0, `index.html lädt ${scripts.length} Skripte`);
for (const f of [...scripts, ...links, "index.html", "rechtliches.html"]) {
  check(assets.includes(f), `${f} steht in STATIC_ASSETS`);
}
for (const f of assets) if (f) check(existsSync(path.join(root, f)), `STATIC_ASSETS: ${f} existiert`);
check(new Set(assets).size === assets.length, "STATIC_ASSETS ohne doppelte Einträge");
// Keine App-Datei vergessen: jede app*.js in static/ wird auch geladen
const appFiles = readdirSync(root).filter(f => /^app(_[a-z]+)?\.js$/.test(f));
for (const f of appFiles) check(scripts.includes(f), `${f} wird von index.html geladen`);

// Reihenfolge: Regeln/Speicher vor der App, app.js (legt BF_APP an) vor den Ansichten, app_start.js zuletzt
const at = f => scripts.indexOf(f);
check(at("core.js") >= 0 && at("store.js") >= 0 && at("core.js") < at("app.js") && at("store.js") < at("app.js"), "core.js und store.js vor app.js");
check(scripts.filter(f => /^app_/.test(f)).every(f => at(f) > at("app.js")), "app_*.js nach app.js");
const last = scripts.includes("app_start.js") ? "app_start.js" : "app.js";
check(at(last) === scripts.length - 1, `${last} als letztes Skript`);
check(!/<script[^>]*type="module"/.test(page), "keine Module (jsdom-Tests betten klassische Skripte ein)");

// Test-Lader: jedes Skript eingebettet, keins übrig
let html = "";
try { html = appHtml(root); } catch (e) { check(false, String(e.message)); }
check(html && !/<script[^>]*\bsrc=/.test(html), "app_html.js bettet alle Skripte ein");
check((html.match(/<script>/g) || []).length >= scripts.length, "alle Skripte eingebettet (Anzahl)");

console.log(fails ? `\nFAIL: ${fails}` : "\nPASS: Offline-Liste vollständig");
process.exit(fails ? 1 : 0);
