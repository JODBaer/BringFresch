// Lädt static/index.html für jsdom: jedes <script src="…"> wird durch den Inhalt der Datei ersetzt (jsdom lädt keine
// Dateien nach). Die App besteht aus mehreren klassischen Skripten (app.js = Grundlage, app_*.js = Ansichten, Abgleich,
// Theme, Start) mit gemeinsamem Namensraum BF_APP – sie laufen in der Reihenfolge von index.html, wie im Browser.
// Bricht laut ab, wenn eine Datei fehlt oder ein <script src> nicht ersetzt werden kann (z.B. type="module", defer).
const fs = require("fs");
const path = require("path");

const SCRIPT_RE = /<script src="([^"]+)"><\/script>/g;

// Dateien, die index.html lädt (in Reihenfolge)
function appScripts(root) {
  const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
  return [...page.matchAll(SCRIPT_RE)].map(m => m[1]);
}

function appHtml(root, read = f => fs.readFileSync(path.join(root, f), "utf8")) {
  const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const html = page.replace(SCRIPT_RE, (_, f) => {
    const code = read(f);
    if (/<\/script/i.test(code)) throw new Error(`app_html: ${f} enthält «</script» – so nicht einbettbar`);
    return `<script>${code}</script>`;
  });
  const left = html.match(/<script[^>]*\bsrc=/i);
  if (left) throw new Error(`app_html: nicht ersetztes Skript in index.html: ${left[0]}`);
  return html;
}

module.exports = { appHtml, appScripts, SCRIPT_RE };
