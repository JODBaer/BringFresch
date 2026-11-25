// Obsonare – Start: Dialoge schliessen, Navigation (Tabs), Plan laden (Link, Wochenwechsel), erstes Zeichnen, Service Worker.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  app.started = true;
  const { weekKey, APP_VERSION, REPO_URL, STORE, load, save, remove, PLAN_WEEK_KEY, NEXT_KEY, VOTE_KEY, WELCOME_KEY,
    KEYS, state, savePlan, saveMembers, $, toast, normalizePlan, refresh, isOpenWeek } = app;

  // ---------------------------------------------------------------------------
  // Tastatur (Joshua 18.11.: Knöpfe waren von Leiste/Tastatur verdeckt): bei offener Tastatur Leiste unten und Bring!-Knopf weg
  // (html.kbd); Blätter rücken über die Tastatur (--kb = Höhe der Tastatur aus visualViewport); aktives Feld in die Mitte.
  // ---------------------------------------------------------------------------
  // Nur wenn wirklich eine Tastatur offen ist (sichtbarer Bereich > 120 px kleiner) – am PC bleibt die Leiste
  const isField = el => el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|range|color|file)$/.test(el.type)));
  document.addEventListener("focusin", e => {
    // nur wenn die Tastatur wirklich offen ist (am PC nicht scrollen)
    if (isField(e.target)) setTimeout(() => { if (document.documentElement.classList.contains("kbd") && document.activeElement === e.target && e.target.scrollIntoView) e.target.scrollIntoView({ block: "center", behavior: "smooth" }); }, 350);
  });
  const vv = window.visualViewport;
  if (vv) {
    const kb = () => {
      const h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty("--kb", `${h}px`);
      document.documentElement.classList.toggle("kbd", h > 120);
    };
    vv.addEventListener("resize", kb);
    vv.addEventListener("scroll", kb);
    kb();
  }

  // ---------------------------------------------------------------------------
  // Dialoge & Navigation
  // ---------------------------------------------------------------------------
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  });

  function showTab(name) {
    ["plan", "shop", "season", "wg"].forEach(t => { $(`tab-${t}`).hidden = t !== name; });
    document.documentElement.dataset.tab = name; // Einkauf: Bring! nur über den Knopf unten rechts (kein Chip oben)
    document.querySelectorAll("nav button").forEach(b => {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document.querySelector("main").scrollTop = 0;
    if (name === "plan") app.fitDensity();
    if (name === "season" && app.renderRecipes) app.renderRecipes(); // Rezepte: Karten erst beim Öffnen zeichnen
  }

  // Navigation: Symbole animieren, Tab zeigen (auch «Einstellungen» direkt als Seite)
  document.querySelector(".bnav").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    b.classList.remove("anim");
    void b.offsetWidth;
    b.classList.add("anim");
    clearTimeout(b._anim);
    b._anim = setTimeout(() => b.classList.remove("anim"), 2300);
    showTab(b.dataset.tab);
  });
  $("setVoteBtn").onclick = () => app.openVoteFor();
  $("repoLink").href = REPO_URL;
  $("appVersionTop").textContent = APP_VERSION;


  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  const fromLink = app.importPlanFromHash();
  if (!fromLink) state.plan = load(KEYS.plan, []);
  // Neue Woche: die schon geplante nächste Woche wird zur laufenden, sonst bleibt der Plan stehen
  const planWeek = load(PLAN_WEEK_KEY, null);
  const rolled = !fromLink && planWeek && planWeek < weekKey() && state.nextDoc && state.nextDoc.week === weekKey() && !isOpenWeek(state.nextDoc.plan);
  if (rolled) state.plan = state.nextDoc.plan;
  if (state.nextDoc && state.nextDoc.week <= weekKey()) {
    state.nextDoc = null;
    remove(NEXT_KEY);
  }
  save(PLAN_WEEK_KEY, weekKey());
  // Altlasten und alte Wochenwahlen: STORE.migrate (store.js)
  STORE.migrate(weekKey());
  normalizePlan();
  if (fromLink || rolled) {
    savePlan(); // per Link empfangener Plan gilt als neueste Version
    saveMembers();
  } else {
    save(KEYS.plan, state.plan); // nur lokal sichern, Zeitstempel bleibt (sonst wäre der WG-Plan nie "neuer")
    save(KEYS.members, state.members);
  }

  app.renderHeader();
  app.renderSeasonHint();
  app.setupSeason();
  app.renderMembers();
  app.renderSyncSettings();
  refresh();
  app.fitDensity();
  app.markWahl();
  const welcome = !app.connected() && !fromLink && !load(WELCOME_KEY, false);
  if (welcome) app.openWelcome();
  else if (app.openFromUrl()) { /* aus einer Benachrichtigung geöffnet (app_push.js) */ }
  else if (app.wahlDue()) setTimeout(app.openWahlPop, 500);
  if (fromLink) toast("Wochenplan aus Link übernommen");
  else app.pullShared();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service Worker:", err));
  }
})();
