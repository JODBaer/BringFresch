// Zutaten-Abgleich: alle Zutaten aller Rezepte durch Grundvorrat- und Bring!-Abgleich (ganze Wörter, keine Teilwörter).
// Start: cd tests && node zutaten.test.js   (--update schreibt snapshots/vorrat_treffer.json neu, nach bewusster Änderung)
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");
const { fixWindow, STANDARD_NOW } = require("./determinism");
const { appHtml } = require("./app_html");

const root = process.argv.find(a => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) || path.join(__dirname, "..", "static");
const html = appHtml(root); // alle <script src> aus index.html eingebettet (app_html.js)
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// Alle Zutaten aus den Rezeptdaten
const data = {};
new Function("window", fs.readFileSync(path.join(root, "standalone_data.js"), "utf8") + fs.readFileSync(path.join(root, "recipes_imported.js"), "utf8"))(data);
const recipes = [...(data.OBSONARE_DATA.recipes || []), ...(data.OBSONARE_IMPORTED || [])];
const names = [...new Set(recipes.flatMap(r => (r.ingredients || []).map(i => i.name.trim())))].sort((a, b) => a.localeCompare(b, "de"));

// Ein Plan: Montag enthält jede Zutat einmal, die übrigen Tage sind offen (kaufen nichts)
const day = (title, extra) => ({ id: "test-" + title, title, diet: "fleisch", servings: 4, eaters: ["joshua"], leftover_buffer: 0, extra_guests: 0, ingredients: [], ...extra });
const plan = (ingredients) => [
  day("Alles", { no_addons: true, ingredients }),
  ...["Di", "Mi", "Do", "Fr", "Sa", "So"].map(t => day(t, { empty: true })),
];

function boot(ingredients, bringItems) {
  return new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      const preset = { bringfrisch_welcome: true, bringfrisch_current_plan: plan(ingredients), bringfrisch_plan_updated: 9e15 };
      if (bringItems) preset.bringfrisch_sync = { url: "https://wg.test", pin: "1" };
      Object.entries(preset).forEach(([k, v]) => win.localStorage.setItem(k, JSON.stringify(v)));
      fixWindow(win, { now: STANDARD_NOW });
      // WG-Server-Attrappe: nur der Bring!-Stand zählt
      win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, updated: 1, plan: null, staples: null, settings: null, items: bringItems || [] }) });
    }
  });
}
const group = (d, filter) => {
  // «Vorrat» zeigt seit Variante C die Vorrat-Artikel; die Grundvorrat-Zutaten stehen im Zustand der App
  if (filter === "staples") return d.defaultView.BF_APP.state.shopping.filter(it => it.isStaple).map(it => it.name);
  d.querySelector(`#tab-shop .seg button[data-filter="${filter}"]`).click();
  return [...d.querySelectorAll("#shopList [data-shop]")].map(b => b.dataset.shop);
};

(async () => {
  // 1. Grundvorrat: was gilt als «haben wir»?
  const dom = boot(names.map(name => ({ name, amount: "100", unit: "g" })));
  const d = dom.window.document;
  check(errors.length === 0, `keine JS-Fehler ${errors.join(" | ")}`);
  const staples = group(d, "staples").sort((a, b) => a.localeCompare(b, "de"));
  const toBuy = group(d, "toBuy");
  check(names.length > 400 && toBuy.length > 300, `${names.length} Zutaten geprüft, ${toBuy.length} zu kaufen, ${staples.length} Grundvorrat`);

  const mustBuy = ["Mehlig kochende Kartoffeln", "Pfefferminze", "Rote Currypaste", "Gelbe Currypaste", "Massaman-Currypaste", "Kleine Essiggurke",
    "Chilischote", "Chili-Öl", "Thymian und Basilikum", "Ingwer-Knoblauch-Paste", "Frischkäse mit Kräutern", "Kräuterkäse", "Ungesalzene Cashewkerne", "Paniermehl", "Buchweizenmehl", "Dinkelmehl hell", "Meersalz mit Chili"];
  for (const n of mustBuy) check(toBuy.includes(n) && !staples.includes(n), `«${n}» ist kein Grundvorrat (steht auf der Einkaufsliste)`);
  const mustStaple = ["Knoblauchzehen", "Knoblauchzehe", "Zimtpulver", "Lorbeerblätter", "Weissmehl", "Pfeffer aus der Mühle", "Schwarzer Pfeffer", "Chiliflocken",
    "Currypulver mild/scharf", "Gemüsebouillon", "Muskatnuss", "Aceto balsamico", "Madras-Curry", "Edelsüss-Paprika", "Muskatnuss & Lorbeerblatt", "Grobkörniger Senf", "Flüssiger Honig", "Olivenöl extra vergine"];
  for (const n of mustStaple) check(staples.includes(n), `«${n}» gilt als Grundvorrat`);

  // Fester Stand aller Treffer: jede Änderung am Abgleich muss hier bewusst bestätigt werden
  const snapFile = path.join(__dirname, "snapshots", "vorrat_treffer.json");
  if (process.argv.includes("--update") || !fs.existsSync(snapFile)) {
    fs.mkdirSync(path.dirname(snapFile), { recursive: true });
    fs.writeFileSync(snapFile, JSON.stringify(staples, null, 1) + "\n");
    console.log(`INFO  ${path.relative(process.cwd(), snapFile)} geschrieben (${staples.length})`);
  }
  const want = JSON.parse(fs.readFileSync(snapFile, "utf8"));
  const plus = staples.filter(n => !want.includes(n)), minus = want.filter(n => !staples.includes(n));
  check(!plus.length && !minus.length, `Grundvorrat-Treffer wie festgehalten${plus.length ? ` – neu: ${plus.join(", ")}` : ""}${minus.length ? ` – fehlt: ${minus.join(", ")}` : ""}`);
  dom.window.close();

  // 2. «Schon auf Bring!»: gleicher Name oder gleicher Bring!-Artikel, keine Teilwörter
  const some = ["Butternuss-Kürbis", "Butterblätterteig", "Butter", "Doppelrahm", "Kokosmilch", "Milch", "Reis", "Rüebli", "Zwiebel", "Rote Currypaste"];
  const dom2 = boot(some.map(name => ({ name, amount: "100", unit: "g" })), ["Butter", "Rahm", "Milch", "Ei", "Karotten", "Zwiebeln", "Rote Currypaste"]);
  const d2 = dom2.window.document;
  await wait(50);
  const on = group(d2, "onBring"), buy = group(d2, "toBuy");
  for (const n of ["Butternuss-Kürbis", "Butterblätterteig", "Kokosmilch", "Reis"]) check(buy.includes(n) && !on.includes(n), `«${n}» fehlt noch auf Bring! (Teilwort zählt nicht)`);
  for (const n of ["Butter", "Milch", "Rüebli", "Zwiebel", "Rote Currypaste"]) check(on.includes(n), `«${n}» steht schon auf Bring! (gleicher Name / gleicher Bring!-Artikel)`);
  check(errors.length === 0, `keine JS-Fehler ${errors.join(" | ")}`);
  dom2.window.close();

  console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
  process.exit(fails ? 1 : 0);
})();
