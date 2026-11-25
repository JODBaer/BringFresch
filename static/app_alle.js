// Obsonare – Reiter Rezepte = «Alle Rezepte» (Joshua 14.11. / 25.11., Entwurf docs/design/review-2511-entwurf.html):
// kleine Memory-Karten (3 pro Zeile), Abschnitte ausklappbar (6 Karten, «Alle zeigen»), Ordnen (pro Handy gemerkt),
// Karte antippen = umdrehen, Tag Mo–So = einplanen. Grundrezepte haben das Add-on «Saison» (Gemüse vom Monat, antippen = wechseln).
// «+ Einfügen» öffnet das Blatt mit Link, Rezeptseiten, Text, Von Hand (Logik in app_rezepte.js).
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { CORE, DATA, STORE, DAYS, MONTHS, state, savePlan, load, save, $, esc, currentMonth, toast, allRecipes, makeDay, DIET_LABEL, refresh,
    recipeHref, recipeLinkLabel, inSeason, canPlanNext, isoWeek, plusWeek } = app;

  const SHOW = 6; // Karten pro Abschnitt, Rest mit «Alle zeigen» (Joshua 25.11.)
  let open = null; // umgedrehte Karte (Rezept-ID)
  let query = "";
  const closed = new Set(); // zugeklappte Abschnitte
  const more = new Set(); // Abschnitte mit allen Karten
  const pick = {}; // Rezept-ID → gewähltes Gemüse (Add-on «Saison»)
  const filter = {}; // feiner filtern: simple, quick, protein, vegi (an/aus), veg (Hauptgemüse)
  const sortMode = () => { const m = load(STORE.KEYS.RECIPE_SORT_KEY, "herkunft"); return CORE.RECIPE_SORTS.some(([k]) => k === m) ? m : "herkunft"; };

  // An welchen Tagen der angezeigten Woche steht das Gericht schon?
  const daysOf = id => state.plan.map((d, i) => (d && !d.empty && String(d.id) === id ? i : -1)).filter(i => i >= 0);
  // Gemüse (season_items-Id oder Name) → kurzer Name für «Hauptgemüse»
  const vegName = v => {
    const s = (DATA.season_items || []).find(x => x.id === v);
    return s ? s.name.replace(/^Schweizer /, "").replace(/\s*\(.*\)$/, "") : String(v);
  };
  // Grundrezept mit dem gewählten Gemüse (sonst dem vom Monat)
  const seasonal = r => (r.addons ? CORE.withSeason(r, pick[String(r.id)], currentMonth()) : r);

  function weekText() {
    const kw = +app.shownWeek().split("W")[1];
    return `KW ${kw}${state.viewNext ? " (nächste Woche)" : ""} · Karte antippen, dann Tag wählen`;
  }

  function card(r, month) {
    const id = String(r.id);
    const on = daysOf(id);
    const href = recipeHref(r);
    const img = app.imgSpan(r); // gemeinsamer Bild-Lader (app_wahl.js)
    const a = CORE.activeMin(r), t = CORE.totalMin(r); // aktive Zeit zählt, Ofen daneben steht dabei (Joshua 25.11.)
    const meta = `${r.is_leftovers ? "♻️" : r.quick ? "⚡" : DIET_LABEL[r.diet] || "Vegi"} · ${a}′${t > a ? ` · ${t}′ total` : ""}`;
    const s = r.addons ? seasonal(r) : null;
    return `
      <div class="vcard acard${on.length ? " on" : ""}${open === id ? " open" : ""}${inSeason(r, month) ? "" : " off"}" data-id="${esc(id)}">
        <div class="vflip">
          <div class="vfront" role="button" tabindex="0" aria-label="${esc(r.title)} einplanen">
            ${img}
            <span class="vshade" aria-hidden="true"></span>
            <span class="vband"><span class="vbt">${esc(r.title)}</span><span class="vbm">${meta}</span></span>
            ${on.length ? `<span class="vwish">${on.map(i => DAYS[i].slice(0, 2)).join(" ")}</span>` : ""}
          </div>
          <div class="vback" role="group" aria-label="${esc(r.title)}">
            <span class="ab-t">${esc(r.title)}</span>
            ${s ? `<button type="button" class="ab-addon" data-season="${esc(id)}" title="Gemüse vom Monat wechseln">🥬 + ${esc(s.season_label)}</button>` : ""}
            <span class="days-pick" role="group" aria-label="Einplanen für">${DAYS.map((d, i) =>
              `<button type="button" data-plan="${esc(id)}" data-day="${i}" aria-pressed="${on.includes(i)}"${state.plan[i] && !state.plan[i].empty && String(state.plan[i].id) !== id ? ` title="ersetzt ${esc(state.plan[i].title)}"` : ""}>${d.slice(0, 2)}</button>`).join("")}</span>
            ${href ? `<a class="ab-go" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(recipeLinkLabel(r))}">🌐 Rezept</a>` : ""}
          </div>
        </div>
      </div>`;
  }

  function render() {
    $("allSubtitle").textContent = weekText();
    const weeks = $("allWeeks");
    weeks.hidden = !canPlanNext();
    if (!weeks.hidden) {
      weeks.innerHTML = [false, true].map(next =>
        `<button type="button" data-next="${next}" aria-pressed="${state.viewNext === next}">KW ${isoWeek(next ? plusWeek() : new Date())}</button>`).join("");
    }
    const mode = sortMode();
    $("recipeSort").innerHTML = CORE.RECIPE_SORTS.map(([k, l]) => `<option value="${k}"${k === mode ? " selected" : ""}>${l}</option>`).join("");
    const q = query.trim();
    const found = allRecipes().filter(r => CORE.recipeMatches(r, q)); // gleiche Suchregel wie Menü-Blatt und Katalog
    const diet = (app.meMember() || {}).diet;
    const list = found.filter(r => CORE.recipeFilter(r, filter, diet, vegName));
    // Filter-Chips: an/aus; Hauptgemüse = die häufigsten der Treffer (ohne Gemüse-Filter gezählt)
    const vegCount = new Map();
    found.filter(r => CORE.recipeFilter(r, { ...filter, veg: "" }, diet, vegName)).forEach(r => { const v = CORE.mainVeg(r, vegName); if (v) vegCount.set(v, (vegCount.get(v) || 0) + 1); });
    const vegs = [...vegCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de")).slice(0, 30).map(([v]) => v);
    if (filter.veg && !vegs.includes(filter.veg)) vegs.unshift(filter.veg);
    $("recipeFilters").innerHTML = CORE.RECIPE_FILTERS.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${!!filter[k]}">${esc(l)}</button>`).join("")
      + `<label class="rz-veg${filter.veg ? " on" : ""}"><select id="recipeVeg" aria-label="Hauptgemüse"><option value="">🥬 Gemüse</option>${vegs.map(v => `<option value="${esc(v)}"${v === filter.veg ? " selected" : ""}>🥬 ${esc(v)}</option>`).join("")}</select></label>`;
    const month = currentMonth();
    const groups = CORE.recipeGroups(list, mode, month, vegName);
    $("allCount").textContent = `${list.length} Rezepte`;
    $("allList").innerHTML = groups.length === 0
      ? `<div class="empty">Keine Rezepte gefunden.</div>`
      : groups.map(g => {
        const isOpen = !closed.has(g.key) || !!q; // beim Suchen alles offen
        const all = more.has(g.key) || !!q;
        const label = g.key === "einfach" ? `Einfach im ${MONTHS[month - 1]}` : g.label;
        const shown = all ? g.recipes : g.recipes.slice(0, SHOW);
        return `
        <section class="asec asrc" data-src="${esc(g.key)}" data-open="${isOpen}">
          <button type="button" class="asec-h" data-sec="${esc(g.key)}" aria-expanded="${isOpen}">${esc(label)} <small>${g.recipes.length}</small><i aria-hidden="true">›</i></button>
          ${isOpen ? `<div class="agrid">${shown.map(r => card(r, month)).join("")}${shown.length < g.recipes.length ? `<button type="button" class="amore" data-more="${esc(g.key)}">Alle ${g.recipes.length} zeigen</button>` : ""}</div>` : ""}
        </section>`;
      }).join("");
    app.watchImages($("allList"), null); // Bilder erst laden, wenn die Karte sichtbar wird
  }

  function flipTo(id) {
    open = id;
    document.querySelectorAll("#allList .acard").forEach(c => c.classList.toggle("open", c.dataset.id === open));
  }

  $("allSearch").oninput = () => { query = $("allSearch").value; open = null; render(); };
  $("recipeSort").onchange = () => { save(STORE.KEYS.RECIPE_SORT_KEY, $("recipeSort").value); open = null; closed.clear(); more.clear(); render(); };
  $("recipeFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter[b.dataset.filter] = !filter[b.dataset.filter];
    open = null; render();
  });
  $("recipeFilters").addEventListener("change", e => {
    if (e.target.id !== "recipeVeg") return;
    filter.veg = e.target.value;
    open = null; render();
  });
  $("allWeeks").addEventListener("click", e => {
    const b = e.target.closest("[data-next]");
    if (!b) return;
    app.setWeekView(b.dataset.next === "true");
    render();
  });

  $("allList").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("vfront")) { e.preventDefault(); e.target.click(); }
  });
  $("allList").addEventListener("click", e => {
    if (e.target.closest("a")) return; // Link zum Rezept: öffnen, nicht umdrehen
    const sec = e.target.closest("[data-sec]");
    if (sec) { const k = sec.dataset.sec; closed.has(k) ? closed.delete(k) : closed.add(k); return render(); }
    const mo = e.target.closest("[data-more]");
    if (mo) { more.add(mo.dataset.more); return render(); }
    const add = e.target.closest("[data-season]");
    if (add) { // Add-on «Saison»: nächstes Gemüse, das jetzt Saison hat
      const r = allRecipes().find(x => String(x.id) === add.dataset.season);
      const opts = r ? CORE.seasonChoices(r, currentMonth()) : [];
      if (opts.length) {
        const cur = seasonal(r).season_key;
        pick[add.dataset.season] = opts[(opts.findIndex(o => o.key === cur) + 1) % opts.length].key;
        render();
      }
      return;
    }
    const btn = e.target.closest("[data-plan]");
    if (btn) {
      const idx = +btn.dataset.day;
      const found = allRecipes().find(r => String(r.id) === btn.dataset.plan);
      if (!found) return;
      const recipe = seasonal(found);
      const previous = state.plan[idx];
      // schon an diesem Tag? nochmals antippen = wieder abwählen (Tag wird offen, Esser/Gäste/Puffer bleiben)
      const off = !!previous && !previous.empty && String(previous.id) === String(recipe.id);
      state.plan[idx] = off
        ? { ...app.emptyDay(idx), eaters: [...(previous.eaters || [])], leftover_buffer: previous.leftover_buffer, extra_guests: previous.extra_guests || 0 }
        : makeDay(recipe, idx, previous);
      if (!off) app.countDish(recipe.id);
      savePlan();
      refresh();
      open = String(recipe.id); // Karte bleibt offen: weitere Tage wählen oder gleich wieder abwählen
      render();
      const plan = state.plan;
      toast(off ? `${DAYS[idx].slice(0, 2)}: ${recipe.title} abgewählt – Tag ist offen` : `${DAYS[idx].slice(0, 2)}: ${recipe.title}`, {
        label: "Rückgängig",
        run: () => {
          if (state.plan !== plan) return toast("Woche gewechselt – nichts geändert");
          state.plan[idx] = previous; savePlan(); refresh();
          toast("Rückgängig gemacht");
        }
      });
      return;
    }
    const c = e.target.closest(".acard");
    if (c) flipTo(open === c.dataset.id ? null : c.dataset.id);
  });

  // «+ Einfügen»: Blatt mit Link, Rezeptseiten, Text, Von Hand
  $("addRecipeBtn").onclick = () => { app.renderSites(); $("addDialog").showModal(); };
  const form = focusId => { $("addDialog").close(); state.catalogMode = "save"; app.openRecipeForm(); if (focusId) $(focusId).focus(); };
  $("addTextBtn").onclick = () => form("recipeUrl"); // Link-Feld nimmt auch geteilten Text
  $("addHandBtn").onclick = () => form("recipeTitle");

  // Reiter offen: nach jeder Änderung neu zeichnen (Plan-Tage auf den Karten, Woche, neue Rezepte)
  app.subscribe(() => { if (!$("tab-season").hidden) render(); });
  Object.assign(app, { renderRecipes: render });
})();
