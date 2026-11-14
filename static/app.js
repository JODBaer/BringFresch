// Obsonare – WG-Menüplaner mit Schweizer Saisongemüse und Bring!-Übergabe.
// Läuft komplett im Browser; alle Daten liegen in localStorage (store.js), die reinen Regeln in core.js.
//
// Die App besteht aus klassischen Skripten (kein Bündler, kein Bau-Schritt), Reihenfolge wie in index.html:
//   app.js               Grundlage: Konstanten, Zustand (state, Woche), Speichern, Hilfsfunktionen, refresh()
//   app_plan.js          Plan-Ansicht (Tage, Menü-Blatt, Dichte, Bring!-Chip, Woche wechseln, Plan teilen)
//   app_einkauf.js       Einkauf (Liste, Bring! füllen per Teilen/Kopieren)
//   app_vorrat.js        Grundvorrat (Variante C: Mengen, Vorrat-Liste, Gegenüberstellung, Kacheln, Blatt, Inventur)
//   app_rezepte.js       Rezepte & Saison (Saisonliste, Katalog, eigenes Rezept, Webseiten, Link-Import)
//   app_wahl.js          Wochenwahl (Memory, Stimmen, Bilder, Pop-up)
//   app_sync.js          Abgleich mit dem WG-Server (Plan, nächste Woche, Vorrat, Einstellungen, Bring!)
//   app_einstellungen.js Einstellungen + Willkommen (Mitbewohner, Verbindung, Bring!-Liste, Kalender, Aktualisieren)
//   app_theme.js         Formen, Stil iPhone/Android, Farben, Hell/Dunkel
//   app_start.js         Navigation und Start
// Gemeinsamer Namensraum: window.BF_APP (hier «app»). Was app.js anbietet, holt jede Datei oben mit
// «const { … } = app;». Was aus einer anderen app_*.js kommt, heisst app.name (steht erst bereit, wenn alle Dateien
// geladen sind – beim Laden selbst nur Eigenes und app.js benutzen). Veränderliche Werte, die mehrere Dateien sehen
// (state.viewNext, state.curPlan, state.nextDoc, state.vote, state.sync …), stehen nur unter app.
(() => {
  "use strict";

  // Alte Seite aus dem Cache zusammen mit neuem app.js (core.js / store.js fehlen dann): einmal frisch laden statt abstürzen
  if (!window.BF_CORE || !window.BF_STORE) {
    try {
      if (!sessionStorage.getItem("bf-reload")) { sessionStorage.setItem("bf-reload", "1"); location.reload(); }
    } catch (e) { /* ohne Speicher: Seite von Hand neu laden */ }
    return;
  }
  const app = window.BF_APP = {};
  // Ebenso, wenn eine alte index.html nur app.js lädt und die app_*.js fehlen (app_start.js setzt app.started)
  window.addEventListener("load", () => {
    if (app.started) return;
    try {
      if (!sessionStorage.getItem("bf-reload")) { sessionStorage.setItem("bf-reload", "1"); location.reload(); }
    } catch (e) { /* ohne Speicher: Seite von Hand neu laden */ }
  });

  const DATA = window.OBSONARE_DATA || {};
  // Reine Regeln (auch vom WG-Server benutzt): core.js
  const CORE = window.BF_CORE;
  const { isoWeek, weekKey, plusWeek, portionsFor, formatAmount, cleanIngredient, hasWord, bringItemId, bringPayload } = CORE;
  const importer = window.recipeImporter;

  const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const MONTHS = DATA.months || ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const DEFAULT_SERVINGS = 4;
  const DEFAULT_BUFFER = 2;

  const DEFAULT_MEMBERS = [
    { id: "joshua", name: "Joshua", diet: "fleisch" },
    { id: "lukas", name: "Lukas", diet: "fleisch" },
    { id: "leonie", name: "Leonie", diet: "fleisch" },
    { id: "jo", name: "Jo", diet: "vegi" }
  ];

  // Adresse des Cloudflare Workers (nach dem ersten Deploy hier eintragen; in der App änderbar)
  const APP_VERSION = "1.5.2";
  // Spenden-Link (z.B. Wise «Pay me»-Link https://wise.com/pay/me/…); leer = Knopf ausgeblendet
  const DONATE_URL = "";
  const REPO_URL = "https://github.com/jodbaer/BringFresch";
  const TEST_URL = "https://bringfrisch-test.bringfrisch-worker.workers.dev"; // Test-Version (tools/build_stage.mjs)
  const LIVE_URL = "https://jodbaer.github.io/BringFresch/";
  const DEFAULT_SYNC_URL = "https://bringfrisch.bringfrisch-worker.workers.dev";

  // Speicher auf dem Handy: alle Schlüssel, Lesen und Schreiben stehen in store.js
  const STORE = window.BF_STORE;
  const { load, save, remove, baseKey } = STORE;
  const {
    SYNC_KEY, PLAN_UPDATED_KEY, VORRAT_UPDATED_KEY, SETTINGS_UPDATED_KEY, PLAN_WEEK_KEY, DINNER_KEY, NEXT_KEY, SITES_KEY,
    VOTE_KEY, ME_KEY, WELCOME_KEY, TERMS_KEY, COUNTS_KEY, OS_KEY, THEME_KEY, MODE_KEY, SEARCH_SITE_KEY
  } = STORE.KEYS;
  const KEYS = { plan: STORE.KEYS.PLAN_KEY, members: STORE.KEYS.MEMBERS_KEY, staples: STORE.KEYS.STAPLES_KEY };

  // Migrationen (Altlasten, alte Wochenwahl): STORE.migrate(woche) in store.js, aufgerufen von app_start.js

  function loadMembers() {
    const saved = load(KEYS.members, null);
    const isOldPlaceholder = Array.isArray(saved) && saved.some(m => m.name === "Anna" || m.name === "Jonas");
    if (!Array.isArray(saved) || saved.length === 0 || isOldPlaceholder) return DEFAULT_MEMBERS.map(m => ({ ...m }));
    return saved;
  }

  const state = {
    members: loadMembers(),
    staples: load(KEYS.staples, null) || (DATA.pantry_staples || []).map(s => ({ ...s })),
    plan: [],
    shopping: [],
    bringItems: [],
    bringMine: [], // vom Bot gesetzt -> darf er wieder wegnehmen
    bringSpecs: {}, // name (klein) -> Mengenangabe auf Bring!
    sentSpecs: {}, // name (klein) -> was der Bot zuletzt gesendet hat
    shopFilter: "toBuy",
    catalogDay: 0,
    catalogFilter: "all",
    catalogMode: "day",
    // Geteilt zwischen den Dateien (früher lose unter app.*): eine Stelle für den ganzen Zustand
    viewNext: false, // zeigt gerade die nächste Woche
    curPlan: null, // Plan der laufenden Woche, solange die nächste angezeigt wird
    nextDoc: load(NEXT_KEY, null), // Plan der nächsten Woche { week, plan, updated }
    vote: null, // Wochenwahl der angezeigten Woche
    sync: null, // Verbindung zum WG-Server { url, pin, wg } (app_sync.js)
    mySites: [], // eigene Rezept-Webseiten (app_rezepte.js)
    planPushTimer: null, nextPushTimer: null, vorratTimer: null // wartende Uploads
  };

  // Abonnenten: subscribe(fn) meldet an (liefert die Abmeldung), notify() ruft alle; refresh() meldet nach dem Zeichnen
  const subscribers = [];
  function subscribe(fn) {
    subscribers.push(fn);
    return () => { const i = subscribers.indexOf(fn); if (i >= 0) subscribers.splice(i, 1); };
  }
  function notify() {
    subscribers.slice().forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  }

  // Nächste Woche (ab Donnerstag): eigener Plan pro KW. state.plan ist immer die angezeigte Woche.
  const currentPlan = () => (state.viewNext ? state.curPlan : state.plan);
  const otherPlan = () => (state.viewNext ? state.curPlan : state.nextDoc && state.nextDoc.plan);

  const savePlan = () => {
    if (state.viewNext) {
      state.nextDoc = { week: nextWeekKey(), plan: state.plan, updated: Date.now() };
      save(NEXT_KEY, state.nextDoc);
      app.scheduleNextPush();
      return;
    }
    save(KEYS.plan, state.plan);
    save(PLAN_UPDATED_KEY, Date.now());
    app.schedulePlanPush();
  };
  const saveMembers = () => {
    save(KEYS.members, state.members);
    save(PLAN_UPDATED_KEY, Date.now());
    app.schedulePlanPush();
  };
  // Grundvorrat gehört der ganzen WG: lokal speichern und (verbunden) an den Server schicken
  const saveStaples = () => {
    save(KEYS.staples, state.staples);
    save(VORRAT_UPDATED_KEY, Date.now());
    let online = false;
    try { online = app.connected(); } catch (e) { /* beim Start noch nicht bereit */ }
    if (!online) return;
    clearTimeout(state.vorratTimer);
    state.vorratTimer = setTimeout(() => app.pushVorratNow().catch(e => app.setSyncStatus(e.message, false)), 800);
  };

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------
  const $ = id => document.getElementById(id);

  // Link zum Rezept: Original-Seite, sonst die Suche mit dem Menü auf der Seite, die dieses Handy gewählt hat
  // («Rezept suchen auf»: Swissmilk / Fooby / Google, wie die Suchmaschine im Browser; lieber suchen als falsch verlinken).
  // Schnelles/Reste (Fertigpizza, Resteessen …) brauchen keinen. Links prüfen: tests/links_live.mjs
  // «Rezept auf Swissmilk ↗» bzw. «Auf Swissmilk suchen ↗»
  const searchKey = () => CORE.searchSite(load(SEARCH_SITE_KEY, "swissmilk"));
  const searchName = () => CORE.SEARCH_SITES[searchKey()].name;
  function recipeLinkLabel(r) {
    if (!r.source_url) return `Auf ${searchName()} suchen ↗`;
    let h = "";
    try { h = new URL(r.source_url).hostname.replace(/^www\./, ""); } catch (e) { /* kein Link */ }
    const site = { "fooby.ch": "Fooby", "bettybossi.ch": "Betty Bossi", "migusto.migros.ch": "Migusto", "swissmilk.ch": "Swissmilk" }[h] || h;
    return `Rezept auf ${site} ↗`;
  }
  function recipeHref(r) {
    if (r.source_url) return r.source_url;
    if (!r.title || r.empty || r.quick || r.is_leftovers) return "";
    return CORE.searchHref(searchKey(), r.title);
  }

  // Fleisch/Fisch in Titel oder Zutaten? (Zeilen mit Vegi-Ersatz wie «Vegi-Hack», «planted» zählen nicht)
  const MEAT_RE = /hackfleisch|ghackets|hackbraten|fleisch|poulet|hähnchen|huhn|chicken|rind(?!e)|schwein|kalb|lamm|speck|schinken|wurst|würst|cervelat|salami|lachs|fisch|forelle|thon|thun|kabeljau|crevette|garnele|saibling|steak|pancetta|chorizo|prosciutto|geschnetzelt|voressen|haxe|seeteufel|meeresfr|felchen|egli|zander|dorsch|scampi/i;
  const guessMeat = text => String(text).split("\n").filter(l => !/vegi|vegan|veget|planted|tofu|quorn|seitan/i.test(l)).some(l => MEAT_RE.test(l));

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function currentMonth() {
    return new Date().getMonth() + 1;
  }

  function todayIndex() {
    return (new Date().getDay() + 6) % 7;
  }

  // Kürzel: erster Buchstabe, bei Kollision länger (Joshua=J, Lukas=L, Leonie=Le, Jo=Jo)
  function initialsMap() {
    const taken = new Set();
    const map = {};
    state.members.forEach(m => {
      const name = (m.name || "?").trim();
      let k = 1;
      let short = name.slice(0, k);
      while (taken.has(short.toLowerCase()) && k < name.length) {
        k++;
        short = name.slice(0, k);
      }
      taken.add(short.toLowerCase());
      map[m.id] = short;
    });
    return map;
  }

  let toastTimer = null;
  // Fenster geht zu: Hinweis darin wieder auf die Seite, damit er sichtbar bleibt
  document.addEventListener("close", e => { if (e.target && e.target.querySelectorAll) e.target.querySelectorAll(".toast").forEach(t => document.body.appendChild(t)); }, true);
  function toast(message, action) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    clearTimeout(toastTimer);
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.onclick = () => { action.run(); el.remove(); };
      el.appendChild(btn);
    }
    // Offenes Fenster (Grundvorrat, Blatt …) liegt über der Seite: Hinweis dort hinein, sonst ist «Rückgängig» verdeckt
    const open = [...document.querySelectorAll("dialog[open]")].pop();
    (open || document.body).appendChild(el);
    toastTimer = setTimeout(() => el.remove(), action ? 6000 : 3200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Rezepte & Wochenplan
  // ---------------------------------------------------------------------------
  function allRecipes() {
    // gleicher Bestand für alle WGs: Katalog + eigene + geteilte der anderen WGs (Stimmen bleiben pro WG)
    return [...(DATA.recipes || []), ...(window.OBSONARE_IMPORTED || []), ...((importer && importer.customRecipes) || []), ...sharedRecipes()];
  }
  // Beliebtheit: Stimmen der Wochenwahl dieser WG (vom WG-Server); ohne Server: wie oft auf diesem Handy gewählt
  function popularCounts() {
    const wg = CORE.popularity((load(STORE.KEYS.POPULAR_KEY, null) || {}).weeks);
    return Object.keys(wg).length ? wg : (load(COUNTS_KEY, null) || {});
  }
  function sharedRecipes() {
    const list = load(STORE.KEYS.SHARED_RECIPES_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  // Gemeinsamer Nenner der Anwesenden: vegan > vegi > fleisch
  const effectiveDiet = eaterIds => CORE.effectiveDiet(eaterIds, state.members);

  const { fitsDiet } = CORE;

  const inSeason = (recipe, month = currentMonth()) => CORE.inSeason(recipe, month);

  // Zufallsrezept passend zur Diät, saisonal bevorzugt, möglichst ohne Wiederholung
  const pickRecipe = (diet, excludeIds = []) => CORE.pickRecipe(allRecipes(), diet, excludeIds, currentMonth());

  function makeDay(recipe, dayIdx, previous) {
    const prev = previous || {};
    return {
      ...recipe,
      day: DAYS[dayIdx],
      eaters: prev.eaters ? [...prev.eaters] : state.members.map(m => m.id),
      leftover_buffer: prev.leftover_buffer !== undefined ? prev.leftover_buffer : DEFAULT_BUFFER,
      extra_guests: prev.extra_guests || 0
    };
  }

  function generateWeek() {
    const allIds = state.members.map(m => m.id);
    const diet = effectiveDiet(allIds);
    const used = [];
    return DAYS.map((_, idx) => {
      const recipe = pickRecipe(diet, used);
      used.push(recipe.id);
      return makeDay(recipe, idx, null);
    });
  }

  // Esser-IDs bereinigen (z.B. nach Mitbewohner-Wechsel) und Standardwerte setzen
  function normalizePlan() {
    state.plan = normalizeWeek(state.plan);
  }
  function normalizeWeek(plan) {
    const ids = new Set(state.members.map(m => m.id));
    if (!Array.isArray(plan) || plan.length !== 7 || plan.some(d => !d || !d.title)) {
      plan = generateWeek();
    }
    plan.forEach((day, idx) => {
      day.day = DAYS[idx];
      const before = Array.isArray(day.eaters) ? day.eaters : null;
      const valid = before ? before.filter(id => ids.has(id)) : null;
      day.eaters = !before || (valid.length === 0 && before.length > 0) ? [...ids] : valid;
      if (day.leftover_buffer === undefined) day.leftover_buffer = DEFAULT_BUFFER;
      if (!day.extra_guests) day.extra_guests = 0;
      // Rezeptdaten aus der aktuellen Datenbank nachziehen (Korrekturen an Zutaten wirken auch auf gespeicherte Pläne)
      const fresh = day.id != null && allRecipes().find(r => String(r.id) === String(day.id));
      if (fresh) {
        const { eaters, leftover_buffer, extra_guests, time, time_by } = day;
        plan[idx] = { ...fresh, day: DAYS[idx], eaters, leftover_buffer, extra_guests, ...(time ? { time, time_by } : {}) };
      }
    });
    return plan;
  }

  // ---------------------------------------------------------------------------
  // Einkaufsliste: die Regeln (Mengen, Namen, Bring!-Katalog, Grundvorrat) stehen in core.js
  // ---------------------------------------------------------------------------
  function computeShopping() {
    state.shopping = CORE.shoppingList(state);
  }

  const toBuyItems = () => state.shopping.filter(it => !it.isStaple && !it.isOnBring);
  const listLine = it => `${it.name} (${it.spec})`;

  // Ernährung (Beschriftung für Mitbewohner, Katalog, Wochenwahl)
  const DIET_LABEL = { fleisch: "Fleisch", vegi: "Vegi", vegan: "Vegan" };

  // Alles neu berechnen und zeichnen
  function refresh() {
    computeShopping();
    app.renderDays();
    app.renderCta();
    app.renderShop();
    app.renderAttendance();
    notify();
  }

  const recipeById = id => allRecipes().find(r => String(r.id) === String(id));
  const { dietGroup } = CORE;

  const nextWeekKey = () => weekKey(plusWeek());
  const canPlanNext = () => todayIndex() >= 3; // ab Donnerstag
  const shownWeek = () => (state.viewNext ? nextWeekKey() : weekKey());

  // Noch nicht geplanter Tag der nächsten Woche: kauft nichts, Gericht antippen = wählen
  function emptyDay(idx) {
    return { id: null, title: "noch offen", empty: true, day: DAYS[idx], ingredients: [], eaters: state.members.map(m => m.id), leftover_buffer: DEFAULT_BUFFER, extra_guests: 0 };
  }
  const isOpenWeek = plan => !Array.isArray(plan) || plan.every(d => d && d.empty);
  function nextPlan() {
    if (state.nextDoc && state.nextDoc.week === nextWeekKey() && Array.isArray(state.nextDoc.plan) && state.nextDoc.plan.length === 7) return normalizeWeek(state.nextDoc.plan);
    return DAYS.map((_, i) => emptyDay(i));
  }
  function setCurrentPlan(plan) {
    if (state.viewNext) state.curPlan = plan;
    else state.plan = plan;
    save(KEYS.plan, plan);
  }

  Object.assign(app, { DATA, CORE, isoWeek, weekKey, plusWeek, portionsFor, formatAmount, cleanIngredient, hasWord,
    bringItemId, bringPayload, importer, DAYS, MONTHS, DEFAULT_SERVINGS, DEFAULT_MEMBERS, APP_VERSION, DONATE_URL,
    REPO_URL, TEST_URL, LIVE_URL, DEFAULT_SYNC_URL, STORE, load, save, remove, baseKey, SYNC_KEY, PLAN_UPDATED_KEY,
    VORRAT_UPDATED_KEY, SETTINGS_UPDATED_KEY, PLAN_WEEK_KEY, DINNER_KEY, NEXT_KEY, SITES_KEY, VOTE_KEY, ME_KEY,
    WELCOME_KEY, TERMS_KEY, COUNTS_KEY, OS_KEY, THEME_KEY, MODE_KEY, SEARCH_SITE_KEY, KEYS, state, currentPlan, otherPlan, savePlan,
    saveMembers, saveStaples, $, searchKey, searchName, recipeLinkLabel, recipeHref, guessMeat, esc, currentMonth, todayIndex, initialsMap,
    toast, copyText, allRecipes, popularCounts, effectiveDiet, fitsDiet, inSeason, pickRecipe, makeDay, generateWeek, normalizePlan,
    normalizeWeek, subscribe, notify, toBuyItems, listLine, DIET_LABEL, refresh, recipeById, dietGroup, nextWeekKey, canPlanNext,
    shownWeek, isOpenWeek, nextPlan, setCurrentPlan });
})();
