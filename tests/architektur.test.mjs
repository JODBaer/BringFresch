// Architektur-Übersicht (docs/design/obsonare-architektur.html) bleibt ehrlich: jede genannte Funktion gibt es im Code,
// «a() & b() in datei.js» steht wirklich in dieser Datei, jedes #id / .klasse aus «selector» gibt es in der App,
// Screen-Verweise und die Klick-Zuordnung (docs/design/architektur/bridge.js) zeigen auf vorhandene Screens/Elemente.
// Ob das eingebaute Handy dem Stand von static/ entspricht, wird nur gemeldet (neu bauen: node tools/build_architektur.mjs).
// Start: cd tests && node architektur.test.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OVERVIEW = path.join(ROOT, "docs/design/obsonare-architektur.html");
let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`FAIL  ${msg}`); fails++; } return ok; };

if (!existsSync(OVERVIEW)) {
  console.log("PASS  keine Architektur-Übersicht vorhanden – nichts zu prüfen");
  process.exit(0);
}
const html = readFileSync(OVERVIEW, "utf8");
const m = /const SCREENS = (\[[\s\S]*?\n\]);/.exec(html);
if (!check(!!m, "obsonare-architektur.html: «const SCREENS = [ … ];» gefunden")) process.exit(1);
const SCREENS = new Function(`return ${m[1]}`)();

// Code: Dateiname → Inhalt (static/*.js und worker/src/*.js)
const code = {};
for (const f of readdirSync(path.join(ROOT, "static")).filter(f => f.endsWith(".js"))) code[`static/${f}`] = readFileSync(path.join(ROOT, "static", f), "utf8");
for (const f of readdirSync(path.join(ROOT, "worker/src")).filter(f => f.endsWith(".js"))) code[`worker/src/${f}`] = readFileSync(path.join(ROOT, "worker/src", f), "utf8");
const fileOf = name => code[name] != null ? name : code[`static/${name}`] != null ? `static/${name}` : null;
const defines = (src, n) => new RegExp(
  `(function\\s+${n}\\b|\\b${n}\\s*[:=]\\s*(async\\s*)?(function|\\(|[\\w$]+\\s*=>)|^\\s*(async\\s+)?${n}\\s*\\([^)]*\\)\\s*\\{)`, "m").test(src);
const definedAnywhere = n => Object.values(code).some(src => defines(src, n));
const bare = n => n.replace(/^.*\./, "");
const page = readFileSync(path.join(ROOT, "static/index.html"), "utf8");
const appText = page + Object.entries(code).filter(([f]) => f.startsWith("static/")).map(([, s]) => s).join("\n");

const screenIds = new Set(SCREENS.map(s => s.id));
const elKeys = new Map(SCREENS.flatMap(s => s.elements.map(e => [e.key, s.id])));
let names = 0, pairs = 0, sels = 0;

for (const s of SCREENS) {
  for (const id of [...(s.from || []), ...(s.to || [])]) check(screenIds.has(id), `${s.id}: Verweis auf unbekannten Screen «${id}»`);
  for (const f of String(s.files || "").split("·").map(x => x.trim()).filter(Boolean)) check(existsSync(path.join(ROOT, f)), `${s.id}: Datei ${f} gibt es nicht`);
  for (const el of s.elements) {
    const texts = [el.fn, el.desc, ...Object.values(el.pipe || {})].join("\n");
    // 1. jede «name()» gibt es im Code
    for (const [, n] of texts.matchAll(/([A-Za-z_$][\w$.]*)\(/g)) {
      names++;
      check(definedAnywhere(bare(n)), `${el.key}: ${n}() gibt es im Code nicht`);
    }
    // 2. «a() & b() in datei.js»: steht in genau dieser Datei
    for (const [, group, file] of String(el.fn).matchAll(/((?:[\w$.]+\([^)]*\)\s*&?\s*)+)\s+in\s+([\w/.]+\.js)/g)) {
      const f = fileOf(file);
      if (!check(!!f, `${el.key}: Datei ${file} gibt es nicht`)) continue;
      for (const [, n] of group.matchAll(/([\w$.]+)\(/g)) {
        pairs++;
        check(defines(code[f], bare(n)), `${el.key}: ${n}() steht nicht in ${f}`);
      }
    }
    // 3. #id und .klasse aus dem Selektor gibt es in der App
    for (const [, id] of String(el.selector).matchAll(/#([\w-]+)/g)) { sels++; check(page.includes(`id="${id}"`), `${el.key}: #${id} fehlt in static/index.html`); }
    for (const [, c] of String(el.selector).matchAll(/\.([\w-]+)/g)) { sels++; check(new RegExp(`class="[^"]*\\b${c}\\b|classList\\.\\w+\\("${c}"`).test(appText), `${el.key}: .${c} kommt in der App nicht vor`); }
  }
}

// 4. Klick im Handy → Screen + Element müssen zusammenpassen (sonst springt der Inspektor nicht)
const bridge = readFileSync(path.join(ROOT, "docs/design/architektur/bridge.js"), "utf8");
for (const [, scr, key] of bridge.matchAll(/screen = "([\w-]+)"; elKey = "([\w-]+)"/g)) {
  check(screenIds.has(scr), `bridge.js: unbekannter Screen «${scr}»`);
  check(elKeys.get(key) === scr, `bridge.js: Element «${key}» gehört nicht zu Screen «${scr}»`);
}

// 5. eingebautes Handy aktuell? (nur Hinweis – Änderungen an static/ sollen andere nicht rot machen)
const { buildSrcdoc, encode } = await import(pathToFileURL(path.join(ROOT, "tools/build_architektur.mjs")).href);
const line = /^const APP_SRCDOC = .*$/m.exec(html);
if (line && line[0] !== encode(buildSrcdoc())) console.log("HINWEIS  Architektur-Übersicht: eingebautes Handy ist älter als static/ → node tools/build_architektur.mjs");

console.log(fails ? `FAIL  Architektur-Übersicht: ${fails} Fehler` : `PASS  Architektur-Übersicht: ${names} Funktionsnamen, ${pairs} Datei-Zuordnungen, ${sels} Selektoren, ${SCREENS.length} Screens stimmen`);
process.exit(fails ? 1 : 0);
