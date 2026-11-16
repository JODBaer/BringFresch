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
  nwr["place"]["name"~"Robenhausen"](${BBOX});
);
out center tags;`;

// Von Hand ergänzt (fehlt in OpenStreetMap oder hat dort keine Zeiten). Quelle jeweils dabei.
// match: Name in OSM (dann werden nur fehlende Angaben ergänzt); place: sonst an diesem Ort (OSM place-Punkt) neu anlegen.
const EXTRA = [
  // https://www.rapperswil-zuerichsee.ch/de/besuchen/shopping/wochenmarkt-robenhausen-wetzikon (von Hand abgelesen 15.11.2026:
  // «Von März bis November, jeden Samstag von 08.00 bis 11.00 Uhr», Dorfstrasse 15, 8620 Wetzikon)
  { match: /Robenhausen/i, place: "Robenhausen", n: "Wochenmarkt Robenhausen", k: "markt", ort: "Wetzikon", adr: "Dorfstrasse 15", oh: "Mar-Nov Sa 08:00-11:00", web: "https://www.rapperswil-zuerichsee.ch/de/besuchen/shopping/wochenmarkt-robenhausen-wetzikon" }
  ,
  // Von Hand übernommen am 16.11.2026 von https://zuercher-maerkte.ch/ (Vereinigung Zürcher Märkte, amtliche Zeiten; robots.txt erlaubt).
  // Nur Zeiten; Koordinaten/Link kommen aus OSM, falls der Markt dort steht. Etwa einmal im Jahr von Hand nachprüfen.
  { match: /Altstetten/i, k: "markt", oh: "Sa 06:00-12:00" },
  { match: /B[üu]rkli/i, k: "markt", oh: "Tu,Fr 06:00-11:00" },
  { match: /Helvetiaplatz/i, k: "markt", oh: "Tu,Fr 06:00-11:00" },
  { match: /Milchbuck/i, k: "markt", oh: "Tu,Fr 06:00-11:00" },
  { match: /Oerlikon/i, k: "markt", oh: "We 06:00-11:00; Sa 06:00-12:00" },
  { match: /Rathausbr/i, k: "markt", oh: "Sa 07:00-12:30" },
  // Von Hand übernommen am 16.11.2026 von zuerich.com (Zürich Tourismus; robots.txt erlaubt), Koordinaten aus den Angaben der Seite:
  { match: /Freitagsmarkt/i, lat: 47.226698, lon: 8.816421, n: "Rapperswiler Freitagsmarkt", k: "markt", ort: "Rapperswil-Jona", adr: "Hauptplatz", oh: "Mar-Nov Fr 07:30-11:00", web: "https://www.zuerich.com/de/besuchen/shopping/rapperswiler-freitagsmarkt" }, // Mitte März bis Ende November, in der Woche vor Ostern am Gründonnerstag
  { match: /Markthalle im Viadukt/i, lat: 47.387604, lon: 8.526029, n: "Markthalle im Viadukt", k: "markt", ort: "Zürich", adr: "Limmatstrasse 231", oh: "Mo-Sa 09:00-20:00", web: "https://www.zuerich.com/de/besuchen/shopping/markthalle-im-viadukt" }
];

// Mehrere öffentliche Overpass-Server der Reihe nach (GitHub-Server werden vom ersten manchmal abgewiesen); ein Aufruf pro Server.

const DISCOVER = "https://api.discover.swiss/info/v2/";
async function dget(path) {
  const res = await fetch(DISCOVER + path, {
    headers: { "Ocp-Apim-Subscription-Key": process.env.DISCOVER_SWISS_KEY, Accept: "application/json", "User-Agent": "BringFresch-hoflaeden/1.0 (+https://github.com/jodbaer/BringFresch; monatlicher Abruf)" },
    signal: AbortSignal.timeout(30000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keine JSON-Antwort */ }
  return { status: res.status, json, text };
}
const shape = (v, d = 0) => (Array.isArray(v) ? `[${v.length}:${v.length ? shape(v[0], d + 1) : ""}]` : v && typeof v === "object" ? (d > 2 ? "{…}" : "{" + Object.entries(v).slice(0, 25).map(([k, x]) => `${k}:${shape(x, d + 1)}`).join(",") + "}") : typeof v);
async function discoverItems() {
  if (!process.env.DISCOVER_SWISS_KEY) { console.log("discover.swiss: kein Schlüssel – übersprungen"); return []; }
  // Erster Lauf: nur erkunden (Felder und Typen ins Log, nie der Schlüssel). Die Zuordnung folgt, sobald die Felder bekannt sind.
  const show = (path, fn) => dget(path).then(r => { console.log(`discover.swiss ${path}: HTTP ${r.status}`); if (r.json) fn(r.json); else console.log("  Antwort: " + r.text.slice(0, 200).replace(/\s+/g, " ")); }).catch(e => console.log(`discover.swiss ${path}: ${e.cause?.code || e.message}`));
  const pause = () => new Promise(r => setTimeout(r, 1500)); // weit unter 60 Aufrufen pro Minute
  const cut = (v, n) => JSON.stringify(v).slice(0, n);
  await show("categories?rootObjectsOnly=true", j => console.log("  Wurzeln: " + cut((j.data || j).map?.(c => [c["@id"] || c.identifier, c.name]), 1500)));
  await pause();
  await show("localbusinesses", j => {
    const d = j.data || [];
    console.log("  Anzahl Seite: " + d.length + ", Weiter: " + j.hasNextPage);
    d.slice(0, 3).forEach(o => console.log("  Objekt: " + cut({ name: o.name, additionalType: o.additionalType, category: (o.category || []).map(c => [c["@id"], c.name]), geo: o.geo, address: o.address, openingDays: o.openingDays, license: o.license, copyright: o.copyright, gov: o.dataGovernance, containedInPlace: (o.containedInPlace || []).map(c => [c["@id"], c.name]).slice(0, 6) }, 1400)));
    console.log("  Alle Schlüssel: " + Object.keys(d[0] || {}).join(","));
  });
  await pause();
  await show("events", j => (j.data || []).slice(0, 2).forEach(o => console.log("  Event: " + cut({ name: o.name, additionalType: o.additionalType, startDate: o.startDate, endDate: o.endDate, eventSchedule: o.eventSchedule, location: o.location, license: o.license, category: (o.category || []).map(c => [c["@id"], c.name]), url: o.url }, 1400))));
  await pause();
  await show("places", j => (j.data || []).slice(0, 2).forEach(o => console.log("  Ort: " + cut({ name: o.name, additionalType: o.additionalType, id: o["@id"], contained: (o.containedInPlace || []).map(c => [c["@id"], c.name, c.additionalType]) }, 900))));
  return [];
}
const discovered = await discoverItems();
const SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
let res;
for (let round = 0; round < 2 && !res; round++) {
  if (round) await new Promise(r => setTimeout(r, 30000)); // Overpass ist oft ausgelastet: nach einer Pause nochmals die Reihe durch
for (const url of SERVERS) {
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "BringFresch-hoflaeden/1.0 (+https://github.com/jodbaer/BringFresch; monatlicher Abruf)" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(120000)
    });
    if (res.ok) break;
    console.warn(`${url}: HTTP ${res.status}`);
  } catch (e) { console.warn(`${url}: ${e.cause?.code || e.message}`); }
  res = null;
}
}
if (!res) throw new Error("Kein Overpass-Server erreichbar");
const { elements } = await res.json();

const r5 = x => Math.round(x * 1e5) / 1e5;
const kindOf = t => (t.amenity === "marketplace" ? "markt" : t.amenity === "vending_machine" ? "automat" : "hof");
const VEND = { milk: "Milch", eggs: "Eier", fruit: "Obst", vegetables: "Gemüse", cheese: "Käse", meat: "Fleisch", potatoes: "Kartoffeln" };
const items = [];
// discover.swiss (offizielle Tourismusdaten, braucht Schlüssel «Infocenter OpenData»): nur mit Secret DISCOVER_SWISS_KEY.
// Ohne Schlüssel wird der Teil übersprungen (OSM + Handliste laufen weiter). Der Abruf ist noch nicht gebaut: Felder (Öffnungszeiten,
// Typen) erst mit Schlüssel an der Doku prüfen. Was zurückkommt, gilt vor OSM, wenn Name ähnlich und < 150 m (siehe mergeDiscover).
const normN = n => String(n).toLowerCase().replace(/[^a-zäöüéèà0-9]/g, "");
function mergeDiscover(osm, disc) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2));
  const out = osm.slice();
  for (const d of disc) {
    const i = out.findIndex(o => dist(o, d) < 0.15 && (normN(o.n).includes(normN(d.n)) || normN(d.n).includes(normN(o.n))));
    if (i >= 0) out[i] = { ...out[i], ...d }; else out.push(d);
  }
  return out;
}
const places = {};
for (const e of elements) {
  const t = e.tags || {};
  if (t.place) { places[t.name] = { lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon }; continue; }
  const k = kindOf(t);
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat == null) continue;
  if (k === "markt" && !t.name) continue; // namenlose Plätze sind meist keine Wochenmärkte
  if (k === "markt" && /parkplatz|parking/i.test(t.name)) continue;
  if (k === "markt" && /^(24\/7|Mo-Su,? ?(PH )?00:00-24:00)/.test(t.opening_hours || "")) continue; // rund um die Uhr offen = kein Wochenmarkt (Plätze)
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
  const at = x.lat != null ? { lat: x.lat, lon: x.lon } : Object.entries(places).find(([nm]) => nm.includes(place))?.[1];
  if (!at) { console.warn(`EXTRA ${x.n}: Ort ${place} nicht gefunden – übersprungen`); continue; }
  items.push({ ...fill, lat: r5(at.lat), lon: r5(at.lon) });
}
items.splice(0, items.length, ...mergeDiscover(items, discovered));
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
