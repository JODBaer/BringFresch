// Hofläden, Märkte und Hofautomaten aus OpenStreetMap holen -> static/hoflaeden.js
// Gebiet: Zürich – Rapperswil-Jona – Zürcher Oberland. Daten © OpenStreetMap-Mitwirkende (ODbL).
//   node tools/update_hoflaeden.mjs            (hinter einem Proxy: NODE_USE_ENV_PROXY=1 node tools/update_hoflaeden.mjs)
// Einmal holen, ins Repo legen; die App fragt OpenStreetMap nie nach Daten (nur die Kartenbilder beim Öffnen).
import { writeFileSync } from "node:fs";

const BBOX = "47.15,8.45,47.45,9.0"; // Süd, West, Nord, Ost
const query = `[out:json][timeout:100];
(
  nwr["shop"="farm"](${BBOX});
  nwr["shop"="greengrocer"]["organic"~"yes|only"](${BBOX});
  nwr["amenity"="marketplace"](${BBOX});
  nwr["amenity"="vending_machine"]["vending"~"milk|eggs|fruit|vegetables|cheese|meat|potatoes|food|farm"](${BBOX});
  node["place"]["name"~"^(Robenhausen)$"](${BBOX});
);
out center tags;`;

// Von Hand ergänzt (fehlt in OpenStreetMap oder hat dort keine Zeiten). Quelle jeweils dabei.
// match: Name in OSM (dann werden nur fehlende Angaben ergänzt); place: sonst an diesem Ort (OSM place-Punkt) neu anlegen.
const EXTRA = [
  // https://www.rapperswil-zuerichsee.ch/de/besuchen/shopping/wochenmarkt-robenhausen-wetzikon (von Hand abgelesen 15.11.2026:
  // «Von März bis November, jeden Samstag von 08.00 bis 11.00 Uhr», Dorfstrasse 15, 8620 Wetzikon)
  { match: /Robenhausen/i, place: "Robenhausen", n: "Wochenmarkt Robenhausen", k: "markt", ort: "Wetzikon", adr: "Dorfstrasse 15", oh: "Mar-Nov Sa 08:00-11:00", web: "https://www.rapperswil-zuerichsee.ch/de/besuchen/shopping/wochenmarkt-robenhausen-wetzikon" }
];

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "BringFresch-hoflaeden/1.0 (+https://github.com/jodbaer/BringFresch; monatlicher Abruf)" },
  signal: AbortSignal.timeout(120000),
  body: "data=" + encodeURIComponent(query)
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const { elements } = await res.json();

const r5 = x => Math.round(x * 1e5) / 1e5;
const kindOf = t => (t.amenity === "marketplace" ? "markt" : t.amenity === "vending_machine" ? "automat" : "hof");
const VEND = { milk: "Milch", eggs: "Eier", fruit: "Obst", vegetables: "Gemüse", cheese: "Käse", meat: "Fleisch", potatoes: "Kartoffeln" };
const items = [];
const places = {};
for (const e of elements) {
  const t = e.tags || {};
  if (t.place) { places[t.name] = { lat: e.lat, lon: e.lon }; continue; }
  const k = kindOf(t);
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat == null) continue;
  if (k === "markt" && !t.name) continue; // namenlose Plätze sind meist keine Wochenmärkte
  if (k === "markt" && /parkplatz|parking/i.test(t.name)) continue;
  const was = (t.vending || "").split(";").map(v => VEND[v.trim()]).filter(Boolean).join(", ");
  const name = t.name || (k === "automat" ? `Hofautomat${was ? ` (${was})` : ""}` : t.operator || "Hofladen");
  const it = { n: name, k, lat: r5(lat), lon: r5(lon) };
  const ort = t["addr:city"] || t["addr:place"];
  if (ort) it.ort = ort;
  const adr = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  if (adr) it.adr = adr;
  if (t.opening_hours) it.oh = t.opening_hours;
  const web = t.website || t["contact:website"];
  if (web && /^https?:\/\//.test(web)) it.web = web;
  if (t.organic === "only" || t.organic === "yes") it.bio = 1;
  items.push(it);
}
for (const { match, place, ...x } of EXTRA) {
  const fill = Object.fromEntries(Object.entries(x).filter(([, v]) => v !== ""));
  const dup = items.find(i => i.k === x.k && match.test(i.n));
  if (dup) { // Angaben von Hand (Zeiten, Link) sind neuer als OSM
    for (const [key, v] of Object.entries(fill)) if (!dup[key] || key === "web" || key === "oh") dup[key] = v;
    continue;
  }
  const at = places[place];
  if (!at) { console.warn(`EXTRA ${x.n}: Ort ${place} nicht gefunden – übersprungen`); continue; }
  items.push({ ...fill, lat: r5(at.lat), lon: r5(at.lon) });
}
items.sort((a, b) => a.k.localeCompare(b.k) || a.n.localeCompare(b.n, "de"));

const stand = new Date().toISOString().slice(0, 10);
const out = new URL("../static/hoflaeden.js", import.meta.url);
writeFileSync(out,
  "// Automatisch erzeugt von tools/update_hoflaeden.mjs – nicht von Hand bearbeiten (Ergänzungen: EXTRA im Skript).\n" +
  "// Hofläden (hof), Märkte (markt), Hofautomaten (automat) – Daten © OpenStreetMap-Mitwirkende, ODbL.\n" +
  `window.BF_HOF = { stand: ${JSON.stringify(stand)}, items: [\n` +
  items.map(i => "  " + JSON.stringify(i)).join(",\n") + "\n] };\n", "utf8");
const n = k => items.filter(i => i.k === k).length;
console.log(`${items.length} Orte (${n("hof")} Hofläden, ${n("markt")} Märkte, ${n("automat")} Automaten, ${items.filter(i => i.oh).length} mit Zeiten) -> static/hoflaeden.js`);
