// Obsonare – «Alle Rezepte»: kleine Memory-Karten, nach Herkunft (Swissmilk, Fooby …) und Saison, Karte antippen = für einen Tag einplanen.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { CORE, DAYS, state, savePlan, $, esc, currentMonth, toast, allRecipes, makeDay, DIET_LABEL, refresh,
    recipeHref, recipeLinkLabel, inSeason, canPlanNext, isoWeek, plusWeek } = app;

  let open = null; // umgedrehte Karte (Rezept-ID)
  let query = "";

  // An welchen Tagen der angezeigten Woche steht das Gericht schon?
  const daysOf = id => state.plan.map((d, i) => (d && !d.empty && String(d.id) === id ? i : -1)).filter(i => i >= 0);

  function weekText() {
    const kw = +app.shownWeek().split("W")[1];
    return `KW ${kw}${state.viewNext ? " (nächste Woche)" : ""}`;
  }

  function card(r) {
    const id = String(r.id);
    const on = daysOf(id);
    const href = recipeHref(r);
    const emoji = app.dishEmoji(r);
    const img = r.source_url && app.connected()
      ? `<span class="vimg${app.imgState(r.source_url)}" data-img="${esc(r.source_url)}" data-emoji="${emoji}" aria-hidden="true"${app.imgCache.get(r.source_url) ? ` style="background-image:url(${app.imgCache.get(r.source_url)})"` : ""}></span>`
      : `<span class="vimg none" data-emoji="${emoji}" aria-hidden="true"></span>`;
    const meta = `${r.is_leftovers ? "♻️" : r.quick ? "⚡" : DIET_LABEL[r.diet] || "Vegi"} · ${r.prep_time_min || 30}′`;
    return `
      <div class="vcard acard${on.length ? " on" : ""}${open === id ? " open" : ""}" data-id="${esc(id)}">
        <div class="vflip">
          <div class="vfront" role="button" tabindex="0" aria-label="${esc(r.title)} einplanen">
            ${img}
            <span class="vshade" aria-hidden="true"></span>
            <span class="vband"><span class="vbt">${esc(r.title)}</span><span class="vbm">${meta}</span></span>
            ${on.length ? `<span class="vwish">${on.map(i => DAYS[i].slice(0, 2)).join(" ")}</span>` : ""}
          </div>
          <div class="vback" role="group" aria-label="${esc(r.title)}">
            <span class="ab-t">${esc(r.title)}</span>
            <span class="days-pick" role="group" aria-label="Einplanen für">${DAYS.map((d, i) =>
              `<button type="button" data-plan="${esc(id)}" data-day="${i}" aria-pressed="${on.includes(i)}"${state.plan[i] && !state.plan[i].empty && String(state.plan[i].id) !== id ? ` title="ersetzt ${esc(state.plan[i].title)}"` : ""}>${d.slice(0, 2)}</button>`).join("")}</span>
            ${href ? `<a class="ab-go" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(recipeLinkLabel(r))}">🌐 Rezept</a>` : ""}
          </div>
        </div>
      </div>`;
  }

  function render() {
    $("allSubtitle").textContent = `${weekText()} · Karte antippen, dann Tag wählen`;
    const weeks = $("allWeeks");
    weeks.hidden = !canPlanNext();
    if (!weeks.hidden) {
      weeks.innerHTML = [false, true].map(next =>
        `<button type="button" data-next="${next}" aria-pressed="${state.viewNext === next}">KW ${isoWeek(next ? plusWeek() : new Date())}</button>`).join("");
    }
    const q = query.toLowerCase().trim();
    const list = allRecipes().filter(r => !q || [r.title, ...(r.ingredients || []).map(i => i.name)].join(" ").toLowerCase().includes(q));
    const month = currentMonth();
    const groups = CORE.groupBySource(list, month);
    $("allCount").textContent = `${list.length} Rezepte`;
    $("allList").innerHTML = groups.length === 0
      ? `<div class="empty">Keine Rezepte gefunden.</div>`
      : groups.map(g => {
        const fresh = g.recipes.filter(r => inSeason(r, month));
        const later = g.recipes.filter(r => !inSeason(r, month));
        return `
        <section class="asrc" data-src="${esc(g.key)}">
          <h3>${esc(g.label)} <small>${g.recipes.length}</small></h3>
          ${fresh.length ? `<div class="agrid">${fresh.map(card).join("")}</div>` : ""}
          ${later.length ? `<p class="aoff">Gerade nicht Saison</p><div class="agrid off">${later.map(card).join("")}</div>` : ""}
        </section>`;
      }).join("");
    watchImages();
  }

  // Bilder erst laden, wenn die Karte sichtbar wird (der WG-Server holt jedes Bild einmal), höchstens 3 gleichzeitig
  let observer = null;
  const queue = [];
  let running = 0;
  function show(u) {
    document.querySelectorAll("#allList .vimg[data-img]").forEach(e => {
      if (e.dataset.img !== u || !app.imgCache.has(u)) return;
      const src = app.imgCache.get(u);
      e.className = `vimg${src ? " ok" : " none"}`;
      if (src) e.style.backgroundImage = `url(${src})`;
    });
  }
  function pump() {
    while (running < 3 && queue.length) {
      const u = queue.shift();
      if (app.imgCache.has(u)) { show(u); continue; }
      running++;
      app.loadImg(u).catch(() => {}).finally(() => { running--; show(u); pump(); });
    }
  }
  function watchImages() {
    if (observer) observer.disconnect();
    if (!app.connected() || typeof IntersectionObserver === "undefined") return;
    observer = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      observer.unobserve(en.target);
      const u = en.target.dataset.img;
      if (!app.imgCache.has(u) && !queue.includes(u)) queue.push(u);
      pump();
    }), { root: $("allDialog").querySelector(".sheet-body"), rootMargin: "200px" });
    document.querySelectorAll("#allList .vimg[data-img]:not(.ok):not(.none)").forEach(e => observer.observe(e));
  }

  function flipTo(id) {
    open = id;
    document.querySelectorAll("#allList .acard").forEach(c => c.classList.toggle("open", c.dataset.id === open));
  }

  function openAll() {
    open = null;
    query = "";
    $("allSearch").value = "";
    render();
    $("allDialog").showModal();
    $("allDialog").querySelector(".sheet-body").scrollTop = 0;
  }
  $("allRecipesBtn").onclick = openAll;
  $("allDialog").addEventListener("close", () => { if (observer) observer.disconnect(); });

  $("allSearch").oninput = () => { query = $("allSearch").value; open = null; render(); };
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
    const btn = e.target.closest("[data-plan]");
    if (btn) {
      const idx = +btn.dataset.day;
      const recipe = allRecipes().find(r => String(r.id) === btn.dataset.plan);
      if (!recipe) return;
      const previous = state.plan[idx];
      state.plan[idx] = makeDay(recipe, idx, previous);
      app.countDish(recipe.id);
      savePlan();
      refresh();
      open = null;
      render();
      const plan = state.plan;
      toast(`${DAYS[idx].slice(0, 2)}: ${recipe.title}`, {
        label: "Rückgängig",
        run: () => {
          if (state.plan !== plan) return toast("Woche gewechselt – nichts geändert");
          state.plan[idx] = previous; savePlan(); refresh();
          if ($("allDialog").open) render();
          toast("Rückgängig gemacht");
        }
      });
      return;
    }
    const c = e.target.closest(".acard");
    if (c) flipTo(open === c.dataset.id ? null : c.dataset.id);
  });

  Object.assign(app, { openAllRecipes: openAll });
})();
