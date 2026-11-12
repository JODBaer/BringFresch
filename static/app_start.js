// BringFrisch – Start: Dialoge schliessen, Navigation (Tabs), Plan laden (Link, Wochenwechsel), erstes Zeichnen, Service Worker.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  app.started = true;
  const { weekKey, APP_VERSION, REPO_URL, STORE, load, save, remove, PLAN_WEEK_KEY, NEXT_KEY, VOTE_KEY, WELCOME_KEY,
    KEYS, state, savePlan, saveMembers, $, toast, normalizePlan, refresh, isOpenWeek } = app;

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
    document.querySelectorAll("nav button").forEach(b => {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document.querySelector("main").scrollTop = 0;
    if (name === "plan") app.fitDensity();
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
  const rolled = !fromLink && planWeek && planWeek < weekKey() && app.nextDoc && app.nextDoc.week === weekKey() && !isOpenWeek(app.nextDoc.plan);
  if (rolled) state.plan = app.nextDoc.plan;
  if (app.nextDoc && app.nextDoc.week <= weekKey()) {
    app.nextDoc = null;
    remove(NEXT_KEY);
  }
  save(PLAN_WEEK_KEY, weekKey());
  // Alte Wochenwahlen aufräumen (je Woche gespeichert)
  try {
    STORE.allKeys().forEach(k => {
      const m = /^bringfrisch_(?:week_vote_|wahl_)(\d{4}-W\d{2})$/.exec(k);
      if (m && m[1] < weekKey()) remove(k);
    });
    const oldVote = load(VOTE_KEY, null);
    if (oldVote && oldVote.week === weekKey() && !load(app.voteKey(oldVote.week), null)) save(app.voteKey(oldVote.week), oldVote);
    remove(VOTE_KEY);
  } catch (e) { /* ohne Speicher */ }
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
  else if (app.wahlDue()) setTimeout(app.openWahlPop, 500);
  if (fromLink) toast("Wochenplan aus Link übernommen");
  else app.pullShared();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service Worker:", err));
  }
})();
