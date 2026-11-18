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
  nwr["name"~"Robenhausen"](${BBOX});
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
async function dget(path) { // Kategorien in der neuen Fassung («sui»)
  const res = await fetch(DISCOVER + path, {
    headers: { "Ocp-Apim-Subscription-Key": process.env.DISCOVER_SWISS_KEY, Accept: "application/json", categoryVersion: "sui", "User-Agent": "BringFresch-hoflaeden/1.0 (+https://github.com/jodbaer/BringFresch; monatlicher Abruf)" },
    signal: AbortSignal.timeout(30000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keine JSON-Antwort */ }
  return { status: res.status, json, text };
}
const r5 = x => Math.round(x * 1e5) / 1e5;
const DAY_OH = { Monday: "Mo", Tuesday: "Tu", Wednesday: "We", Thursday: "Th", Friday: "Fr", Saturday: "Sa", Sunday: "Su" };
// openingHoursSpecification [{ dayOfWeek, opens, closes, validFrom?, validThrough? }] -> OSM-Format
// «Mar-Nov Sa 08:00-11:00; Mo 09:00-12:00,14:00-18:30 …». dayOfWeek kann Text, Liste oder schema.org-URL sein.
// Saison: gilt eine Angabe nur für einen Teil des Jahres (validFrom/validThrough), steht der Monatsbereich davor.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ohFrom(spec) {
  const groups = {}; // Saison -> Tag -> Zeiten
  for (const x of spec || []) {
    if (!x.opens || !x.closes) continue;
    let season = "";
    if (x.validFrom && x.validThrough) {
      const f = new Date(x.validFrom), t = new Date(x.validThrough);
      if (!isNaN(f) && !isNaN(t) && t - f < 330 * 864e5 && t > f) season = `${MON[f.getUTCMonth()]}-${MON[t.getUTCMonth()]}`;
    }
    for (const dRaw of [].concat(x.dayOfWeek || [])) {
      const d = DAY_OH[String(dRaw).replace(/^.*\//, "")];
      if (!d) continue;
      const g = (groups[season] = groups[season] || {});
      const span = `${x.opens.slice(0, 5)}-${x.closes.slice(0, 5)}`;
      if (!(g[d] = g[d] || []).includes(span)) g[d].push(span);
    }
  }
  return Object.entries(groups).map(([season, days]) => {
    const rule = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].filter(d => days[d]).map(d => `${d} ${days[d].sort().join(",")}`).join("; ");
    return season ? rule.split("; ").map(r => `${season} ${r}`).join("; ") : rule;
  }).filter(Boolean).join("; ");
}
const inBox = o => o.geo && o.geo.latitude >= 47.15 && o.geo.latitude <= 47.45 && o.geo.longitude >= 8.45 && o.geo.longitude <= 9.0;
// discover.swiss «Infocenter OpenData» (Schlüssel als Secret DISCOVER_SWISS_KEY, kein Partner-Projekt → keine /search).
// Die Listen holen wir ganz (Filter additionalType/source wirken dort nicht, Ort-Filter «coming soon») und wählen selbst:
//   civicstructures: Typ Market (Wochenmärkte, v.a. von Zürich Tourismus) – ohne Floh-/Weihnachts-/Saisonmärkte (die stehen in
//                    maerkte_spezial.js); Typ Farm = Hof.
//   localbusinesses: Typ FarmShop, oder Laden mit «Hofladen» im Namen, dazu Kategorien Regionalprodukte/Produzent (sui_0506/0507).
//   places:          «Hofladen» im Namen.
// Nur im Gebiet, nur offene Lizenz (CC …). ~1 Abruf pro Sekunde (Grenze 60/Min, 50 000/Monat); im Log nur Anzahlen und Namen.
const SPECIAL = /floh|weihnacht|advent|christkind|wintermarkt|herbstmarkt|frühlingsmarkt|sternenmarkt|weihnachtsallee|chlaus/i;
async function dall(path, max = 40) {
  const all = []; let token = "";
  for (let page = 0; page < max; page++) {
    const r = await dget(`${path}${path.includes("?") ? "&" : "?"}top=100${token ? "&continuationToken=" + encodeURIComponent(token) : ""}`);
    if (r.status !== 200 || !r.json) throw new Error(`${path}: HTTP ${r.status}`);
    all.push(...(r.json.data || []));
    if (!r.json.hasNextPage || !r.json.nextPageToken) break;
    token = r.json.nextPageToken;
    await new Promise(res => setTimeout(res, 1100));
  }
  return all;
}
function kindFromDiscover(o, from) {
  const t = String(o.additionalType || "").replace(/^.*\//, ""), n = o.name || "";
  if (from === "civic") {
    if (t === "Market") return SPECIAL.test(n) ? null : /markt|märkt|märt|market|marché/i.test(n) ? "markt" : "hof"; // z.B. Juckerhof = Hof
    if (t === "Farm") return "hof";
    return null;
  }
  if (from === "local") return t === "FarmShop" || /hofl[aä]d/i.test(n) ? "hof" : null;
  if (from === "place") return /hofl[aä]d/i.test(n) ? "hof" : null;
  return from === "cat" ? "hof" : null;
}
async function discoverItems() {
  if (!process.env.DISCOVER_SWISS_KEY) { console.log("discover.swiss: kein Schlüssel – übersprungen"); return []; }
  const out = [], seen = new Set(); let total = 0, closed = 0;
  try {
    const sets = [
      ["civic", await dall("civicstructures")],
      ["local", await dall("localbusinesses")],
      ["place", await dall("places")],
      ["cat", [...await dall("localbusinesses?category=sui_0506", 10), ...await dall("localbusinesses?category=sui_0507", 10)]]
    ];
    for (const [from, list] of sets) for (const o of list) {
      total++;
      if (!inBox(o) || o.removed || seen.has(o["@id"])) continue;
      const k = kindFromDiscover(o, from);
      if (!k) continue;
      if (!/^CC/.test(o.license || "") || /All-Rights/i.test(o.license)) { closed++; continue; } // nur offene Lizenz
      seen.add(o["@id"]);
      const a = o.address || {};
      const it = { n: String(o.name).replace(/\s+[–-]\s+.*$/, "").trim(), k, lat: r5(o.geo.latitude), lon: r5(o.geo.longitude), src: "discover" };
      if (a.addressLocality) it.ort = a.addressLocality.trim();
      if (it.ort) it.n = it.n.replace(new RegExp(`,\\s*${it.ort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), ""); // «…, Wetzikon» steht schon als Ort
      if (a.streetAddress) it.adr = a.streetAddress.trim();
      const oh = ohFrom(o.openingHoursSpecification);
      if (oh) it.oh = oh;
      const web = a.url || o.url;
      if (web && /^https?:\/\//.test(web)) it.web = web;
      // derselbe Ort doppelt (z.B. Juckerhof als Markt und als Laden): einer reicht, der mit Zeiten gewinnt
      const twin = out.findIndex(x => x.k === it.k && Math.abs(x.lat - it.lat) < 0.0015 && Math.abs(x.lon - it.lon) < 0.002);
      if (twin >= 0) { if (!out[twin].oh && it.oh) out[twin] = it; continue; }
      out.push(it);
    }
  } catch (e) { console.warn(`discover.swiss: Abbruch (${e.cause?.code || e.message}) – OSM und Handliste laufen weiter`); return []; }
  const n = k => out.filter(i => i.k === k).length;
  console.log(`discover.swiss: ${total} Objekte gelesen, im Gebiet übernommen: ${n("markt")} Märkte, ${n("hof")} Hofläden (${closed} ohne offene Lizenz ausgelassen)`);
  for (const i of out) console.log(`  + ${i.k} ${i.n} | ${i.adr || ""}, ${i.ort || ""} | ${i.oh || "ohne Zeiten"}`);
  return out;
}
// Erkundung (nur mit DISCOVER_EXPLORE=1, Workflow-Schalter «explore»; ändert keine Daten, nur Log):
// Märkte und Brauchtum mit Markt-Charakter in der GANZEN Schweiz (Idee «Easter Eggs» in der Woche, Joshua 18.11.).
// Ohne Partner-Projekt keine /search → Listen-Endpunkte seitenweise (~1/s). Log: Name | Typ | Ort | Datum | Quelle | Lizenz.
const FEST = /m[aä]rkt|m[aä]rt\b|märit|marché|marche|mercato|market|chilbi|kilbi|messe\b|weihnacht|advent|christkind|böögg|sechsel[äa]uten|fulehung|ausschiesset|zibele|räbe|chäs|käse|alpabzug|alpabfahrt|alpaufzug|désalpe|bénichon|benichon|sagra|fête|foire|metzgete|wümmet|winzerfest|chestene|marroni|fasnacht|unspunnen|schwinget|gansabhauet|klausjagen|chlausjagen|silvesterchlaus|hornschlitten|escalade/i;
const EV_TYPES = ["StreetMarketEvent", "TraditionalEvent", "SaleEvent", "ArtsAndCraftsEvent", "Fair", "FoodEvent", "Festival"];
async function discoverExplore() {
  if (!process.env.DISCOVER_SWISS_KEY || process.env.DISCOVER_EXPLORE !== "1") return;
  const when = o => {
    const sc = (o.schedule || [])[0] || {};
    const f = (o.startDate || sc.startDate || "").slice(0, 10), t = (o.endDate || sc.endDate || "").slice(0, 10);
    return f ? (t && t !== f ? `${f}–${t}` : f) + ((o.schedule || []).length > 1 ? ` (+${o.schedule.length - 1} Termine)` : "") : "ohne Datum";
  };
  const line = o => `${o.name} | ${String(o.additionalType || o.type || "").replace(/^.*\//, "")} | ${(o.address || {}).addressLocality || (o.location || {}).name || ""} | ${when(o)} | ${[].concat(o.dataGovernance?.source?.acronym || []).join("/")} | ${o.license || "?"}${o.geo ? "" : " | ohne geo"}`;
  async function scan(label, path, maxPages, keep) {
    let token = "", total = 0; const hits = [], types = {};
    try {
      for (let page = 0; page < maxPages; page++) {
        const r = await dget(`${path}${path.includes("?") ? "&" : "?"}top=100${token ? "&continuationToken=" + encodeURIComponent(token) : ""}`);
        if (r.status !== 200 || !r.json) { console.log(`ERKUNDEN ${label}: HTTP ${r.status} ${r.text.slice(0, 200)}`); break; }
        for (const o of r.json.data || []) {
          if (o.removed) continue;
          total++;
          const t = String(o.additionalType || "").replace(/^.*\//, "") || "-"; types[t] = (types[t] || 0) + 1;
          if (keep(o, t)) hits.push(o);
        }
        if (!r.json.hasNextPage || !r.json.nextPageToken) break;
        if (page === maxPages - 1) console.log(`ERKUNDEN ${label}: nach ${maxPages} Seiten abgebrochen`);
        token = r.json.nextPageToken;
        await new Promise(res => setTimeout(res, 1050));
      }
    } catch (e) { console.log(`ERKUNDEN ${label}: Fehler ${e.cause?.code || e.message}`); }
    const top = Object.entries(types).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(", ");
    console.log(`ERKUNDEN ${label}: ${total} gelesen, ${hits.length} Treffer; Typen ${top}`);
    for (const o of hits.slice(0, 400)) console.log(`  - ${line(o)}`);
    return hits;
  }
  await scan("CH Märkte (civicstructures, Typ Market)", "civicstructures", 40, (o, t) => t === "Market");
  await scan("CH Orte mit Markt-Namen (places/localbusinesses)", "places", 20, o => FEST.test(o.name || ""));
  // Anlässe: alle Seiten, Treffer = Markt-/Brauchtums-Typ oder passender Name
  await scan("CH Anlässe (events) – Markt/Brauchtum", "events", 600, (o, t) => EV_TYPES.includes(t) && (t !== "Festival" && t !== "FoodEvent" || FEST.test(o.name || "")) || FEST.test(o.name || ""));
}
await discoverExplore();
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
// Overpass ganz weg (kommt vor): OSM-Orte aus der bisherigen Datei weiterverwenden, damit discover.swiss und die Handliste trotzdem
// aktuell werden. Alle bisherigen Orte bleiben (auch die mit discover-Angaben); der Abgleich nach Namen ersetzt sie frisch.
let elements = [], previous = null;
if (res) ({ elements } = await res.json());
else {
  console.warn("Kein Overpass-Server erreichbar – OSM-Orte aus der bisherigen static/hoflaeden.js");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../static/hoflaeden.js", import.meta.url), "utf8");
  const box = {}; new Function("window", src)(box);
  previous = (box.BF_HOF?.items || []).map(({ src, ...i }) => i);
  if (!previous.length) throw new Error("Kein Overpass-Server erreichbar und keine bisherigen Daten");
}

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
    // derselbe Ort: < 250 m und gemeinsames Ortswort (z.B. «Oerlikon»), Märkte mit genau denselben Zeiten < 500 m,
    // oder < 3 km und Name enthält den anderen (Robenhausen: Ort von Hand ≠ Adresse). Nähe allein reicht nicht (Rosenhof ≠ Rathausbrücke).
    const words = n => new Set(String(n).toLowerCase().replace(/[^a-zäöüéèà ]/g, " ").split(/\s+/).filter(w => w.length >= 5 && !/^(dorfs|haupt)/.test(w) && !/^(markt|wochenmarkt|blumen|gemüsemarkt|hofladen|märkte)$/.test(w)));
    const shareWord = (a, b) => { const B = new Set([...words(b)].map(w => w.slice(0, 5))); return [...words(a)].some(w => B.has(w.slice(0, 5))); }; // «Jucker Farm» = «Juckerhof»
    const sameOh = (a, b) => a.oh && b.oh && a.oh.replace(/\s/g, "") === b.oh.replace(/\s/g, "");
    const i = out.findIndex(o => o.k === d.k && (
      (dist(o, d) < 0.25 && shareWord(o.n, d.n)) ||
      (d.k === "markt" && dist(o, d) < 0.5 && sameOh(o, d)) || // Rathausbrücke = Stadthausquai (270 m, gleiche Zeiten)
      (dist(o, d) < 3 && (normN(o.n).includes(normN(d.n)) || normN(d.n).includes(normN(o.n))))));
    if (i < 0) { out.push(d); continue; }
    const keep = out[i]._hand ? { oh: out[i].oh } : {}; // Zeiten von Hand (amtlich) bleiben; Name/Adresse/Ort offiziell
    out[i] = { ...out[i], ...d, ...(d.oh ? {} : { oh: out[i].oh }), ...keep };
    if (!out[i].oh) delete out[i].oh;
  }
  return out;
}
const places = {};
if (previous) items.push(...previous);
for (const e of elements) {
  const t = e.tags || {};
  if (!(t.shop === "farm" || t.shop === "greengrocer" || t.amenity === "marketplace" || t.amenity === "vending_machine")) { // nur Orte zum Nachschlagen (Robenhausen), keine Läden
    if (t.name && /Robenhausen/.test(t.name)) places[t.name] = { lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon };
    continue;
  }
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
    if (fill.oh) dup._hand = 1; // amtliche Zeiten von Hand: gelten auch vor discover.swiss
    continue;
  }
  const at = x.lat != null ? { lat: x.lat, lon: x.lon } : (places[place] || Object.entries(places).find(([nm]) => nm.includes(place))?.[1]);
  if (!at) { console.warn(`EXTRA ${x.n}: Ort ${place} nicht gefunden – übersprungen`); continue; }
  items.push({ ...fill, lat: r5(at.lat), lon: r5(at.lon), ...(fill.oh ? { _hand: 1 } : {}) });
}
items.splice(0, items.length, ...mergeDiscover(items, discovered));
items.forEach(i => delete i._hand);
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
