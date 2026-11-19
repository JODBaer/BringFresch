// Regeln direkt (ohne Browser): static/core.js läuft in Node genauso wie in der App und im WG-Server.
// Start: cd tests && node core.test.mjs
import path from "path";
const root = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "static");
globalThis.window = globalThis; // bring_catalog.js legt den Katalog wie im Browser unter window ab
await import("file:///" + path.join(root, "bring_catalog.js").replace(/\\/g, "/"));
await import("file:///" + path.join(root, "core.js").replace(/\\/g, "/"));
await import("file:///" + path.join(root, "hoflaeden.js").replace(/\\/g, "/"));
await import("file:///" + path.join(root, "maerkte_spezial.js").replace(/\\/g, "/"));
const C = globalThis.BF_CORE;
let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

// Woche: App (Datum -> KW) und Server (KW -> Montag, nächste KW) müssen dasselbe meinen, auch über den Jahreswechsel
check(C.weekKey(new Date(2026, 10, 10)) === "2026-W46", "Di 10.11.2026 = KW 46");
check(C.weekKey(new Date(2027, 0, 1)) === "2026-W53" && C.weekKey(new Date(2027, 0, 4)) === "2027-W01", "Jahreswechsel: Fr 1.1.2027 gehört zu 2026-W53, Mo 4.1.2027 zu 2027-W01");
let bad = [];
for (let d = new Date(2024, 0, 1); d < new Date(2031, 0, 1); d.setDate(d.getDate() + 1)) {
  const key = C.weekKey(d), mon = C.mondayOf(key);
  const monLocal = new Date(d); monLocal.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sameMonday = mon.getUTCFullYear() === monLocal.getFullYear() && mon.getUTCMonth() === monLocal.getMonth() && mon.getUTCDate() === monLocal.getDate();
  if (!sameMonday || C.weekAfter(key) !== C.weekKey(C.plusWeek(d))) bad.push(d.toISOString().slice(0, 10));
}
check(bad.length === 0, `7 Jahre Tag für Tag: Montag der KW und «nächste Woche» stimmen in App und Server überein ${bad.slice(0, 3).join(", ")}`);

// Portionen
check(C.portionsFor({ eaters: ["a", "b"], extra_guests: 1, leftover_buffer: 2 }) === 5, "2 Esser + 1 Gast + 2 Reste = 5 Portionen");
check(C.portionsFor({ eaters: [], extra_guests: 0, leftover_buffer: 2 }) === 0, "niemand zuhause = nicht kochen");

// Einkaufsliste: Menge skaliert, Grundvorrat erkannt, «alles für alle»
const members = [{ id: "a", diet: "fleisch" }, { id: "b", diet: "vegi" }];
const day = { title: "Test", diet: "vegi", servings: 4, eaters: ["a", "b"], leftover_buffer: 0, extra_guests: 0,
  ingredients: [{ name: "Schweizer Rüebli (fein geraffelt)", amount: "400", unit: "g" }, { name: "Mehlig kochende Kartoffeln", amount: "800", unit: "g" }, { name: "Weissmehl", amount: "100", unit: "g" }] };
const list = C.shoppingList({ plan: [day], members, staples: [{ name: "Weissmehl / Ruchmehl", keywords: ["mehl", "weissmehl"], in_stock: true }], bringItems: ["Karotten"] });
const by = n => list.find(i => i.name === n);
check(by("Rüebli") && by("Rüebli").amount === 200 && /Schweizer/.test(by("Rüebli").spec), "Rezept für 4, zwei Esser: halbe Menge; «Schweizer» und Klammer in der Mengenangabe");
check(by("Rüebli").isOnBring && by("Rüebli").bring === "Karotten", "Rüebli = Bring!-Artikel Karotten, steht schon drauf");
check(by("Weissmehl").isStaple && !by("Mehlig kochende Kartoffeln").isStaple, "Weissmehl ist Grundvorrat, mehlig kochende Kartoffeln nicht");
check(list.some(i => /Speckwürfeli/.test(i.name) && i.amount === 150) && list.some(i => /Grillkäse/.test(i.name) && i.amount === 100), "150 g Fleisch pro Fleisch-Esser, 100 g Grillkäse pro Vegi");
check(C.shoppingList({ plan: [{ ...day, empty: true }], members, staples: [], bringItems: [] }).length === 0, "offener Tag kauft nichts");

// Wochenwahl
const ms = [{ id: "a", diet: "fleisch" }, { id: "b", diet: "vegi" }, { id: "c", diet: "fleisch" }];
check(C.effectiveDiet(["a", "c"], ms) === "fleisch" && C.effectiveDiet(["a", "b"], ms) === "vegi", "ein Vegi am Tisch = vegi für alle");
const rec = (id, diet, extra) => ({ id, diet, season_months: [11], ...extra });
const all = [...Array.from({ length: 8 }, (_, i) => rec("v" + i, "vegi")), ...Array.from({ length: 8 }, (_, i) => rec("f" + i, "fleisch")), rec("q1", "vegi", { quick: true }), rec("q2", "fleisch", { quick: true })];
const cand = C.pickCandidates(all, 11, 14, 2);
check(cand.length === 14 && new Set(cand).size === 14, "14 Gerichte, keines doppelt");
check(cand.slice(0, 12).every((id, i) => id[0] === (i % 2 ? "f" : "v")) && cand.slice(12).every(id => id[0] === "q"), "abwechselnd vegi / Fleisch, die letzten 2 sind Schnelles");
// alte Liste vom WG-Server mit doppelten Karten (Mischen vor dem Fix): bereinigt und wieder auf 14 aufgefüllt
const dup = C.cleanCandidates(all, ["v0", "v0", "f0", "zzz", ...cand.slice(2, 13), "f0"], 11, 14, 2);
check(dup.length === 14 && new Set(dup).size === 14 && dup[0] === "v0" && dup[1] === "f0" && !dup.includes("zzz"), "doppelte und unbekannte Karten weg, wieder 14");
const twin = [...all, { id: "custom-1", title: "Gericht V0", diet: "vegi", season_months: [11] }];
twin.find(r => r.id === "v0").title = "Gericht v0";
check(!C.cleanCandidates(twin, ["v0", "custom-1"], 11, 2, 0).includes("custom-1"), "eigenes Rezept mit gleichem Titel wie ein Katalog-Gericht = dasselbe Gericht");
// Gleicher Link (auch mit/ohne www., Schrägstrich, ?…) = ein Rezept; die eigene Kopie ersetzt das Original in der Anzeige
const linked = [{ id: "k1", title: "Toast Hawaii", source_url: "https://www.swissmilk.ch/de/rezepte/toast-hawaii/" },
  { id: "k2", title: "Toast Hawaii · Betty Bossi", source_url: "https://www.bettybossi.ch/de/rezepte/toast-hawaii" },
  { id: "custom-9", title: "Unser Toast", source_url: "https://swissmilk.ch/de/rezepte/toast-hawaii?utm_source=x", is_custom: true }];
check(C.sameDish(linked[0], linked[2]) && !C.sameDish(linked[0], linked[1]), "gleicher Link = gleiches Gericht, andere Seite = eigenes Rezept");
check(C.uniqueRecipes(linked).map(r => r.id).join() === "k2,custom-9", "uniqueRecipes: jedes Gericht einmal, eigene Rezepte gewinnen, Reihenfolge bleibt");
check(Array.from({ length: 30 }, () => C.pickCandidates(twin, 11, 14, 2)).every(c => !(c.includes("v0") && c.includes("custom-1"))), "Wochenwahl zieht nie zweimal dasselbe Gericht (gleicher Titel)");
check(C.searchHref(undefined, "Spinat Rezept") === "https://www.swissmilk.ch/de/suche/?query=Spinat" && /google\.com\/search\?q=Riz%20Casimir%20Rezept$/.test(C.searchHref("google", "Riz Casimir")) && /fooby/.test(C.searchHref("fooby", "x")), "Rezept suchen: Standard Swissmilk, umschaltbar auf Fooby / Google");
{
  const ws = C.webSearchLinks("Kürbis Risotto Rezept", "fooby", [{ name: "Annemarie", url: "https://www.wildeisen.ch/rezepte" }]);
  check(ws.length === 3 && ws[0].fav && ws[0].name === "Fooby" && ws[1].name === "Google" && /google\.com\/search\?q=site%3Awildeisen\.ch%20K%C3%BCrbis%20Risotto$/.test(ws[2].url), `Im Web suchen: Lieblingsseite, Google, eigene Webseite per site: (${ws.map(x => x.name)})`);
  // Gleicher Link = gleiches Rezept (Joshua 18.11.)
  check(C.canonicalUrl("https://www.Fooby.ch/de/rezepte/123/kuerbis/?utm_source=app&fbclid=x#top") === "fooby.ch/de/rezepte/123/kuerbis" && C.sameLink("http://fooby.ch/de/rezepte/123/kuerbis", "fooby.ch/de/rezepte/123/kuerbis/") && !C.sameLink("https://fooby.ch/a", "https://fooby.ch/b") && C.canonicalUrl("https://x.ch/r?id=5&utm_medium=y") === "x.ch/r?id=5", "Link vereinheitlicht (www, Protokoll, /, utm, #)");
  const dup = C.uniqueRecipes([
    { id: "fooby-kuerbis", title: "Kürbis", source_url: "https://fooby.ch/de/rezepte/123/kuerbis" },
    { id: "custom-1", is_custom: true, title: "Kürbis (meins)", source_url: "https://www.fooby.ch/de/rezepte/123/kuerbis/?utm_source=x" },
    { id: "custom-2", is_custom: true, title: "Omas Suppe" }, { id: "custom-3", is_custom: true, title: "omas suppe" },
    { id: "a", title: "Gleicher Titel, anderer Link", source_url: "https://a.ch/1" }, { id: "b", title: "Gleicher Titel, anderer Link", source_url: "https://b.ch/1" }]);
  check(dup.map(r => r.id).join() === "custom-1,custom-3,a,b", `ohne Doppelte: eigenes vor Katalog, eigene ohne Link nach Titel, gleicher Titel mit anderem Link bleibt (${dup.map(r => r.id)})`);
  const rr = { title: "Kürbis-Risotto", ingredients: [{ name: "Crème fraîche" }, { name: "Parmesan" }] };
  check(C.recipeMatches(rr, "risotto kurbis") && C.recipeMatches(rr, "CREME") && C.recipeMatches(rr, "") && !C.recipeMatches(rr, "risotto lauch") && C.recipeMatches(rr, "vegi", "Vegi · 30 Min."), "eine Suchregel: alle Wörter, Titel+Zutaten+Zusatz, ohne Akzente/Gross-klein");
  check(C.webSearchLinks("  ", "google").length === 0 && C.webSearchLinks("Rösti", "google").length === 1 && /site%3Akartoffel\.ch/.test(C.searchHref("kartoffel", "Rösti")), "leer = nichts; Google als Liebling nicht doppelt; neue Quellen über site:");
}
const votes = { a: { likes: ["x", "y"], days: { y: 2 } }, b: { likes: ["y"], days: {} }, c: { likes: [], days: {} } };
check(C.ranking(["x", "y", "z"], ms, votes).map(r => r.id).join() === "y,x,z", "Rangliste: 2 Stimmen vor 1 vor 0");
const week = Array.from({ length: 7 }, () => ({ eaters: ["a", "b", "c"] }));
check(C.assignDays(["y", "x"], week, ms, votes).y === 2, "Wunschtag Mittwoch wird respektiert");
week[2].eaters = ["c"]; week[0].eaters = ["a", "b"];
check(C.assignDays(["x"], week, ms, votes).x === 0, "ohne Wunschtag: Tag, an dem die Fans da sind");
// Tage im WG-Ranking von Hand (Entwurf A, Joshua 19.11.)
{
  const prop = { p: 0, q: 1, r: 2 };
  check(JSON.stringify(C.rankDays(["p", "q", "r"], prop, null)) === JSON.stringify(prop), "ohne eigene Wahl = Vorschlag");
  const m = C.moveDay(prop, "p", 2);
  check(m.p === 2 && m.r === 0 && m.q === 1, "belegter Tag: die zwei Gerichte tauschen");
  const kept = C.rankDays(["p", "q", "s"], { p: 0, q: 1, s: 2 }, m);
  check(kept.p === 2 && kept.q === 1 && kept.s === 0, "neues Gericht im Ranking: eigene Wahl bleibt, das neue bekommt einen freien Tag");
  check(C.dayReason("y", 2, week, ms, votes) === "wish" && C.dayReason("x", 0, week, ms, votes) === "home" && C.dayReason("x", 2, week, ms, votes) === "", "Grund: Wunschtag ★, Fans daheim 🏠, sonst nichts");
  const prev = { candidates: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"], votes: { a: { likes: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a9"], days: {} } } };
  check(C.carryOver(prev, ms).join() === "a9", "Platz 8+ mit Stimme kommt in die nächste Woche, ohne Stimme nicht");
  check(C.carryOver(null, ms).length === 0, "ohne Wahl der Vorwoche: nichts");
}

// Grundvorrat mit Mengen (Variante C)
const leerSt = C.shoppingList({ plan: [day], members, staples: [{ name: "Weissmehl", keywords: ["mehl"], in_stock: false }], bringItems: [] });
check(!leerSt.some(i => i.from.includes("Grundvorrat")) && !leerSt.find(i => i.name === "Weissmehl").isStaple, "leerer Grundvorrat: Zutat steht unter «Kaufen», aber der Artikel kommt nicht von selbst auf die Liste");
check(C.vQty({ name: "Öl" }) === 10 && C.vUnit({ name: "Öl" }) === "Znacht", "altes Format ohne Menge = eine volle Packung (10 Znacht)");
check(C.vQty({ name: "Öl", in_stock: false, qty: 5 }) === 0, "altes Handy meldet leer (in_stock false) = 0, auch wenn noch eine Menge gespeichert ist");
check(C.vQty({ name: "Öl", in_stock: true, qty: 0, pack: 15 }) === 15, "altes Handy meldet wieder da (in_stock true, qty 0) = eine Packung");
const stk = n => ({ name: "Rahm", unit: "Stk", pack: 2, qty: n, size: "2.5 dl" });
check(C.knappAb(stk(2)) === 1 && !C.isKnapp(stk(2)) && C.isKnapp(stk(1)), "Packung mit 2 Stück: knapp erst unter einer vollen Packung (1)");
check(C.knappAb({ pack: 10 }) === 2 && C.isKnapp({ qty: 2, pack: 10 }) && !C.isKnapp({ qty: 3, pack: 10 }), "sonst knapp ab 2 oder weniger");
check(C.isKnapp({ unit: "Stk", pack: 1, qty: 1 }) === false && C.isKnapp({ unit: "Stk", pack: 1, in_stock: false }), "Packung mit 1 Stück: knapp erst, wenn leer");
check(C.qtyText(stk(2)) === "2 × 2.5 dl" && C.qtyText({ qty: 6 }) === "~6 Znacht" && C.qtyText({ in_stock: false }) === "leer", "Mengen: «2 × 2.5 dl», «~6 Znacht», «leer»");
const st1 = { name: "Olivenöl", keywords: ["olivenöl"], qty: 3, pack: 15 };
C.setQty(st1, 0, "2026-W46");
check(st1.qty === 0 && st1.in_stock === false && st1.prev === 3 && st1.empties.join() === "2026-W46", "leer melden: in_stock false, alte Menge gemerkt, Woche notiert");
C.boughtStaple(st1, "2026-11");
check(st1.qty === 15 && st1.in_stock === true && st1.since === "2026-11", "in Bring! gekauft = eine Packung dazu, «seit» neu");
const oft = { empties: ["2026-W40", "2026-W44", "2026-W45", "2026-W46"] };
check(C.emptyWeeks(oft, "2026-W46") === 3 && C.oftLeer(oft, "2026-W46") && !C.oftLeer({ empties: ["2026-W44"] }, "2026-W46") && C.oftLeer({ weekly: true }, "2026-W46"), "geht oft aus: 3 von 4 Wochen leer erkannt, oder Vermerk am Artikel");
const pday = (title, ings, extra) => ({ title, servings: 4, eaters: ["a"], leftover_buffer: 0, ingredients: ings.map(n => ({ name: n, amount: "1", unit: "EL" })), ...extra });
const wplan = [pday("A", ["Olivenöl", "Salz"]), pday("B", ["Olivenöl"]), pday("C", ["Olivenöl"], { empty: true }), pday("D", ["Olivenöl"], { is_leftovers: true }), pday("E", ["Olivenöl"], { eaters: [] }), pday("F", ["Butter"])];
const oel = { name: "Olivenöl", keywords: ["olivenöl"], qty: 5, pack: 15 }, salz = { name: "Salz", keywords: ["salz"], qty: 1, pack: 10 }, mehl = { name: "Mehl", keywords: ["mehl"] };
check(C.stapleUse(oel, wplan) === 2 && C.stapleUse(mehl, wplan) === 0, "diese Woche gebraucht: 2 gekochte Tage mit Olivenöl (offen, Reste, niemand zuhause zählen nicht)");
const vor = [oel, salz, mehl];
check(C.bookWeek(vor, wplan, "2026-W46") === 2 && oel.qty === 3 && salz.qty === 0 && salz.in_stock === false && C.isBooked(vor, "2026-W46"), "Woche gekocht: Olivenöl 5 → 3, Salz 1 → 0 (nie unter 0)");
check(C.bookWeek(vor, wplan, "2026-W46") === 0 && oel.qty === 3, "nochmals abbuchen in derselben Woche bucht nichts doppelt");
check(C.unbookWeek(vor, "2026-W46") === 2 && oel.qty === 5 && salz.qty === 1 && salz.in_stock && !C.isBooked(vor, "2026-W46"), "Schalter zurück = rückgängig");
check(C.isOld({ since: "2025-10" }, "2026-11") && !C.isOld({ since: "2025-11" }, "2026-11"), "über ein Jahr im Vorrat markiert");
check(C.qtyLevels({ pack: 10 }).map(l => l[1]).join() === "0,1,5,10", "Leer / Fast leer / Halb / Voll");

// Wochenplan: Gerichte tauschen – Esser, Gäste, Puffer, Zeit bleiben am Tag
{
  const plan = [
    { day: "Montag", id: "a", title: "Dal", ingredients: [{ name: "Linsen" }], eaters: ["jo"], extra_guests: 1, leftover_buffer: 0, time: "19:00", time_by: "jo" },
    { day: "Dienstag", id: "b", title: "Rösti", diet: "fleisch", eaters: ["jo", "le"], leftover_buffer: 2 },
    { day: "Mittwoch", empty: true, title: "noch offen", eaters: [] },
  ];
  const sw = C.swapDishes(plan, 0, 1);
  check(sw[0].title === "Rösti" && sw[0].diet === "fleisch" && sw[0].day === "Montag" && sw[0].eaters.join() === "jo" && sw[0].extra_guests === 1 && sw[0].time === "19:00", "Tauschen: Gericht wandert, Esser/Gäste/Zeit bleiben am Montag");
  check(sw[1].title === "Dal" && sw[1].ingredients[0].name === "Linsen" && sw[1].day === "Dienstag" && sw[1].eaters.join() === "jo,le" && sw[1].time === undefined && !("diet" in sw[1]), "… und am Dienstag (keine Reste vom alten Gericht)");
  const sw2 = C.swapDishes(plan, 0, 2);
  check(sw2[0].empty === true && sw2[0].title === "noch offen" && sw2[2].title === "Dal" && !sw2[2].empty, "Tauschen mit offenem Tag: Gericht zieht um, alter Tag wird offen");
  check(plan[0].title === "Dal" && C.swapDishes(plan, 1, 1)[1] === plan[1], "Original unverändert; gleicher Tag = nichts");
}
// Einkauf nach Gericht
{
  const plan = [{ title: "Dal" }, { title: "Rösti" }, { title: "noch offen", empty: true }];
  const g = C.groupByDish([
    { name: "Linsen", from: ["Dal"] }, { name: "Kartoffeln", from: ["Rösti"] }, { name: "Butter", from: ["Rösti"] },
    { name: "Salat", from: ["Dal", "Rösti"] }, { name: "Vorrat-Ding", from: [] },
  ], plan);
  check(g.map(x => x.title).join("|") === "Dal|Rösti|Für mehrere Gerichte|Sonstiges", `Gruppen in Plan-Reihenfolge (${g.map(x => x.title).join("|")})`);
  check(g[1].items.map(i => i.name).join() === "Butter,Kartoffeln" && g[2].items[0].name === "Salat" && g[2].several, "pro Gericht alphabetisch; Gemeinsames unter «Für mehrere Gerichte»");
}
// Beliebtheit pro WG
{
  const c = C.popularity({ "2026-W45": { a: 2, b: 1 }, "2026-W46": { a: 1, c: 3 } });
  check(c.a === 3 && c.b === 1 && c.c === 3, "Beliebtheit: Stimmen über die Wochen zusammengezählt");
  const list = [{ id: "b", title: "B" }, { id: "x", title: "A" }, { id: "a", title: "Z" }, { id: "c", title: "C" }].sort(C.byPopularity(c, 11));
  check(list.map(r => r.id).join() === "c,a,b,x", `Sortierung: meiste Stimmen zuerst, dann Titel (${list.map(r => r.id)})`);
}

// Einkauf nach Kategorie wie in Bring!
{
  const g = C.groupByCategory([{ name: "Rahm", cat: "Milch & Käse" }, { name: "Lauch", cat: "Früchte & Gemüse" }, { name: "Butter", cat: "Milch & Käse" }, { name: "X" }]);
  check(g.map(x => x.title).join("|") === "Früchte & Gemüse|Milch & Käse|Sonstiges" && g[1].items.map(i => i.name).join() === "Butter,Rahm" && g[0].cat, "nach Kategorie: Abteilungen und Artikel alphabetisch");
}

// Alle Rezepte: nach Herkunft, darin Saison zuerst
{
  const rs = [
    { id: "f1", title: "Zopf", source_url: "https://fooby.ch/x", season_months: [11] },
    { id: "s1", title: "Spargel", source_url: "https://www.swissmilk.ch/a", season_months: [5] },
    { id: "s2", title: "Wirz", source_url: "https://www.swissmilk.ch/b", season_months: [11] },
    { id: "k1", title: "Rösti" },
    { id: "custom-1", title: "Meins", is_custom: true },
    { id: "x-wg2-1", title: "Fremd", shared_from: true },
    { id: "b1", title: "Gratin", source_url: "https://www.bettybossi.ch/c", season_months: [1] },
    { id: "w1", title: "Andere", source_url: "https://chefkoch.de/d" }
  ];
  const g = C.groupBySource(rs, 11);
  check(g.map(x => x.key).join() === "eigene,swissmilk,fooby,bettybossi,web:chefkoch.de,klassiker,geteilt", `Herkunft-Reihenfolge (${g.map(x => x.key)})`);
  check(g[1].recipes.map(r => r.id).join() === "s2,s1" && g[1].inSeason === 1, "in der Herkunft: Saison zuerst, sonst am Schluss");
  check(C.recipeSource(rs[2]).label === "Swissmilk" && C.recipeSource(rs[3]).label === "Klassiker", "Herkunft aus dem Link");
  check(C.recipeSource({ source_url: "https://www.gemuese.ch/rezepte/x" }).label === "gemuese.ch" && C.recipeSource({ source_url: "https://schweizerfleisch.ch/rezepte/x" }).label === "Schweizer Fleisch" && C.recipeSource({ source_url: "https://www.kartoffel.ch/de/rezepte/hauptgang/x.html" }).key === "kartoffel", "neue Quellen mit Namen");
}

// Hofläden & Märkte: Öffnungszeiten aus OpenStreetMap (Di 10.11.2026)
{
  const di10 = new Date(2026, 10, 10, 10, 0), di19 = new Date(2026, 10, 10, 19, 0);
  const hof = "Mo-Fr 08:00-12:00,14:00-18:30; Sa 08:00-12:00; PH off";
  check(C.openState(hof, di10).text === "offen bis 12:00" && C.openState(hof, di10).open, "Hofladen Di 10 Uhr: offen bis 12:00");
  check(C.openState(hof, new Date(2026, 10, 10, 12, 30)).text === "öffnet 14:00", "Mittagspause: öffnet 14:00");
  check(C.openState(hof, di19).text === "öffnet morgen 8:00", "abends: öffnet morgen");
  check(C.hoursText(hof, di10) === "Mo–Fr 8:00–12:00, 14:00–18:30 · Sa 8:00–12:00", `Wochentext: ${C.hoursText(hof, di10)}`);
  check(C.openState("Sa 07:00-11:00", di10).text === "öffnet Sa 7:00", "Samstagsmarkt: öffnet Sa 7:00");
  check(C.openState("Apr-Oct: Sa 08:00-12:00", di10).text === "Saisonpause bis 2.4.2027" && C.hoursText("Apr-Oct: Sa 08:00-12:00", di10) === "Sa 8:00–12:00", "nur im Sommer: im November «Saisonpause bis …», Zeiten der nächsten Saison");
  check(C.openState("Mo 08:00-12:00, We 08:00-12:00", di10).text === "öffnet morgen 8:00", "Komma statt Strichpunkt zwischen Regeln");
  check(C.hoursText("Mo-Fr 08:00-18:00; We off", di10) === "Mo,Di 8:00–18:00 · Do,Fr 8:00–18:00", "spätere Regel ersetzt frühere (Mi zu)");
  check(C.hoursText("Mo-Su 07:00-21:00", di10) === "täglich 7:00–21:00" && C.openState("24/7", di10).text === "immer offen", "täglich / 24/7");
  // Saisonpause mit Datum (Wochenmarkt Meilen, Quelle Joshua / wuchemaert-meilen.ch 18.11.2026): Fr 7:30–11, Pause 31.10.2026–25.3.2027
  const meilen = "Fr 07:30-11:00; 2026 Oct 31-2027 Mar 25 off";
  check(C.openState(meilen, di10).text === "Saisonpause bis 25.3.2027" && !C.openState(meilen, di10).open, `Meilen Di 10.11.: ${C.openState(meilen, di10).text}`);
  check(!C.openState(meilen, new Date(2026, 10, 13, 9)).open && C.openState(meilen, new Date(2027, 2, 26, 9)).open && C.openState(meilen, new Date(2027, 3, 2, 9)).open && C.openState(meilen, new Date(2026, 9, 30, 9)).open, "Meilen: Fr 13.11.2026 zu, Fr 30.10.2026 / 26.3.2027 / 2.4.2027 offen");
  check(C.hoursText(meilen, di10) === "Fr 7:30–11:00", "in der Pause: Zeiten der Woche, in der es wieder losgeht");
  check(C.openState("Mar 28 - Oct 24 Sa 09:00-11:30", di10).text === "Saisonpause bis 2.4.2027" && C.openState("Mar 28 - Oct 24 Sa 09:00-11:30", new Date(2027, 3, 3, 10)).open, "tagesgenaue Saison jedes Jahr (Dorfmärt Cham)");
  check(C.openState("Nov 1 - Mar 15 Sa 10:00-12:00", new Date(2027, 0, 9, 11)).open && !C.openState("Nov 1 - Mar 15 Sa 10:00-12:00", new Date(2027, 4, 8, 11)).open, "Zeitraum über Neujahr");
  check(C.openState("sunrise-sunset", di10) === null && C.hoursText("sunrise-sunset", di10) === "sunrise-sunset", "Unbekanntes: null, Text roh");
  const items = [{ n: "Weit", k: "hof", lat: 47.37, lon: 8.54, oh: hof }, { n: "Nah", k: "markt", lat: 47.227, lon: 8.82, oh: "Sa 07:00-11:00" }, { n: "Ohne", k: "hof", lat: 47.3, lon: 8.8 }];
  const rap = { lat: 47.2267, lon: 8.8184 };
  check(Math.abs(C.distKm(rap, { lat: 47.3769, lon: 8.5417 }) - 26.9) < 1, "Rapperswil–Zürich ≈ 27 km");
  const wk = C.farmWeek(items, { ref: rap, now: di10 });
  check(wk.length === 7 && wk[0].wd === 1, "7 Tage ab heute (Di)");
  check(wk[0].rows.map(r => r.n).join() === "Weit", "Di: nur der Hofladen mit Zeiten (Nah/Ohne haben nichts)");
  check(wk[0].rows[0].text === "8:00–12:00, 14:00–18:30" && wk[0].rows[0].now, "Di 10 Uhr: Zeiten des Tages, jetzt offen");
  check(wk[4].wd === 5 && wk[4].rows.map(r => r.n).join() === "Nah,Weit", "Sa: Markt zuerst (näher), dann Hofladen");
  // Nach Art (Joshua 17.11.): Abschnitte in fester Reihenfolge, nach Entfernung, Umkreis, Lieblinge immer
  {
    const gi = [{ n: "Weit", k: "hof", lat: 47.37, lon: 8.54, oh: "Mo-Fr 08:00-18:00" }, { n: "Nah", k: "markt", lat: 47.227, lon: 8.82, oh: "Sa 07:00-11:00" },
      { n: "Bio", k: "hof", bio: 1, lat: 47.23, lon: 8.83 }, { n: "Auto", k: "automat", lat: 47.24, lon: 8.81 }, { n: "Nah2", k: "hof", lat: 47.228, lon: 8.82 }];
    const gr = C.farmGroups(gi, { ref: rap, now: di10 });
    check(gr.map(g => g.key).join() === "markt,hof,bio,automat" && gr[1].rows.map(r => r.n).join() === "Nah2,Weit", `Abschnitte nach Art, nach Entfernung (${gr.map(g => g.key + ":" + g.rows.map(r => r.n))})`);
    const near = C.farmGroups(gi, { ref: rap, now: di10, maxKm: 5 });
    check(!near.some(g => g.rows.some(r => r.n === "Weit")) && C.farmGroups(gi, { ref: rap, now: di10, maxKm: 5, favs: [C.farmKey(gi[0])] }).find(g => g.key === "hof").rows.some(r => r.n === "Weit" && r.fav), "Umkreis 5 km: Zürich fehlt, ausser als Liebling");
  }
  const late = C.farmWeek(items, { ref: rap, now: di19 });
  check(late[0].rows.length === 0, "abends: heute nichts mehr");
  check(C.farmWeek(items, { ref: rap, now: di10, favs: [C.farmKey(items[0])], maxKm: 5 })[0].rows.length === 1 && C.farmWeek(items, { ref: rap, now: di10, maxKm: 5 })[0].rows.length === 0, "Lieblinge auch ausserhalb der Reichweite");
  check(C.nearestFarm(items, rap, di10).n === "Nah" && C.nearestFarm([items[2]], rap, di10) === null, "am nächsten: mit Zeiten");
  check(C.favFarm(items, [C.farmKey(items[0]), C.farmKey(items[1])], rap, di10).n === "Weit", "Lieblinge: der offene zuerst");
  check(C.favFarm(items, [], rap, di10) === null, "kein Liebling");
  check(C.nearestFarm(items, rap, di10, C.farmKey(items[1])).n === "Weit", "am nächsten: der Liebling oben steht nicht doppelt da (Issue #8)");
  check(C.routeUrl(items[0], true) === "https://maps.apple.com/?ll=47.37,8.54&q=Weit" && C.routeUrl(items[0], false) === "https://www.google.com/maps/search/?api=1&query=47.37,8.54", "Ort öffnen: über Koordinaten (Apple Karten mit Name / Google Maps), nie Textsuche");
  // KML für Google «Meine Karten»
  const kml = C.kmlExport([{ n: "Hof «Müller» & Söhne <1>", k: "hof", lat: 47.3, lon: 8.8, oh: "Mo-Fr 08:00-12:00", adr: "Dorfstr. 1", ort: "Wetzikon", web: "https://x.ch/?a=1&b=2" }, items[1]], [{ n: "Zibelemärit", ort: "Bern", lat: 46.9467, lon: 7.444, rule: { m: 11, nth: 4, wd: 0 }, zeit: "6–18 Uhr", pruefen: true }], di10);
  check(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && kml.includes("<name>Hof «Müller» &amp; Söhne &lt;1&gt;</name>") && kml.includes("a=1&amp;b=2") && !/&(?!amp;|lt;|gt;|quot;)/.test(kml), "KML: Sonderzeichen escaped («» bleiben, & < >)");
  check(kml.includes("<coordinates>8.8,47.3,0</coordinates>") && kml.includes("<Folder><name>Märkte</name>") && kml.includes("4. Montag im November") && kml.includes("Datum prüfen") && kml.includes("Mo–Fr 8:00–12:00"), "KML: Koordinaten (lon,lat), Ordner, Datumsregel, Zeiten");
  check((kml.match(/<Placemark>/g) || []).length === 3 && (kml.match(/<Placemark>/g) || []).length === (kml.match(/<\/Placemark>/g) || []).length && !/<\/?(Folder|Document|kml)>[^<]*&(?!amp;)/.test(kml), "KML: 3 Orte, Tags gepaart");
  check(C.specialWhen({ ranges: [["2026-12-03", "2026-12-20"]], days: [3, 4, 5, 6] }) === "3.12.2026–20.12.2026, Do/Fr/Sa/So" && C.specialWhen({ dates: ["2026-11-14"] }) === "14.11.2026", "Datumstext von Spezialmärkten");
  // Echte Daten: alle Orte kommen in die KML (auch von Hand gepflegte, Märkte ausserhalb der Saison, Spezialmärkte)
  const allItems = globalThis.BF_HOF.items, allSpec = globalThis.BF_SPECIAL.items;
  const dupes = allItems.filter((a, i) => allItems.some((b, j) => j > i && a.k === b.k && a.n === b.n && C.distKm(a, b) < 0.05));
  check(dupes.length === 0, `Daten: kein Ort doppelt (gleiche Art, gleicher Name, < 50 m) ${dupes.slice(0, 3).map(d => d.n)}`);
  const kmlAll = C.kmlExport(allItems, allSpec, new Date(2026, 10, 10, 10, 0));
  check((kmlAll.match(/<Placemark>/g) || []).length === allItems.length + allSpec.length, `KML enthält alle ${allItems.length} Orte + ${allSpec.length} Spezialmärkte`);
  check(kmlAll.includes("<name>Rapperswiler Freitagsmarkt</name>") && kmlAll.includes("<name>Wochenmarkt Robenhausen</name>") && kmlAll.includes("<name>Zibelemärit</name>"), "KML: Freitagsmarkt, Robenhausen (von Hand gepflegt, Saison Mär–Nov) und Zibelemärit stehen drin");
  const lay = C.kmlLayers(allItems, allSpec, new Date(2026, 10, 10, 10, 0));
  check(["hof,bio,markt,spezial,automat", "hof,markt,spezial,automat"].includes(lay.map(l => l.key).join()), `Ebenen nach Art: ${lay.map(l => l.key + ":" + l.count)}`);
  check(lay.reduce((a, l) => a + l.count, 0) === allItems.length + allSpec.length && lay.length < 10, "jeder Ort in genau einer Ebene, unter 10 Ebenen");
  check(lay.every(l => l.file.startsWith("Obsonare – ") && l.file.endsWith(".kml") && l.kml.startsWith("<?xml") && l.kml.trim().endsWith("</kml>") && (l.kml.match(/<Placemark>/g) || []).length === l.count && (l.kml.match(/<\/Placemark>/g) || []).length === l.count && !/&(?!amp;|lt;|gt;|quot;)/.test(l.kml) && l.kml.includes("<styleUrl>#s</styleUrl>")), "jede Ebene: gültiges KML, Anzahl stimmt, Stil gesetzt");
  check(new Set(lay.map(l => /paddle\/([a-z-]+)\.png/.exec(l.kml)[1])).size === lay.length, "jede Ebene hat ihre eigene Farbe");
  check(lay.find(l => l.key === "markt").kml.includes("Rapperswiler Freitagsmarkt") && lay.find(l => l.key === "spezial").kml.includes("Zibelemärit") && !lay.find(l => l.key === "hof").kml.includes("Rapperswiler Freitagsmarkt"), "Freitagsmarkt in Wochenmärkte, Zibelemärit in Spezialmärkte, nicht doppelt");
  const sv = C.seasonVeg([{ name: "A", field_months: [11] }, { name: "B", field_months: [], storage_months: [11] }, { name: "C", field_months: [5] }, { name: "A2", field_months: [11] }], 11, it => it.name.replace("2", ""));
  check(sv.join() === "A,B", `Saisongemüse: Freiland zuerst, Lagerware danach, ohne Doppelte (${sv})`);
  // Spezialmärkte
  const d = x => C.nthWeekday(...x).getDate();
  check(d([2026, 11, 4, 0]) === 23 && d([2026, 11, 1, 2]) === 4 && d([2027, 11, 1, 2]) === 3, "4. Montag Nov 2026 = 23.; 1. Mittwoch Nov 2026 = 4., 2027 = 3.");
  check(d([2026, 11, -1, 0]) === 30 && C.nthWeekday(2026, 2, 5, 0) === null, "letzter Montag; 5. Montag im Feb fehlt");
  const sp = [
    { n: "Zibele", lat: 46.95, lon: 7.44, rule: { m: 11, nth: 4, wd: 0 } },
    { n: "Rüebli", lat: 47.39, lon: 8.04, rule: { m: 11, nth: 1, wd: 2 } },
    { n: "Chrischtchindli", lat: 47.23, lon: 8.82, ranges: [["2026-12-03", "2026-12-20"]], days: [3, 4, 5, 6] },
    { n: "Räbe", lat: 47.2, lon: 8.7, dates: ["2026-11-14"] }
  ];
  const up = C.specialUpcoming(sp, { ref: rap, now: di10 });
  check(up.map(e => e.n).join() === "Räbe,Zibele,Chrischtchindli", `nächste 6 Wochen: ${up.map(e => e.n)}`);
  check(up[1].first.getDate() === 23 && up[2].first.getDate() === 3 && up[2].count === 12 && up[2].last.getDate() === 20, "Termine: 14.11., 23.11.; Chrischtchindli Do–So ab 3.12. bis 20.12. (12 Tage)");
}

// Kochen (Plan-Ansicht): Stück auf halbe genau, Einkauf ganz (Joshua 18.11.)
check(C.formatCookAmount(0.5, "Stk", "Zwiebel", 0.5) === "½ Stk", "1 Zwiebel für 4, gekocht für 2 = ½ Stk");
check(C.formatCookAmount(1.5, "Stk", "Zwiebel", 1.5) === "1½ Stk" && C.formatCookAmount(0.75, "EL", "Öl", 0.75) === "1 EL", "1½ Stk; ¾ EL wird 1 EL (nur halbe)");
check(C.formatCookAmount(3, "Stk", "Ei", 1.5) === "3 Stk" && C.formatCookAmount(0.1, "Stk", "Ei", 0.1) === "½ Stk", "ganze Zahl bleibt ganz, kleinste Menge ½");
check(C.formatCookAmount(0.5, "Stk", "Salz", 0.5) === "1 Stk" && C.formatCookAmount(0.5, "Stk", "Einige Tropfen Zitronensaft", 0.5) === "1 Stk", "Salz / «einige Tropfen» nicht teilen");
check(C.formatCookAmount(200, "g", "Pilze", 0.5) === "200 g", "Gramm wie bisher");
check(C.formatAmount(0.5, "Stk") === "1 Stk" && C.formatAmount(1.5, "Stk") === "2 Stk", "Einkauf: halbe Zwiebel = 1 kaufen, 1½ = 2 kaufen");

// Benachrichtigungen: Ruhezeit, Wochenwahl-Text, wöchentliche Markt-/Hof-Erinnerung (Joshua 19.11.)
{
  const wc = C.wallClock(new Date("2026-11-20T18:30:00Z")); // Winterzeit: UTC+1
  check(wc.getHours() === 19 && wc.getMinutes() === 30 && wc.getDay() === 5, "Wanduhr Zürich: 18:30 UTC = Fr 19:30");
  check(C.wallClock(new Date("2026-07-01T06:00:00Z")).getHours() === 8, "Sommerzeit: 6:00 UTC = 8:00 in Zürich");
  check(C.isQuiet(new Date(2026, 10, 20, 21, 0)) && C.isQuiet(new Date(2026, 10, 20, 7, 59)) && !C.isQuiet(new Date(2026, 10, 20, 8, 0)) && !C.isQuiet(new Date(2026, 10, 20, 20, 59)), "Ruhezeit 21:00–8:00");
  const wg = [{ id: "joshua", name: "Joshua" }, { id: "leonie", name: "Leonie" }, { id: "lukas", name: "Lukas" }, { id: "jo", name: "Jo" }];
  const m1 = C.voteMessage(wg, { joshua: { likes: ["1"] }, leonie: { likes: ["2"] }, lukas: { likes: [] } }, "leonie", "2026-W48");
  check(m1.title === "Leonie hat für KW 48 gewählt" && m1.body === "Noch offen: Lukas, Jo" && !m1.all, "Stimme: «Leonie hat für KW 48 gewählt» · «Noch offen: Lukas, Jo»");
  const m2 = C.voteMessage(wg, Object.fromEntries(wg.map(m => [m.id, { likes: ["1"] }])), "jo", "2026-W48");
  check(m2.all && m2.title === "Alle haben gewählt" && m2.body === "Plan für KW 48 übernehmen", "letzte Stimme: «Alle haben gewählt»");

  const rob = { name: "Markt Robenhausen", oh: "Mar-Nov Sa 08:00-11:00", day: 5 };
  check(JSON.stringify(C.openDays(rob.oh, new Date(2026, 10, 10))) === "[5]", "Robenhausen: nur Samstag wählbar");
  check(JSON.stringify(C.openDays(rob.oh, new Date(2026, 11, 10))) === "[5]", "in der Winterpause: Tage der Woche, in der es wieder losgeht");
  check(C.openDays("", new Date()) === null, "Zeiten unbekannt: jeder Tag wählbar");
  const fri19 = new Date(2026, 10, 20, 19, 0), sat730 = new Date(2026, 10, 21, 7, 30);
  const eve = C.marketDue({ ...rob, when: "eve" }, fri19, null);
  check(eve && eve.date === "2026-11-21" && eve.title === "Morgen Markt Robenhausen 8–11", "Vorabend: Fr 19:00 «Morgen Markt Robenhausen 8–11»");
  check(!C.marketDue({ ...rob, when: "eve" }, new Date(2026, 10, 20, 18, 59), null), "vor 19:00 noch nicht");
  check(!C.marketDue({ ...rob, when: "eve" }, fri19, "2026-11-21"), "schon gesendet: nur einmal pro Woche");
  check(!C.marketDue({ ...rob, when: "eve" }, new Date(2026, 10, 20, 22, 30), null), "mehr als 3 h zu spät: nichts mehr");
  const pre = C.marketDue({ ...rob, when: "pre" }, sat730, null);
  check(pre && pre.title === "Heute Markt Robenhausen 8–11", "30 Min. vor Öffnung: Sa 7:30 «Heute …»");
  check(!C.marketDue({ ...rob, when: "pre" }, new Date(2026, 10, 21, 7, 29), null), "vor 7:30 noch nicht");
  check(!C.marketDue({ ...rob, when: "eve" }, new Date(2026, 11, 4, 19, 0), null), "Winterpause (Dezember): keine Erinnerung");
  const own = { name: "Bauer Meier", day: 2, when: "fix", time: "17:15" };
  const fix = C.marketDue(own, new Date(2026, 10, 18, 17, 20), null);
  check(fix && fix.title === "Heute Bauer Meier" && fix.date === "2026-11-18", "eigener Ort ohne Zeiten: Mi 17:15 «Heute Bauer Meier»");
  check(!C.marketDue(own, new Date(2026, 10, 19, 17, 20), null), "an einem anderen Tag nichts");
  check(C.marketDue({ ...own, when: "pre" }, new Date(2026, 10, 17, 19, 5), null).title === "Morgen Bauer Meier", "ohne Zeiten: «vor Öffnung» gilt als Vorabend");

  check(C.bringReminder(["Lauch", "Rüebli", "Eier", "Äpfel", "Milch", "Brot"]) === "6 Sachen auf Bring!: Lauch, Rüebli, Eier, Äpfel …" && C.bringReminder(["Milch"]) === "1 Sache auf Bring!: Milch" && C.bringReminder([]) === "", "Bring!-Text, leer = keine Erinnerung");
  const hits = C.searchFarms(globalThis.BF_HOF.items, "wetzikon robenhausen", { ref: { lat: 47.23, lon: 8.82 } });
  check(hits.length && hits[0].n === "Wochenmarkt Robenhausen", "Suche nach Ortschaft + Name findet den Markt");
  check(C.searchFarms(globalThis.BF_HOF.items, "", {}).length === 0, "leere Suche: nichts");
}

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
