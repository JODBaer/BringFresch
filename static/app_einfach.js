// Obsonare – «Einfach im <Monat>» (Schritt 0 «Einfach & saisonal», Joshua 25.11., Entwurf docs/design/einfach-saisonal-entwurf.html):
// Grundrezepte (standalone_data.js «bases») mit dem Gemüse vom Monat, ganz oben im Reiter Rezepte.
// Karte antippen = Blatt: Gemüse wählen, Zutaten für 4, was Fleisch-Esser/Vegis dazubekommen, Tag Mo–So = einplanen (mit «Rückgängig»).
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { CORE, DATA, DAYS, MONTHS, state, savePlan, $, esc, currentMonth, toast, allRecipes, makeDay, refresh } = app;

  const ICON = { hoernli: "🍝", gnocchi: "🥔", ofen: "🥕", curry: "🍛", rahm: "🍲", pfanne: "🥢", cafe: "☕", ritter: "🍞", kaese: "🧀" };
  let openBase = null, pick = {}; // offenes Grundrezept, gewählte Variante pro Grundrezept (nur in diesem Öffnen)

  const variants = baseId => CORE.baseVariants(allRecipes(), baseId, currentMonth());
  const bases = () => (DATA.bases || []).filter(b => variants(b.id).length);
  const current = baseId => { const v = variants(baseId); return v.find(r => r.id === pick[baseId]) || v[0]; };
  const amountText = i => [i.amount, i.unit].filter(Boolean).join(" ");

  function renderGrid() {
    $("easyMonth").textContent = MONTHS[currentMonth() - 1];
    $("easyGrid").innerHTML = bases().map(b => {
      const vs = variants(b.id), r = vs[0];
      return `<button type="button" class="easy-card" data-base="${esc(b.id)}">
        <span class="ic" aria-hidden="true">${ICON[b.id] || "🍽️"}</span>
        <b>${esc(b.title.replace(/ mit \{v\}.*$/, "").replace(/\{v\}/g, "…"))}</b>
        <small>${CORE.ingredientCount(r)} Zutaten · ${esc(CORE.timeText(r))}</small>
        <span class="easy-vegs">${vs.map(v => `<span>${esc(v.variant_label)}</span>`).join("")}</span>
      </button>`;
    }).join("");
  }

  // Wer bekommt was dazu? (Regeln «Alles für alle» in core.js; hier nur in Worten)
  function whoText(r) {
    const names = d => state.members.filter(m => (d === "fleisch" ? m.diet === "fleisch" : m.diet !== "fleisch")).map(m => m.name).join(", ");
    const vegis = names("vegi") || "Vegis", meaty = names("fleisch") || "Fleisch-Esser";
    if (r.no_addons) return "Für alle gleich, ohne Extra-Fleisch oder -Käse.";
    if (r.diet === "fleisch") return r.vegi_swap ? `${vegis}: ${r.vegi_swap.name} statt Fleisch.` : `${vegis}: Grillkäse statt Fleisch.`;
    return r.meat_swap ? `${meaty}: + ${r.meat_swap.name}. ${vegis}: Grillkäse/Halloumi.` : `${meaty}: + Speck oder Steak. ${vegis}: Grillkäse/Halloumi.`;
  }

  function renderSheet() {
    const r = current(openBase);
    if (!r) return;
    $("easyTitle").textContent = r.title;
    $("easySub").textContent = `${CORE.ingredientCount(r)} Zutaten · ${CORE.timeText(r)} · für ${r.servings}`;
    $("easyVariants").innerHTML = variants(openBase).map(v =>
      `<button type="button" data-variant="${esc(v.id)}" aria-pressed="${v.id === r.id}">${esc(v.variant_label)}</button>`).join("");
    const vegNames = new Set(((DATA.bases.find(b => b.id === openBase) || {}).variants || []).flatMap(v => v.items.map(i => i.name)));
    $("easyIng").innerHTML = r.ingredients.map(i =>
      `<li${vegNames.has(i.name) ? ' class="veg"' : ""}><span class="q">${esc(amountText(i))}</span><span>${esc(i.name)}</span></li>`).join("");
    $("easyWho").textContent = whoText(r);
    $("easySteps").textContent = r.instructions || "";
    $("easyWeek").textContent = `KW ${+app.shownWeek().split("W")[1]}`;
    $("easyDays").innerHTML = DAYS.map((d, i) => {
      const day = state.plan[i] || {};
      const here = !day.empty && String(day.id) === String(r.id);
      const lbl = day.empty || !day.title ? "frei" : here ? "hier" : day.title.split(" ")[0];
      return `<button type="button" data-day="${i}" aria-pressed="${here}">${d.slice(0, 2)}<small>${esc(lbl)}</small></button>`;
    }).join("");
  }

  function openSheet(baseId) {
    openBase = baseId;
    renderSheet();
    $("easyDialog").showModal();
  }

  $("easyGrid").addEventListener("click", e => {
    const c = e.target.closest("[data-base]");
    if (c) openSheet(c.dataset.base);
  });
  $("easyVariants").addEventListener("click", e => {
    const b = e.target.closest("[data-variant]");
    if (!b) return;
    pick[openBase] = b.dataset.variant;
    renderSheet();
  });
  $("easyDays").addEventListener("click", e => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    const idx = +b.dataset.day, recipe = current(openBase), previous = state.plan[idx];
    state.plan[idx] = makeDay(recipe, idx, previous);
    app.countDish(recipe.id);
    savePlan();
    refresh();
    renderSheet();
    const plan = state.plan;
    toast(`${DAYS[idx].slice(0, 2)}: ${recipe.title}`, {
      label: "Rückgängig",
      run: () => {
        if (state.plan !== plan) return toast("Woche gewechselt – nichts geändert");
        state.plan[idx] = previous; savePlan(); refresh();
        if ($("easyDialog").open) renderSheet();
        toast("Rückgängig gemacht");
      }
    });
  });

  app.subscribe(renderGrid);
  renderGrid();
  Object.assign(app, { openEasy: openSheet });
})();
