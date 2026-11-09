// Bring!-Artikelkatalog (de-CH) holen -> static/bring_catalog.js
// Artikel mit Katalog-Namen bekommen in Bring! automatisch das passende Bild.
//   node tools/update_bring_catalog.mjs
import { writeFileSync } from "node:fs";

const res = await fetch("https://web.getbring.com/locale/catalog.de-CH.json");
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const { catalog } = await res.json();
const items = {};
const NON_FOOD = /Haushalt|Pflege|Tierbedarf|Baumarkt/;
for (const s of catalog.sections) {
  if (NON_FOOD.test(s.sectionId)) continue; // nur Lebensmittel (sonst wird «Sesamsamen» zu Garten-Samen)
  for (const it of s.items) if (!/^(Zigar|Bring!|Vielen Dank)/.test(it.itemId)) items[it.itemId] = it.name; // itemId (Bring-intern) -> Anzeigename de-CH
}
const out = new URL("../static/bring_catalog.js", import.meta.url);
writeFileSync(out,
  "// Automatisch erzeugt von tools/update_bring_catalog.mjs – nicht von Hand bearbeiten.\n" +
  "// Bring!-Katalog de-CH (nur Lebensmittel): itemId -> Anzeigename. Katalog-Artikel haben in Bring! ein Bild.\n" +
  "window.BRING_CATALOG = " + JSON.stringify(items) + ";\n", "utf8");
console.log(`${Object.keys(items).length} Katalog-Artikel -> static/bring_catalog.js`);
