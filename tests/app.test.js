// App-Test (jsdom) für static/. Start: cd tests && npm install && npm test
// Smoke-Test für static/: lädt index.html in jsdom, führt Skripte aus, klickt Kernabläufe durch.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || path.join(__dirname, "..", "static");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8")
  .replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>${fs.readFileSync(path.join(root, f), "utf8")}</script>`);

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.message));
vc.on("error", e => errors.push(String(e)));

function boot(preset, fakeNow) {
  return new JSDOM(html, {
    url: "https://jodbaer.github.io/BringFresch/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { if (this.open) { this.open = false; this.dispatchEvent(new win.Event("close")); } };
      win.navigator.clipboard = { writeText: async () => {} };
      Object.entries(preset || {}).forEach(([k, v]) => win.localStorage.setItem(k, JSON.stringify(v)));
      if (fakeNow) { // feste Uhrzeit, z.B. Donnerstag
        const Real = win.Date;
        win.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [fakeNow])); } static now() { return new Real(fakeNow).getTime(); } };
      }
    }
  });
}

let fails = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

// 1. Migration alter Platzhalter + Rendering
const dom = boot({ bringfrisch_members: [{ id: "m1", name: "Jonas", diet: "vegi" }, { id: "m2", name: "Anna", diet: "vegan" }], bringfrisch_phone_bring_creds: { password: "x" } });
const w = dom.window, d = w.document;
check(errors.length === 0, `keine JS-Fehler beim Start ${errors.join(" | ")}`);
const rows = d.querySelectorAll("#days .prow");
check(rows.length === 7, `7 Tage im Plan (${rows.length})`);
const chips = [...rows[0].querySelectorAll(".av")].map(c => c.textContent);
check(chips.join(" ") === "J L Le Jo", `Kürzel J L Le Jo (${chips.join(" ")})`);
check(w.localStorage.getItem("bringfrisch_phone_bring_creds") === null, "alte Bring!-Zugangsdaten gelöscht");
const members = JSON.parse(w.localStorage.getItem("bringfrisch_members"));
check(members.map(m => m.name).join(",") === "Joshua,Lukas,Leonie,Jo", "Platzhalter durch echte WG ersetzt");

const count = () => parseInt(d.getElementById("ctaCount").textContent.replace(/\D/g, ""), 10);
const before = count();
check(before > 0, `Einkaufskorb hat Artikel (${before})`);
check(/\d+ Artikel/.test(d.getElementById("syncBtn").textContent), "Bring!-Chip oben zeigt die Anzahl");
check(!d.getElementById("basketLine"), "keine eigene Einkaufskorb-Karte mehr");

// 1b. Redesign: Tag = Menü auf/zu, nur eine Zeile offen, Zahl = Personen + Reste, antippen = +1
const row0 = () => d.querySelectorAll("#days .prow")[0];
row0().querySelector(".pday").click();
check(row0().classList.contains("open") && d.querySelectorAll("#days .prow.open").length === 1, "Tag antippen klappt das Menü auf");
check(row0().querySelectorAll(".ing li").length > 0 && /Wechseln/.test(row0().querySelector(".links").textContent), "Zutaten + «Wechseln» im offenen Menü");
const sameNode = d.querySelectorAll("#days .prow")[1];
d.querySelectorAll("#days .prow")[2].querySelector(".pday").click();
check(d.querySelectorAll("#days .prow")[1] === sameNode && !row0().classList.contains("open"), "Aufklappen zeichnet die anderen Zeilen nicht neu");
d.querySelectorAll("#days .prow")[2].querySelector(".pday").click();
const p0 = JSON.parse(w.localStorage.getItem("bringfrisch_current_plan"))[0];
const numBefore = +row0().querySelector(".num").textContent;
check(numBefore === p0.eaters.length + (p0.extra_guests || 0) + p0.leftover_buffer, `Zahl = Personen + Reste (${numBefore})`);
row0().querySelector(".num").click();
check(+row0().querySelector(".num").textContent === numBefore + 1 && /\+3/.test(row0().querySelector(".plus").textContent), "Zahl antippen = +1 Reste, Hochzahl +3");
for (let k = 0; k < 4; k++) row0().querySelector(".num").click();
check(JSON.parse(w.localStorage.getItem("bringfrisch_current_plan"))[0].leftover_buffer === 0, "nach +6 wieder +0");
for (let k = 0; k < 2; k++) row0().querySelector(".num").click();

// 2. Esser abwählen → Plan + Liste aktualisieren sich
const plan0 = () => JSON.parse(w.localStorage.getItem("bringfrisch_current_plan"));
d.querySelectorAll("#days .prow")[0].querySelector(".av").click();
check(plan0()[0].eaters.length === 3, "Esser-Chip schaltet Anwesenheit");
check(d.querySelectorAll("#days .prow")[0].querySelector(".av").classList.contains("off"), "Chip neu gezeichnet (nicht veraltet)");

// 3. Reste-Puffer 0…6
const sel = d.querySelectorAll("#days .buf")[1];
check(sel.options.length === 7 && sel.options[6].textContent === "+6", "Puffer-Auswahl +0 … +6");
sel.value = "6"; sel.dispatchEvent(new w.Event("change", { bubbles: true }));
check(plan0()[1].leftover_buffer === 6, "Puffer +6 gespeichert");

// 4. Skalierung: Rezepte für 4 Portionen
const shop = [...d.querySelectorAll("#shopList .item")].map(i => i.textContent.trim());
check(shop.length > 0, `Einkaufsliste gerendert (${shop.length} Zeilen)`);
check(shop.every(s => !/\d\.\d{3,}/.test(s)), "keine krummen Mengen wie 333.3333");

// 5. Katalog → Rezept zuweisen
// Menü wechseln: Blatt mit Suche, «Beliebt bei euch», eigenes Menü
d.querySelector("#days [data-pick='2']").click();
check(d.getElementById("msheet").classList.contains("show"), "Gericht antippen öffnet «Menü wechseln»");
check(/Beliebt bei euch/.test(d.getElementById("mlist").textContent) && /♥ \d+×/.test(d.getElementById("mlist").textContent), "«Beliebt bei euch» mit ♥ n×");
d.getElementById("msearch").value = "Älpler";
d.getElementById("msearch").dispatchEvent(new w.Event("input"));
const hit = d.querySelector("#mlist .opt[data-id]");
const hitTitle = hit.querySelector(".n").textContent;
hit.click();
check(plan0()[2].title === hitTitle && !d.getElementById("msheet").classList.contains("show"), `Suche + Wahl setzt Menü (${hitTitle})`);
check(/Rückgängig/.test((d.querySelector(".toast") || {}).textContent || ""), "Hinweis mit «Rückgängig»");
d.querySelector(".toast button").click();
check(plan0()[2].title !== hitTitle, "Rückgängig stellt das alte Menü her");
d.querySelector("#days [data-pick='4']").click();
d.getElementById("msearch").value = "Pizza bestellen";
d.getElementById("msearch").dispatchEvent(new w.Event("input"));
d.querySelector("#mlist .opt[data-new]").click();
check(plan0()[4].title === "Pizza bestellen", "eigenes Menü eintippen");

d.querySelector("#days [data-pick='2']").click();
d.querySelector("#mlist [data-catalog]").click();
check(d.getElementById("catalogDialog").open, "Katalog öffnet");
const assign = d.querySelector("#catalogList [data-assign]");
const title = assign.closest(".recipe").querySelector("b").textContent;
assign.click();
check(plan0()[2].title === title, `Rezept für Mi eingeplant (${title})`);

// 6. Eigenes Rezept
d.querySelector("#days [data-pick='3']").click();
d.querySelector("#mlist [data-catalog]").click();
d.getElementById("newRecipeBtn").click();
d.getElementById("recipeTitle").value = "Testgratin";
d.getElementById("recipeServings").value = "2";
d.getElementById("recipeIngredients").value = "500 g Lauch\n2 Stk Zwiebeln\n500 Gemüsebouillon";
d.getElementById("recipeForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
const p = plan0()[3];
check(p.title === "Testgratin" && p.servings === 2, "eigenes Rezept gespeichert und eingeplant");
check(p.ingredients[2].name === "Gemüsebouillon" && p.ingredients[2].unit === "Stk", "Parser: '500 Gemüsebouillon' wird nicht als 'g emüsebouillon' gelesen");

// 7. Mitbewohner hinzufügen
d.getElementById("newMemberName").value = "Mia";
d.getElementById("addMemberForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
check(d.querySelectorAll("#days .prow")[0].querySelectorAll(".av").length === 5, "neue Person erscheint im Plan");


// 9. Wochenwahl (Memory)
d.getElementById("openVoteBtn").click();
check(d.getElementById("voteDialog").open, "Wochenwahl öffnet");
const nRec = w.BRINGFRISCH_DATA.recipes.length + (w.BRINGFRISCH_IMPORTED || []).length + w.recipeImporter.customRecipes.length;
const cards = () => [...d.querySelectorAll("#voteGrid .vcard")];
check(cards().length === Math.min(14, nRec), `Raster zeigt ${Math.min(14, nRec)} Gerichte (${cards().length})`);
const titleOf = c => c.querySelector(".vt").textContent;
const t0 = titleOf(cards()[0]), t1 = titleOf(cards()[1]);
const meSel = d.getElementById("voteMe");
const setMe = id => { meSel.value = id; meSel.dispatchEvent(new w.Event("change")); };
setMe("joshua");
cards()[0].querySelector("[data-like]").click();
setMe("jo");
cards()[0].querySelector("[data-like]").click();
cards()[1].querySelector("[data-like]").click();
cards()[1].querySelector("[data-wish][data-day='4']").click();
check(cards()[0].querySelectorAll(".mini").length === 2, "Stimmen-Kürzel auf der Karte (J + Jo)");
check(d.querySelector("#voteRank .rank-row .t").textContent === t0, "Ranking: meistgewähltes Gericht oben");
d.getElementById("voteShuffleBtn").click();
check(titleOf(cards()[0]) === t0 && titleOf(cards()[1]) === t1, "Mischeln behält gewählte Gerichte");
d.getElementById("voteAddBtn").click();
check(d.getElementById("catalogDialog").open && /Wochenwahl/.test(d.getElementById("catalogSubtitle").textContent), "+ Gericht öffnet Katalog im Wochenwahl-Modus");
d.querySelector("#catalogList [data-assign]").click();
check(d.getElementById("voteDialog").open && !d.getElementById("catalogDialog").open, "zurück in der Wochenwahl nach Hinzufügen");
d.getElementById("voteApplyBtn").click();
const pl = plan0();
check(pl[4].title === t1, `Wunschtag Fr wird respektiert (${pl[4].title})`);
check(pl.some(x => x.title === t0), "Top-Gericht ist im Plan");
check(!d.getElementById("voteDialog").open, "Wochenwahl schliesst nach Übernahme");

// 8. Plan-Link round trip
const shareDom = boot();
const payload = Buffer.from(JSON.stringify({ v: 2, members: [{ id: "a", name: "Alex", diet: "vegi" }], weekPlan: plan0() })).toString("base64");
const linkDom = new JSDOM(html, { url: `https://jodbaer.github.io/BringFresch/#plan=${encodeURIComponent(payload)}`, runScripts: "dangerously", virtualConsole: vc,
  beforeParse(win) { win.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; win.HTMLDialogElement.prototype.close = function () { this.open = false; }; } });
check(linkDom.window.document.querySelectorAll("#days .prow")[0].querySelectorAll(".av").length === 1, "Plan-Link wird übernommen");

// 9. Schnelles & Reste
const R = id => w.BRINGFRISCH_DATA.recipes.find(r => r.id === id);
const wg = ["joshua", "lukas", "leonie", "jo"];
const qday = (id, i) => ({ ...R(id), day: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][i], eaters: wg, leftover_buffer: 0, extra_guests: 0 });
const qDom = boot({
  bringfrisch_members: [{ id: "joshua", name: "Joshua", diet: "fleisch" }, { id: "lukas", name: "Lukas", diet: "fleisch" }, { id: "leonie", name: "Leonie", diet: "fleisch" }, { id: "jo", name: "Jo", diet: "vegi" }],
  bringfrisch_current_plan: [qday("chicken_nuggets", 0), ...[1, 2, 3, 4, 5, 6].map(i => qday("resteessen", i))],
});
const qd = qDom.window.document;
qd.querySelector('[data-tab="shop"]') && qd.querySelector('[data-tab="shop"]').click();
const qshop = [...qd.querySelectorAll("#shopList .item")].map(i => i.textContent.replace(/\s+/g, " ").trim());
check(qshop.some(t => /Vegi-Nuggets/.test(t)) && !qshop.some(t => /Grillkäse/.test(t)), `Jo bekommt Vegi-Nuggets statt Grillkäse (${qshop.join(" | ")})`);
check(!qshop.some(t => /Speckwürfeli/.test(t)), "kein Extra-Fleisch zu Nuggets");
check(qshop.length <= 6, `Resteessen-Tage kaufen nichts ein (${qshop.length} Zeilen)`);
check(qshop.every(t => !/^Schweizer /.test(t)), "«Schweizer» steht nicht mehr vor dem Namen");
qd.getElementById("openVoteBtn").click();
const quickCards = [...qd.querySelectorAll("#voteGrid .vm")].filter(e => /⚡|♻️/.test(e.textContent)).length;
check(quickCards === 2, `2 schnelle/Reste-Gerichte im Memory (${quickCards})`);

// 10. Ab Donnerstag: nächste Woche planen
const wed = boot({}, "2026-11-11T12:00:00");
check(wed.window.document.getElementById("weekChip").hidden, "Mittwoch: kein Wochen-Chip");
const thuDom = boot({ "bringfrisch_wahl_2026-W46": true }, "2026-11-12T12:00:00");
const td = thuDom.window.document;
const chip = td.getElementById("weekChip");
check(!chip.hidden && /KW 47/.test(chip.textContent), `Donnerstag: Chip «KW 47 →» (${chip.textContent})`);
check(td.getElementById("openVoteBtn").classList.contains("due"), "roter Punkt: nächste Woche noch offen");
const curTitles = [...td.querySelectorAll("#days .prow .t")].map(e => e.textContent).join("|");
const heightBefore = td.querySelectorAll("#days .prow").length;
chip.click();
check(/KW 47 · nächste Woche/.test(td.getElementById("weekLabel").textContent), "Kopfzeile: KW 47 · nächste Woche");
check(td.querySelectorAll("#days .prow").length === heightBefore && td.querySelectorAll("#days .prow.empty").length === 7, "nächste Woche: 7 offene Tage, gleiches Raster");
check(!td.querySelector("#days .prow.today"), "kein «heute» in der nächsten Woche");
check(/^0 Artikel/.test(td.getElementById("ctaCount").textContent), `offene Tage kaufen nichts (${td.getElementById("ctaCount").textContent})`);
td.querySelectorAll("#days .prow")[0].querySelector(".t").click();
td.querySelector("#mlist [data-id]") && td.querySelector("#mlist [data-id]").click();
const nd = JSON.parse(thuDom.window.localStorage.getItem("bringfrisch_next_plan"));
check(nd && nd.week === "2026-W47" && !nd.plan[0].empty, "Menü für nächsten Montag gewählt und gespeichert");
check([...td.querySelectorAll("#days .prow .t")].map(e => e.textContent).join("|") !== curTitles, "angezeigte Woche ist die nächste");
td.getElementById("openVoteBtn").click();
check(/KW 47/.test(td.getElementById("voteSubtitle").textContent), "Wochenwahl gilt für KW 47");
td.getElementById("voteDialog").close();
chip.click();
check([...td.querySelectorAll("#days .prow .t")].map(e => e.textContent).join("|") === curTitles, "zurück: laufende Woche unverändert");
check(JSON.parse(thuDom.window.localStorage.getItem("bringfrisch_current_plan"))[0].title === curTitles.split("|")[0], "laufender Plan nicht überschrieben");
// Montag darauf: geplante Woche wird zur laufenden
const nextPlan = nd.plan.map((x, i) => (x.empty ? { ...nd.plan[0], day: x.day } : x));
const monDom = boot({ bringfrisch_current_plan: JSON.parse(thuDom.window.localStorage.getItem("bringfrisch_current_plan")), bringfrisch_plan_week: "2026-W46", bringfrisch_next_plan: { ...nd, plan: nextPlan } }, "2026-11-16T09:00:00");
check(JSON.parse(monDom.window.localStorage.getItem("bringfrisch_current_plan"))[0].title === nextPlan[0].title && !monDom.window.localStorage.getItem("bringfrisch_next_plan"), "Montag: geplante Woche wird zur laufenden");

check(errors.length === 0, `keine JS-Fehler insgesamt ${errors.join(" | ")}`);
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
