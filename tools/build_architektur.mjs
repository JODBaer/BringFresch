// Baut das Live-Handy in docs/design/obsonare-architektur.html neu aus der echten App (static/).
// Die Übersicht trägt die App als APP_SRCDOC in sich (läuft so auch per Doppelklick, ohne Server).
// Dazu kommen die Demo-Teile aus docs/design/architektur/: shim.js (Speicher-Ersatz), demo.js
// (feste Uhr, nachgebauter WG-Server + Bring!), bridge.js (Klicks ↔ Inspektor), xray.css (Rahmen).
//
//   node tools/build_architektur.mjs          # neu schreiben
//   node tools/build_architektur.mjs --check  # nur prüfen, ob das eingebaute Handy dem Stand von static/ entspricht
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERVIEW = join(ROOT, "docs/design/obsonare-architektur.html");
const PARTS = join(ROOT, "docs/design/architektur");
const read = p => readFileSync(p, "utf8");
const part = name => read(join(PARTS, name));

export function buildSrcdoc() {
  let html = read(join(ROOT, "static/index.html"));
  // Schriften und Bilder relativ zu static/ (die Übersicht liegt in docs/design/)
  html = html.replace(/<head>/, `<head>\n<base href="../../static/">\n<script>\n${part("shim.js")}<\/script>`);
  // Manifest/Icons/Preload braucht das eingebaute Handy nicht
  html = html.replace(/^[ \t]*<link rel="(?:preload|manifest|apple-touch-icon|icon)"[^>]*>\r?\n/gm, "");
  html = html.replace(/<link rel="stylesheet" href="app\.css">/, () => `<style>${read(join(ROOT, "static/app.css"))}\n${part("xray.css")}</style>`);
  let first = true;
  html = html.replace(/<script src="([\w.]+\.js)"><\/script>/g, (_, file) => {
    const pre = first ? `<script>\n${part("demo.js")}<\/script>\n  ` : "";
    first = false;
    return `${pre}<script>\n/* === ${file} === */\n${read(join(ROOT, "static", file))}\n<\/script>`;
  });
  if (first) throw new Error("static/index.html: keine <script src> gefunden");
  html = html.replace(/<\/body>/, `<script>\n${part("bridge.js")}<\/script>\n</body>`);
  return html;
}

const LINE = /^const APP_SRCDOC = .*$/m;
export const encode = doc => `const APP_SRCDOC = ${JSON.stringify(doc).replace(/<\//g, "<\\/")};`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const overview = read(OVERVIEW);
  if (!LINE.test(overview)) throw new Error("obsonare-architektur.html: Zeile «const APP_SRCDOC = …» fehlt");
  const next = overview.replace(LINE, () => encode(buildSrcdoc()));
  if (process.argv.includes("--check")) {
    if (next !== overview) {
      console.log("Architektur-Übersicht: eingebautes Handy ist älter als static/ → node tools/build_architektur.mjs");
      process.exit(1);
    }
    console.log("Architektur-Übersicht: eingebautes Handy ist aktuell");
  } else {
    writeFileSync(OVERVIEW, next);
    console.log("docs/design/obsonare-architektur.html neu gebaut");
  }
}
