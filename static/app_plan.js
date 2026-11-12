// BringFrisch – Plan-Ansicht: Kopf, Tage (auf/zu, Esser, Reste, Zeit), Menü-Blatt «Gericht wechseln», Dichte d1–d3,
// Bring!-Chip, Woche wechseln (Chip/Wischen), Plan per Link teilen, Scrollbalken.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { DATA, isoWeek, plusWeek, portionsFor, formatAmount, cleanIngredient, importer, DAYS, MONTHS,
    DEFAULT_SERVINGS, load, save, DINNER_KEY, ME_KEY, COUNTS_KEY, state, savePlan, $, recipeHref, esc, currentMonth,
    todayIndex, initialsMap, toast, copyText, allRecipes, inSeason, makeDay, generateWeek, refresh, canPlanNext,
    nextPlan } = app;

  // ---------------------------------------------------------------------------
  // Rendering: Plan
  // ---------------------------------------------------------------------------
  function renderHeader() {
    const now = new Date();
    const kwNow = isoWeek(now);
    const kwNext = isoWeek(plusWeek());
    $("weekLabel").textContent = app.viewNext ? `KW ${kwNext} · nächste Woche` : `KW ${kwNow} · ${MONTHS[now.getMonth()]}`;
    $("appbar").classList.toggle("nextwk", app.viewNext);
    $("secTitle").textContent = app.viewNext ? `Nächste Woche` : "Wochenplan";
    const chip = $("weekChip");
    chip.hidden = !canPlanNext();
    chip.textContent = app.viewNext ? `← KW ${kwNow}` : `KW ${kwNext} →`;
    chip.setAttribute("aria-label", app.viewNext ? `Zurück zu dieser Woche (KW ${kwNow})` : `Nächste Woche planen (KW ${kwNext})`);
  }

  function renderSeasonHint() {
    const m = currentMonth();
    const names = (DATA.season_items || [])
      .filter(it => (it.field_months || []).includes(m))
      .map(it => it.name.replace(/^Schweizer\s+/i, "").replace(/\s*\(.*\)$/, ""));
    $("seasonHint").textContent = names.length ? `Saison im ${MONTHS[m - 1]}: ${names.slice(0, 8).join(", ")}.` : "";
  }

  // Bring!-Chip oben: ruhig «24 Artikel» · nach Sync «24 für Bring!» (hervorgehoben) · danach «✓ in Bring!»
  function renderCta() {
    const diff = app.bringDiff();
    const n = diff.missing.length;
    const more = diff.changed.length;
    const wanted = state.shopping.filter(it => !it.isStaple).length;
    const allOn = n === 0 && more === 0 && wanted > 0;
    if (!allOn && chipState === "done") chipState = "quiet";
    if (n === 0 && chipState === "ready") chipState = "quiet";
    const chip = $("syncBtn");
    chip.classList.toggle("ready", chipState === "ready");
    $("ctaCount").innerHTML = allOn ? "<b>✓</b> in Bring!"
      : chipState === "ready" ? `<b>${n}</b> für Bring!`
      : n === 0 && more ? `<b>${more}</b> mehr`
      : `<b>${n}</b> Artikel${more ? ` · ${more} mehr` : ""}`;
    chip.setAttribute("aria-label", allOn ? "Alles ist in Bring! – antippen zum Prüfen" : `${n} Artikel für Bring!${more ? `, ${more} mit mehr Menge` : ""} – antippen zum Füllen`);
    chip.disabled = wanted === 0; // auch bei «alles drauf» antippbar -> fragt nach
  }

  // ---------------------------------------------------------------------------
  // Aktionen: Plan
  // ---------------------------------------------------------------------------
  function toggleEater(dayIdx, memberId) {
    const day = state.plan[dayIdx];
    if (!day) return;
    day.eaters = day.eaters.includes(memberId) ? day.eaters.filter(id => id !== memberId) : [...day.eaters, memberId];
    savePlan();
    refresh();
  }

  function planRandomWeek() {
    const previous = state.plan;
    state.plan = generateWeek();
    savePlan();
    refresh();
    toast("Neue Woche geplant", {
      label: "Rückgängig",
      run: () => { state.plan = previous; savePlan(); refresh(); }
    });
  }

  // Woche wechseln: nur Inhalt und Beschriftung ändern sich, das Raster bleibt stehen
  function setWeekView(next) {
    next = !!next && canPlanNext();
    if (next === app.viewNext) return;
    if (next) {
      app.curPlan = state.plan;
      app.viewNext = true;
      state.plan = nextPlan();
    } else {
      app.viewNext = false;
      state.plan = app.curPlan || state.plan;
      app.curPlan = null;
    }
    openIdx = -1;
    renderHeader();
    refresh();
    fitDensity();
    app.markWahl();
    const days = $("days");
    if (days.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      days.animate([{ transform: `translateX(${next ? 28 : -28}px)`, opacity: 0.25 }, { transform: "none", opacity: 1 }], { duration: 280, easing: "cubic-bezier(.3,0,.1,1)" });
    }
  }

  function encodePlan() {
    const json = JSON.stringify({ v: 2, members: state.members, weekPlan: state.plan });
    return btoa(unescape(encodeURIComponent(json)));
  }

  function importPlanFromHash() {
    if (!location.hash.startsWith("#plan=")) return false;
    try {
      const json = decodeURIComponent(escape(atob(decodeURIComponent(location.hash.slice(6)))));
      const payload = JSON.parse(json);
      if (Array.isArray(payload.members) && payload.members.length) state.members = payload.members;
      state.plan = payload.weekPlan || payload.plan || [];
      history.replaceState(null, "", location.pathname);
      return true;
    } catch (e) {
      console.warn("Plan-Link ungültig", e);
      return false;
    }
  }

  $("sharePlanBtn").onclick = async () => {
    const url = `${location.href.split("#")[0]}#plan=${encodeURIComponent(encodePlan())}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "BringFrisch Wochenplan", text: "Unser WG-Wochenplan:", url });
        return;
      } catch (e) { /* abgebrochen → kopieren */ }
    }
    toast((await copyText(url)) ? "Plan-Link kopiert" : "Kopieren nicht möglich");
  };

  // ---------------------------------------------------------------------------
  // Plan-Ansicht (Redesign): Tag = Menü auf/zu · Gericht = wechseln · Kreise = mitessen · Zahl = +1
  // ---------------------------------------------------------------------------
  const CHEV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>`;
  let openIdx = -1;

  function dayMeta(day) {
    if (day.empty) return "Antippen oder Wochenwahl";
    const kind = day.is_leftovers ? "Reste" : day.quick ? "schnell" : day.diet === "fleisch" ? "Fleisch" : day.diet === "vegan" ? "vegan" : "vegi";
    const g = day.extra_guests || 0; // Gäste zählen in der Zahl rechts mit – hier sieht man warum
    return `${kind} · ${day.prep_time_min || 30} Min.${g ? ` · +${g} ${g === 1 ? "Gast" : "Gäste"}` : ""}`;
  }

  // Zutaten für die Portionen dieses Tages (gleiche Rechnung wie die Einkaufsliste)
  function dayIngredients(day) {
    const portions = portionsFor(day);
    const scale = (portions || day.servings || DEFAULT_SERVINGS) / (day.servings || DEFAULT_SERVINGS);
    return (day.ingredients || []).map(ing => {
      const raw = parseFloat(ing.amount);
      const amt = Number.isFinite(raw) ? formatAmount(raw * scale, (ing.unit || "").trim()) : "";
      return { amt, name: cleanIngredient(ing.name).name || ing.name };
    });
  }

  const totalLabel = (day, idx) =>
    `${DAYS[idx]}: für ${portionsFor(day)} kochen (${day.eaters.length + (day.extra_guests || 0)} Personen + ${day.leftover_buffer || 0} Reste). Antippen: plus eins`;

  function rowHTML(day, idx, short, today) {
    const meId = load(ME_KEY, null);
    const many = state.members.length >= 5;
    const cols = Math.ceil(state.members.length / 2);
    const ings = dayIngredients(day);
    const b = day.leftover_buffer || 0;
    return `<div class="prow${idx === today ? " today" : ""}${idx === openIdx ? " open" : ""}${day.empty ? " unplanned" : ""}" data-i="${idx}">
      <div class="phead">
        <button type="button" class="pday" aria-expanded="${idx === openIdx}" aria-label="${DAYS[idx]}: ganzes Menü zeigen">${DAYS[idx].slice(0, 2)}</button>
        <div class="dish">
          <button type="button" class="t" data-pick="${idx}" aria-label="${DAYS[idx]}: ${esc(day.title)} – wechseln">${esc(day.title)}</button>
          <span class="meta">${esc(dayMeta(day))}${day.time ? ` · <span class="by">🕖 ${esc(day.time)}${day.time_by ? ` (${esc(day.time_by)})` : ""}</span>` : ""}</span>
        </div>
        <div class="who${many ? " many" : ""}"${many ? ` style="--cols:${cols}"` : ""}>${state.members.map((m, k) => {
          const on = day.eaters.includes(m.id);
          return `<button type="button" class="av${on ? "" : " off"}${m.id === meId ? " me" : ""}${many && k >= cols && state.members.length % 2 ? " r2" : ""}" data-day="${idx}" data-member="${esc(m.id)}" aria-pressed="${on}" aria-label="${esc(m.name)} isst am ${DAYS[idx]} ${on ? "mit" : "nicht mit"}">${esc(short[m.id])}</button>`;
        }).join("")}<span class="plus${b ? "" : " zero"}" aria-hidden="true">+${b}</span></div>
        <div class="tot">
          <button type="button" class="num" data-inc="${idx}" aria-label="${esc(totalLabel(day, idx))}">${portionsFor(day)}</button>
          <span class="dd">${CHEV}<select class="buf" data-buffer="${idx}" aria-label="Reste am ${DAYS[idx]}">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === b ? " selected" : ""}>+${n}</option>`).join("")}</select></span>
        </div>
      </div>
      <div class="more"><div><div class="inner">
        <ul class="ing">${ings.length ? ings.map(x => `<li>${x.amt ? `<b>${esc(x.amt)}</b> ` : ""}${esc(x.name)}</li>`).join("") : `<li class="none">${day.empty ? "Noch kein Menü – Gericht antippen oder Wochenwahl starten" : day.is_leftovers ? "Was im Kühlschrank ist – nichts einkaufen" : "Keine Zutaten hinterlegt"}</li>`}</ul>
        <div class="links">${recipeHref(day) ? `<a href="${esc(recipeHref(day))}" target="_blank" rel="noopener">${day.source_url ? "Zum Rezept ↗" : "Rezept suchen ↗"}</a>` : ""}<button type="button" class="sw" data-pick="${idx}">Wechseln</button>${day.empty ? "" : `<input class="tm" type="time" data-time="${idx}" value="${esc(day.time || load(DINNER_KEY, "18:30"))}" aria-label="Znacht-Zeit am ${DAYS[idx]} (gilt für alle)">`}</div>
      </div></div></div>
    </div>`;
  }

  function renderDays() {
    const short = initialsMap();
    const today = app.viewNext ? -1 : todayIndex();
    $("days").innerHTML = state.plan.map((day, idx) => rowHTML(day, idx, short, today)).join("");
  }

  // Auf-/Zuklappen ändert nur Klassen – die anderen Zeilen werden nicht neu gezeichnet
  function setOpen(i) {
    openIdx = i;
    [...$("days").children].forEach((row, k) => {
      row.classList.toggle("open", k === i);
      row.querySelector(".pday").setAttribute("aria-expanded", String(k === i));
    });
  }

  // Tippen ja, Scrollen nein: Aktion nur, wenn Finger und Liste sich kaum bewegt haben
  const scroller = $("scroller");
  app.tapStart = null;
  function trackTaps(el, getScroll) {
    el.addEventListener("pointerdown", e => { app.tapStart = { x: e.clientX, y: e.clientY, st: getScroll(), moved: false }; });
    el.addEventListener("pointermove", e => { if (app.tapStart && Math.hypot(e.clientX - app.tapStart.x, e.clientY - app.tapStart.y) > 8) app.tapStart.moved = true; });
  }
  const wasScroll = getScroll => !!app.tapStart && (app.tapStart.moved || Math.abs(getScroll() - app.tapStart.st) > 2);
  trackTaps($("days"), () => scroller.scrollTop);

  function bumpNum(idx) {
    const btn = $("days").children[idx] && $("days").children[idx].querySelector(".num");
    if (!btn) return;
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
  }

  function setBuffer(idx, n) {
    state.plan[idx].leftover_buffer = n;
    savePlan();
    refresh();
    bumpNum(idx);
  }

  $("days").addEventListener("click", e => {
    const row = e.target.closest(".prow");
    if (!row) return;
    if (wasScroll(() => scroller.scrollTop)) { e.preventDefault(); return; }
    if (e.target.closest("a")) return; // «Zum Rezept» normal öffnen
    const idx = +row.dataset.i;
    if (e.target.closest(".pday")) return setOpen(openIdx === idx ? -1 : idx);
    const chip = e.target.closest("[data-member]");
    if (chip) return toggleEater(idx, chip.dataset.member);
    if (e.target.closest("[data-inc]")) return setBuffer(idx, ((state.plan[idx].leftover_buffer || 0) + 1) % 7);
    if (e.target.closest("[data-pick]")) return openMenuSheet(idx, e.target.closest("button"));
  });

  // Reste per Auswahl (▾): +0 … +6
  $("days").addEventListener("change", e => {
    const sel = e.target.closest("[data-buffer]");
    if (sel) setBuffer(+sel.dataset.buffer, parseInt(sel.value, 10));
    const tm = e.target.closest("[data-time]");
    if (tm && /^\d{2}:\d{2}$/.test(tm.value)) setDayTime(+tm.dataset.time, tm.value);
  });

  // Zeit pro Tag: gilt für alle (Plan + Kalender-Abo), man sieht, wer sie geändert hat
  function setDayTime(idx, value) {
    const day = state.plan[idx];
    if (value === load(DINNER_KEY, "18:30")) { delete day.time; delete day.time_by; }
    else {
      const me = state.members.find(m => m.id === load(ME_KEY, null));
      day.time = value;
      day.time_by = me ? me.name : "";
    }
    savePlan();
    refresh();
    toast(`${DAYS[idx]}: Znacht um ${value} – gilt für alle`);
  }

  // ---------------------------------------------------------------------------
  // Dichte: einmal beim Start/Drehen so wählen, dass 7 Tage + ein offener Tag hineinpassen
  // ---------------------------------------------------------------------------
  function fitDensity() {
    if (!$("tab-plan") || $("tab-plan").hidden) return;
    const root = document.documentElement;
    const keep = openIdx;
    root.classList.add("measuring");
    root.classList.remove("d1", "d2", "d3");
    // den «längsten» Tag zum Messen öffnen
    let probe = 0;
    const size = d => (d.title || "").length + (d.ingredients || []).length * 8;
    state.plan.forEach((d, i) => { if (size(d) > size(state.plan[probe])) probe = i; });
    setOpen(probe);
    const nav = document.querySelector(".bnav");
    const ok = () => {
      const last = $("days").lastElementChild;
      if (!last || !nav) return true;
      return last.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top - 6;
    };
    // Dichte nach einem normal langen Menü wählen: eine sehr lange Zutatenliste darf nicht alles klein machen
    // (sie scrollt dann im offenen Tag, siehe --ing-max unten)
    root.style.setProperty("--ing-max", "120px");
    for (const d of ["d1", "d2", "d3"]) { if (ok()) break; root.classList.add(d); }
    // Reicht auch d3 nicht (sehr lange Zutatenliste, kleines Handy): Zutaten bekommen eine feste
    // Höchsthöhe und scrollen im offenen Tag – so bleiben trotzdem alle 7 Tage sichtbar.
    root.style.removeProperty("--ing-max");
    if (nav && $("days").lastElementChild) {
      let allowed = Infinity;
      state.plan.forEach((_, i) => {
        setOpen(i);
        const ing = $("days").children[i].querySelector(".ing");
        const over = $("days").lastElementChild.getBoundingClientRect().bottom - (nav.getBoundingClientRect().top - 6);
        if (over > 0 && ing) allowed = Math.min(allowed, ing.getBoundingClientRect().height - over);
      });
      if (Number.isFinite(allowed)) root.style.setProperty("--ing-max", Math.max(34, Math.floor(allowed)) + "px");
    }
    setOpen(keep);
    void root.offsetHeight;
    root.classList.remove("measuring");
  }
  let fitTimer = null;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitDensity, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDensity);

  // App-Leiste (Google): Ton wechselt beim Scrollen
  scroller.addEventListener("scroll", () => $("appbar").classList.toggle("scrolled", scroller.scrollTop > 4), { passive: true });

  // ---------------------------------------------------------------------------
  // Menü wechseln: Blatt von unten, «Beliebt bei euch» oben
  // ---------------------------------------------------------------------------
  function dishCounts() {
    let c = load(COUNTS_KEY, null);
    if (!c) {
      c = {};
      state.plan.forEach(d => { if (d.id != null) c[d.id] = (c[d.id] || 0) + 1; });
      save(COUNTS_KEY, c);
    }
    return c;
  }
  function countDish(id) {
    const c = dishCounts();
    c[id] = (c[id] || 0) + 1;
    save(COUNTS_KEY, c);
  }

  let sheetDay = -1;
  let sheetReturn = null;
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function sheetOptions() {
    const f = norm($("msearch").value.trim());
    const pasted = app.linkIn($("msearch").value);
    if (pasted) {
      $("mlist").innerHTML = `<button type="button" class="opt" role="option" data-link="${esc(pasted)}"><span><span class="n">🔗 Rezept von diesem Link holen</span><small>${esc(pasted.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</small></span></button>`;
      return;
    }
    const counts = dishCounts();
    const current = state.plan[sheetDay] ? String(state.plan[sheetDay].id) : null;
    const all = allRecipes().filter(r => String(r.id) !== current && (!f || norm(`${r.title} ${dayMeta(r)}`).includes(f)));
    const optHTML = r => `<button type="button" class="opt" role="option" data-id="${esc(r.id)}"><span><span class="n">${esc(r.title)}</span><small>${esc(dayMeta(r))}${inSeason(r) ? "" : " · nicht Saison"}</small></span>${counts[r.id] ? `<span class="pop">♥ ${counts[r.id]}×</span>` : ""}</button>`;
    let h = "";
    if (!f) {
      const popular = all.filter(r => counts[r.id]).sort((a, b) => counts[b.id] - counts[a.id]).slice(0, 4);
      const rest = all.filter(r => !popular.includes(r)).sort((a, b) => (inSeason(b) - inSeason(a)) || a.title.localeCompare(b.title, "de"));
      if (popular.length) h += `<div class="msec">Beliebt bei euch</div>` + popular.map(optHTML).join("");
      h += `<div class="msec">Weitere</div>` + rest.map(optHTML).join("");
    } else {
      h += all.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(optHTML).join("");
      h += `<button type="button" class="opt" role="option" data-new="1"><span><span class="n">«${esc($("msearch").value.trim())}» eintragen</span><small>eigenes Menü</small></span></button>`;
    }
    h += `<button type="button" class="opt more-link" data-catalog="1">Alle Rezepte, Filter &amp; eigenes Rezept …</button>`;
    $("mlist").innerHTML = h;
  }

  function fitKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    $("msheet").style.setProperty("--kb", kb + "px");
    $("msheet").style.setProperty("--vvh", vv.height + "px");
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitKeyboard);
    window.visualViewport.addEventListener("scroll", fitKeyboard);
  }

  function openMenuSheet(idx, from) {
    sheetDay = idx;
    sheetReturn = from || null;
    const day = state.plan[idx];
    $("msheetTitle").innerHTML = `${esc(DAYS[idx].slice(0, 2))}: Menü wechseln<small>jetzt: ${esc(day.title)}</small>`;
    $("msearch").value = "";
    sheetOptions();
    $("mlist").scrollTop = 0;
    $("msheet").classList.add("show");
    $("mscrim").classList.add("show");
    // Auf dem Handy die Tastatur nicht ungefragt öffnen (sie würde die Liste verdecken)
    if (!coarse) setTimeout(() => $("msearch").focus(), 60);
    else { const first = $("mlist").querySelector(".opt"); if (first) first.focus({ preventScroll: true }); }
  }
  function closeMenuSheet() {
    $("msearch").blur();
    $("msheet").classList.remove("show");
    $("mscrim").classList.remove("show");
    if (sheetReturn && sheetReturn.isConnected) sheetReturn.focus({ preventScroll: true });
  }
  function pickFromSheet(btn) {
    const idx = sheetDay;
    if (btn.dataset.catalog) {
      closeMenuSheet();
      state.catalogMode = "day";
      return app.openCatalog(idx);
    }
    if (btn.dataset.link) {
      closeMenuSheet();
      state.catalogMode = "day";
      state.catalogDay = idx;
      return app.openRecipeForm(btn.dataset.link);
    }
    let recipe;
    if (btn.dataset.new) {
      recipe = importer.createCustomRecipe({ title: $("msearch").value.trim(), diet: "vegi", servings: DEFAULT_SERVINGS });
      app.settingsChanged();
    } else {
      recipe = allRecipes().find(r => String(r.id) === btn.dataset.id);
    }
    if (!recipe) return;
    const previous = state.plan[idx];
    state.plan[idx] = makeDay(recipe, idx, previous);
    countDish(recipe.id);
    savePlan();
    refresh();
    closeMenuSheet();
    toast(`${DAYS[idx].slice(0, 2)}: ${recipe.title}`, {
      label: "Rückgängig",
      run: () => { state.plan[idx] = previous; savePlan(); refresh(); toast("Rückgängig gemacht"); }
    });
  }
  $("msearch").addEventListener("input", sheetOptions);
  trackTaps($("mlist"), () => $("mlist").scrollTop);
  $("mlist").addEventListener("click", e => {
    const b = e.target.closest(".opt");
    if (!b) return;
    if (wasScroll(() => $("mlist").scrollTop)) return;
    pickFromSheet(b);
  });
  $("mscrim").onclick = closeMenuSheet;
  $("msheetClose").onclick = closeMenuSheet;
  $("msheet").addEventListener("keydown", e => {
    const opts = [...$("mlist").querySelectorAll(".opt")];
    const at = opts.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); closeMenuSheet(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (opts[at + 1] || opts[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (at <= 0) $("msearch").focus(); else opts[at - 1].focus(); }
    else if (e.key === "Enter" && document.activeElement === $("msearch")) {
      e.preventDefault();
      if ($("msearch").value.trim() && opts[0]) pickFromSheet(opts[0]); else $("msearch").blur();
    }
  });
  $("msearch").addEventListener("focus", () => setTimeout(() => { fitKeyboard(); if ($("msearch").scrollIntoView) $("msearch").scrollIntoView({ block: "nearest" }); }, 250));
  $("msearch").addEventListener("blur", () => setTimeout(fitKeyboard, 250));


  // Bring!-Chip: ruhig «24 Artikel» · nach Sync hervorgehoben «24 für Bring!» · nach dem Füllen «✓ in Bring!»
  let chipState = "quiet";
  function setChip(stateName) {
    chipState = stateName;
    renderCta();
    if (stateName === "ready") {
      const c = $("syncBtn");
      c.classList.remove("bump");
      void c.offsetWidth;
      c.classList.add("bump");
    }
  }

  // Woche wechseln: Chip in der Abschnittszeile oder seitlich über die Tage wischen
  $("weekChip").onclick = () => setWeekView(!app.viewNext);
  (function weekSwipe() {
    let sx = null, sy = 0;
    $("days").addEventListener("touchstart", e => {
      sx = canPlanNext() && e.touches.length === 1 ? e.touches[0].clientX : null;
      sy = sx === null ? 0 : e.touches[0].clientY;
    }, { passive: true });
    $("days").addEventListener("touchend", e => {
      if (sx === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 40) setWeekView(dx < 0);
    }, { passive: true });
  })();

  // Unsichtbarer Scrollbalken: Greifstreifen rechts, feiner Balken nur beim Scrollen/Ziehen
  (function scrollGrip() {
    const bar = $("sbar");
    const thumb = $("sthumb");
    let hideT = null;
    let dragging = false;
    let off = 0;
    function update(show) {
      const max = scroller.scrollHeight - scroller.clientHeight;
      bar.hidden = max < 4;
      if (max < 4) return;
      const h = bar.clientHeight;
      const tH = Math.max(36, h * scroller.clientHeight / scroller.scrollHeight);
      thumb.style.height = tH + "px";
      thumb.style.top = ((h - tH) * scroller.scrollTop / max) + "px";
      if (show) { bar.classList.add("on"); clearTimeout(hideT); hideT = setTimeout(() => bar.classList.remove("on"), 900); }
    }
    scroller.addEventListener("scroll", () => update(true), { passive: true });
    window.addEventListener("resize", () => update(false));
    if (window.ResizeObserver) new ResizeObserver(() => update(false)).observe(scroller);
    function move(e) {
      if (!dragging) return;
      const r = bar.getBoundingClientRect();
      const tH = thumb.offsetHeight;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const y = Math.min(Math.max(e.clientY - r.top - off, 0), r.height - tH);
      scroller.scrollTop = max * y / Math.max(1, r.height - tH);
    }
    bar.addEventListener("pointerdown", e => {
      dragging = true;
      if (bar.setPointerCapture) bar.setPointerCapture(e.pointerId);
      bar.classList.add("drag", "on");
      const tr = thumb.getBoundingClientRect();
      off = e.clientY >= tr.top && e.clientY <= tr.bottom ? e.clientY - tr.top : thumb.offsetHeight / 2;
      move(e);
    });
    bar.addEventListener("pointermove", move);
    const end = () => { dragging = false; bar.classList.remove("drag"); update(true); };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
    update(false);
  })();

  Object.assign(app, { renderHeader, renderSeasonHint, renderCta, toggleEater, planRandomWeek, setWeekView,
    importPlanFromHash, renderDays, scroller, fitDensity, countDish, setChip });
})();
