// Obsonare – Speicher auf dem Handy (localStorage) an einer Stelle: alle Schlüssel, Lesen, Schreiben, Löschen.
// Läuft als <script> vor app.js und legt BF_STORE ab. Neue Schlüssel hier eintragen, nicht verstreut in app.js.
(function (root) {
  "use strict";

  // Gemeinsam für die WG (wird mit dem WG-Server abgeglichen)
  const SHARED = {
    PLAN_KEY: "bringfrisch_current_plan",          // Wochenplan der laufenden Woche
    NEXT_KEY: "bringfrisch_next_plan",             // { week, plan, updated } – nächste Woche (ab Donnerstag)
    MEMBERS_KEY: "bringfrisch_members",            // Mitbewohner
    STAPLES_KEY: "bringfrisch_user_staples",       // Grundvorrat
    DINNER_KEY: "bringfrisch_dinner_time",         // Znacht-Zeit
    SITES_KEY: "bringfrisch_recipe_sites",         // Rezept-Webseiten zum Stöbern
    CUSTOM_RECIPES_KEY: "bringfrisch_custom_recipes" // eigene Rezepte (recipe_importer.js)
  };
  // Abgleich: eigener Stempel pro Dokument (≠ gemerkter Server-Stand = hier geändert), siehe «Abgleich» in app.js
  const SYNC = {
    PLAN_UPDATED_KEY: "bringfrisch_plan_updated",
    VORRAT_UPDATED_KEY: "bringfrisch_vorrat_updated",
    SETTINGS_UPDATED_KEY: "bringfrisch_settings_updated",
    PLAN_WEEK_KEY: "bringfrisch_plan_week"         // KW, zu der der gespeicherte Plan gehört
  };
  // Nur dieses Handy
  const PHONE = {
    SYNC_KEY: "bringfrisch_sync",                  // { url, pin, wg } – Verbindung zum WG-Server
    ME_KEY: "bringfrisch_me",                      // «Ich bin»
    WELCOME_KEY: "bringfrisch_welcome",            // Willkommen gesehen
    TERMS_KEY: "bringfrisch_terms",                // wann Nutzungsbedingungen/Datenschutz akzeptiert
    COUNTS_KEY: "bringfrisch_dish_counts",         // wie oft welches Gericht gewählt wurde
    VOTE_KEY: "bringfrisch_week_vote",             // alte Wochenwahl (vor «pro Woche»), wird beim Start umgezogen
    OS_KEY: "bf-os",                               // Stil iPhone / Android (auch in index.html gelesen)
    THEME_KEY: "bf-theme",                         // Farben
    MODE_KEY: "bf-mode",                           // Hell / Dunkel (auch in index.html gelesen)
    SHARED_RECIPES_KEY: "bringfrisch_shared_recipes", // Rezepte der anderen WGs (Zwischenspeicher von /recipes/shared, offline da)
    POPULAR_KEY: "bringfrisch_popular",            // Beliebtheit dieser WG (Zwischenspeicher von /popular: Stimmen pro Woche)
    SHOP_SORT_KEY: "bringfrisch_shop_sort",        // Einkauf/Vorrat: "rezept" (nach Gericht) oder "kat" (nach Kategorie wie in Bring!)
    SEARCH_SITE_KEY: "bringfrisch_search_site"     // «Rezept suchen auf»: swissmilk | fooby | google
  };
  // Schlüssel mit Zusatz
  const baseKey = name => `bringfrisch_base_${name}`;   // gemerkter Server-Stand: plan | next | vorrat | settings
  const wahlKey = week => `bringfrisch_wahl_${week}`;   // Wochenwahl dieser Woche erledigt

  // Altlasten früherer Versionen (Logins, Layouts, Tiefkühler …): werden beim Start entfernt
  const LEGACY_KEYS = [
    "bringfrisch_phone_bring_creds", "bringfrisch_layout_mode", "bringfrisch_theme_mode",
    "bringfrisch_wg_id", "bringfrisch_persons", "bringfrisch_diet", "bringfrisch_freezer_pantry"
  ];

  const box = () => root.localStorage;
  function load(key, fallback) {
    try {
      const raw = box().getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      box().setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Speichern fehlgeschlagen", key, e);
    }
  }
  function remove(key) {
    try { box().removeItem(key); } catch (e) { /* ohne Speicher */ }
  }
  // Text ohne JSON (bf-os, bf-mode: auch vom kleinen Start-Script in index.html gelesen)
  function loadText(key) {
    try { return box().getItem(key); } catch (e) { return null; }
  }
  function saveText(key, value) {
    try { box().setItem(key, value); } catch (e) { /* ohne Speicher: nur für diese Sitzung */ }
  }
  function allKeys() {
    try { return Object.keys(box()); } catch (e) { return []; }
  }

  // Alle Migrationen an einer Stelle (einmal beim Start, vor dem ersten Lesen): Altlasten entfernen, alte Wochenwahl umziehen,
  // Wochenwahlen vergangener Wochen aufräumen. thisWeek = «2026-W46». Ohne Speicher passiert nichts.
  function migrate(thisWeek) {
    LEGACY_KEYS.forEach(remove);
    try {
      allKeys().forEach(k => {
        const m = /^bringfrisch_(?:week_vote_|wahl_)(\d{4}-W\d{2})$/.exec(k);
        if (m && m[1] < thisWeek) remove(k);
      });
      const old = load(PHONE.VOTE_KEY, null); // alte Wochenwahl (vor «pro Woche»)
      const perWeek = old && `${PHONE.VOTE_KEY}_${old.week}`;
      if (old && old.week === thisWeek && !load(perWeek, null)) save(perWeek, old);
      remove(PHONE.VOTE_KEY);
    } catch (e) { /* ohne Speicher */ }
  }

  root.BF_STORE = { KEYS: { ...SHARED, ...SYNC, ...PHONE }, LEGACY_KEYS, migrate, baseKey, wahlKey, load, save, remove, loadText, saveText, allKeys };
})(typeof globalThis !== "undefined" ? globalThis : self);
