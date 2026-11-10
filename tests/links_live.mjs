// Rezept-Links prüfen (von Hand, braucht Internet – nie in CI):
//   cd tests && node links_live.mjs
// Öffnet jeden source_url im echten Browser (Edge/Chrome) und prüft, ob die Seite wirklich das Rezept zeigt:
// keine Weiterleitung auf eine andere Seite, kein 404, und der Seitentitel passt zum Rezepttitel.
// Höflich: ein Link nach dem anderen, mit Pause.
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["standalone_data.js", "recipes_imported.js"]) vm.runInContext(readFileSync(path.join(here, "../static", f), "utf8"), ctx);
const recipes = [...ctx.window.BRINGFRISCH_DATA.recipes, ...ctx.window.BRINGFRISCH_IMPORTED].filter(r => r.source_url);

const browserPath = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(p => p && existsSync(p));
if (!browserPath) { console.log("Kein Chromium-Browser gefunden (BROWSER=… setzen)"); process.exit(1); }

// Wörter für den Vergleich: klein, ohne Umlaute, ohne Füllwörter
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ");
const STOP = new Set(["mit", "und", "an", "am", "im", "in", "der", "die", "das", "dem", "den", "vom", "von", "zu", "aus", "auf", "fur", "schweizer", "klassische", "klassisches", "rezept", "rezepte"]);
const words = s => norm(s).split(" ").filter(w => w.length > 2 && !STOP.has(w));
const stem = w => w.slice(0, 5); // Kürbis/Kürbissuppe, Gschwellti/Gschwelltis

const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage();
const bad = [];
for (const r of recipes) {
  let why = "";
  try {
    const res = await page.goto(r.source_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res ? res.status() : 0;
    const final = page.url().replace(/[?#].*$/, "");
    const heading = await page.evaluate(() => `${document.title} ${(document.querySelector("h1") || {}).innerText || ""}`);
    const want = words(r.title).map(stem);
    const have = new Set(words(heading).map(stem));
    const hit = want.filter(w => have.has(w)).length;
    if (status >= 400) why = `HTTP ${status}`;
    else if (final !== r.source_url.replace(/[?#].*$/, "")) why = `weitergeleitet auf ${final}`;
    else if (want.length && hit === 0) why = `Seite heisst «${heading.trim().slice(0, 80)}»`;
  } catch (e) {
    why = e.message;
  }
  console.log(`${why ? "✗" : "✓"} ${r.id}${why ? ` – ${why}` : ""}`);
  if (why) bad.push(r.id);
  await new Promise(z => setTimeout(z, 800));
}
await browser.close();
console.log(`\n${recipes.length - bad.length}/${recipes.length} Links zeigen das richtige Rezept.${bad.length ? `\nFalsch: ${bad.join(", ")}\n→ richtigen Link auf der Rezeptseite suchen oder source_url entfernen (App zeigt dann «Rezept suchen» auf Fooby).` : ""}`);
process.exit(bad.length ? 1 : 0);
