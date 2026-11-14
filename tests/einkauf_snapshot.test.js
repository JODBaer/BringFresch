// Sicherheitsnetz für Umbauten: Einkaufsliste (Name, Menge, Gruppe) für alle Rezepte als fester Stand.
// Je 7 Rezepte bilden eine Woche (Standard-WG, +2 Reste). Jede Abweichung muss bewusst bestätigt werden:
//   cd tests && node einkauf_snapshot.test.js --update   -> schreibt snapshots/einkauf.json neu
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");
const { fixWindow, STANDARD_NOW } = require("./determinism");
const { appHtml } = require("./app_html");

const root = process.argv.slice(2).find(a => !a.startsWith("--")) || path.join(__dirname, "..", "static");
const html = appHtml(root); // alle <script src> aus index.html eingebettet (app_html.js)
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

const data = {};
new Function("window", fs.readFileSync(path.join(root, "standalone_data.js"), "utf8") + fs.readFileSync(path.join(root, "recipes_imported.js"), "utf8"))(data);
const recipes = [...(data.OBSONARE_DATA.recipes || []), ...(data.OBSONARE_IMPORTED || [])];
const eaters = ["joshua", "lukas", "leonie", "jo"];

function week(list) {
  const plan = Array.from({ length: 7 }, (_, i) => list[i]
    ? { ...list[i], eaters, leftover_buffer: 2, extra_guests: 0 }
    : { id: "leer-" + i, title: "Noch offen", empty: true, eaters: [], ingredients: [], leftover_buffer: 0, extra_guests: 0 });
  const dom = new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      win.localStorage.setItem("bringfrisch_welcome", "true");
      win.localStorage.setItem("bringfrisch_current_plan", JSON.stringify(plan));
      fixWindow(win, { now: STANDARD_NOW });
    }
  });
  const d = dom.window.document, out = {};
  d.querySelector(`#tab-shop .seg button[data-filter="toBuy"]`).click();
  out.toBuy = [...d.querySelectorAll("#shopList [data-shop]")].map(b => `${b.dataset.shop} | ${b.querySelector(".amt").textContent.trim()}`).sort((a, b) => a.localeCompare(b, "de"));
  // Grundvorrat-Zutaten der Woche: der Bereich «Vorrat» zeigt seit Variante C die Vorrat-Artikel, nicht die Zutaten
  out.staples = dom.window.BF_APP.state.shopping.filter(it => it.isStaple).map(it => `${it.name} | ${it.spec}`).sort((a, b) => a.localeCompare(b, "de"));
  dom.window.close();
  return out;
}

const got = {};
for (let i = 0; i < recipes.length; i += 7) {
  const list = recipes.slice(i, i + 7);
  got[list.map(r => r.id).join(" + ")] = week(list);
}
check(errors.length === 0, `keine JS-Fehler ${errors.join(" | ")}`);
const snapFile = path.join(__dirname, "snapshots", "einkauf.json");
if (process.argv.includes("--update") || !fs.existsSync(snapFile)) {
  fs.mkdirSync(path.dirname(snapFile), { recursive: true });
  fs.writeFileSync(snapFile, JSON.stringify(got, null, 1) + "\n");
  console.log(`INFO  snapshots/einkauf.json geschrieben`);
}
const want = JSON.parse(fs.readFileSync(snapFile, "utf8"));
let lines = 0;
for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) {
  for (const g of ["toBuy", "staples"]) {
    const a = (want[k] || {})[g] || [], b = (got[k] || {})[g] || [];
    lines += b.length;
    const plus = b.filter(x => !a.includes(x)), minus = a.filter(x => !b.includes(x));
    if (plus.length || minus.length) check(false, `${g} geändert in Woche «${k.slice(0, 60)}…»\n      neu:   ${plus.join("; ") || "–"}\n      fehlt: ${minus.join("; ") || "–"}`);
  }
}
check(lines > 500, `${recipes.length} Rezepte in ${Object.keys(got).length} Wochen, ${lines} Zeilen wie festgehalten`);
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
