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

function boot(preset) {
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
    }
  });
}

let fails = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

// 1. Migration alter Platzhalter + Rendering
const dom = boot({ bringfrisch_members: [{ id: "m1", name: "Jonas", diet: "vegi" }, { id: "m2", name: "Anna", diet: "vegan" }], bringfrisch_phone_bring_creds: { password: "x" } });
const w = dom.window, d = w.document;
check(errors.length === 0, `keine JS-Fehler beim Start ${errors.join(" | ")}`);
const rows = d.querySelectorAll("#days .day");
check(rows.length === 7, `7 Tage im Plan (${rows.length})`);
const chips = [...rows[0].querySelectorAll(".chip")].map(c => c.textContent);
check(chips.join(" ") === "J L Le Jo", `Kürzel J L Le Jo (${chips.join(" ")})`);
check(w.localStorage.getItem("bringfrisch_phone_bring_creds") === null, "alte Bring!-Zugangsdaten gelöscht");
const members = JSON.parse(w.localStorage.getItem("bringfrisch_members"));
check(members.map(m => m.name).join(",") === "Joshua,Lukas,Leonie,Jo", "Platzhalter durch echte WG ersetzt");

const count = () => parseInt(d.getElementById("ctaCount").textContent.replace(/\D/g, ""), 10);
const before = count();
check(before > 0, `Einkaufskorb hat Artikel (${before})`);
check(/Einkaufskorb: \d+ Artikel/.test(d.getElementById("basketLine").textContent), "Zusammenfassungszeile sichtbar");

// 2. Esser abwählen → Plan + Liste aktualisieren sich
const plan0 = () => JSON.parse(w.localStorage.getItem("bringfrisch_current_plan"));
rows[0].querySelector(".chip").click();
check(plan0()[0].eaters.length === 3, "Esser-Chip schaltet Anwesenheit");
check(d.querySelectorAll("#days .day")[0].querySelector(".chip").classList.contains("off"), "Chip neu gezeichnet (nicht veraltet)");

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
d.querySelector("#days [data-pick='2']").click();
check(d.getElementById("catalogDialog").open, "Katalog öffnet");
const assign = d.querySelector("#catalogList [data-assign]");
const title = assign.closest(".recipe").querySelector("b").textContent;
assign.click();
check(plan0()[2].title === title, `Rezept für Mi eingeplant (${title})`);

// 6. Eigenes Rezept
d.querySelector("#days [data-pick='3']").click();
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
check(d.querySelectorAll("#days .day")[0].querySelectorAll(".chip").length === 5, "neue Person erscheint im Plan");


// 9. Wochenwahl (Memory)
d.getElementById("openVoteBtn").click();
check(d.getElementById("voteDialog").open, "Wochenwahl öffnet");
const nRec = w.BRINGFRISCH_DATA.recipes.length + (w.recipeImporter.customRecipes.length);
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
check(linkDom.window.document.querySelectorAll("#days .day")[0].querySelectorAll(".chip").length === 1, "Plan-Link wird übernommen");

check(errors.length === 0, `keine JS-Fehler insgesamt ${errors.join(" | ")}`);
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
