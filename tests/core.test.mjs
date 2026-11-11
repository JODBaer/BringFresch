// Regeln direkt (ohne Browser): static/core.js läuft in Node genauso wie in der App und im WG-Server.
// Start: cd tests && node core.test.mjs
import path from "path";
const root = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "static");
globalThis.window = globalThis; // bring_catalog.js legt den Katalog wie im Browser unter window ab
await import("file:///" + path.join(root, "bring_catalog.js").replace(/\\/g, "/"));
await import("file:///" + path.join(root, "core.js").replace(/\\/g, "/"));
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
const votes = { a: { likes: ["x", "y"], days: { y: 2 } }, b: { likes: ["y"], days: {} }, c: { likes: [], days: {} } };
check(C.ranking(["x", "y", "z"], ms, votes).map(r => r.id).join() === "y,x,z", "Rangliste: 2 Stimmen vor 1 vor 0");
const week = Array.from({ length: 7 }, () => ({ eaters: ["a", "b", "c"] }));
check(C.assignDays(["y", "x"], week, ms, votes).y === 2, "Wunschtag Mittwoch wird respektiert");
week[2].eaters = ["c"]; week[0].eaters = ["a", "b"];
check(C.assignDays(["x"], week, ms, votes).x === 0, "ohne Wunschtag: Tag, an dem die Fans da sind");

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
