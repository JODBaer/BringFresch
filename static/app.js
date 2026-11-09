// BringFrisch – WG-Menüplaner mit Schweizer Saisongemüse und Bring!-Übergabe.
// Läuft komplett im Browser; alle Daten liegen in localStorage.
(() => {
  "use strict";

  const DATA = window.BRINGFRISCH_DATA || {};
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
  const DEFAULT_SYNC_URL = "https://bringfrisch.bringfrisch-worker.workers.dev";
  const SYNC_KEY = "bringfrisch_sync";
  const PLAN_UPDATED_KEY = "bringfrisch_plan_updated";
  const DINNER_KEY = "bringfrisch_dinner_time";

  const KEYS = {
    plan: "bringfrisch_current_plan",
    members: "bringfrisch_members",
    staples: "bringfrisch_user_staples"
  };

  // Altlasten früherer Versionen (Logins, Layouts, Tiefkühler …) einmalig entfernen
  const LEGACY_KEYS = [
    "bringfrisch_phone_bring_creds", "bringfrisch_layout_mode", "bringfrisch_theme_mode",
    "bringfrisch_wg_id", "bringfrisch_persons", "bringfrisch_diet", "bringfrisch_freezer_pantry"
  ];

  // ---------------------------------------------------------------------------
  // Speicher
  // ---------------------------------------------------------------------------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Speichern fehlgeschlagen", key, e);
    }
  }

  LEGACY_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* egal */ } });

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
    shopFilter: "toBuy",
    catalogDay: 0,
    catalogFilter: "all",
    catalogMode: "day"
  };

  const savePlan = () => {
    save(KEYS.plan, state.plan);
    save(PLAN_UPDATED_KEY, Date.now());
    schedulePlanPush();
  };
  const saveMembers = () => {
    save(KEYS.members, state.members);
    save(PLAN_UPDATED_KEY, Date.now());
    schedulePlanPush();
  };
  const saveStaples = () => save(KEYS.staples, state.staples);

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------
  const $ = id => document.getElementById(id);

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function currentMonth() {
    return new Date().getMonth() + 1;
  }

  function todayIndex() {
    return (new Date().getDay() + 6) % 7;
  }

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
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
      btn.style.cssText = "margin-left:12px;border:0;background:none;color:inherit;font-weight:800;text-decoration:underline";
      btn.onclick = () => { action.run(); el.remove(); };
      el.appendChild(btn);
    }
    document.body.appendChild(el);
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
    return [...(DATA.recipes || []), ...(window.BRINGFRISCH_IMPORTED || []), ...((importer && importer.customRecipes) || [])];
  }

  // Gemeinsamer Nenner der Anwesenden: vegan > vegi > fleisch
  function effectiveDiet(eaterIds) {
    const diets = (eaterIds || []).map(id => (state.members.find(m => m.id === id) || {}).diet);
    if (diets.includes("vegan")) return "vegan";
    if (diets.includes("vegi")) return "vegi";
    return "fleisch";
  }

  function fitsDiet(recipe, diet) {
    if (diet === "vegan") return recipe.diet === "vegan";
    if (diet === "vegi") return recipe.diet === "vegi" || recipe.diet === "vegan";
    return true;
  }

  function inSeason(recipe, month = currentMonth()) {
    return !recipe.season_months || recipe.season_months.includes(month);
  }

  // Zufallsrezept passend zur Diät, saisonal bevorzugt, möglichst ohne Wiederholung
  function pickRecipe(diet, excludeIds = []) {
    const all = allRecipes();
    const fitting = all.filter(r => fitsDiet(r, diet));
    const pool = fitting.length ? fitting : all;
    const tiers = [
      pool.filter(r => inSeason(r) && !excludeIds.includes(r.id)),
      pool.filter(r => !excludeIds.includes(r.id)),
      pool
    ];
    const tier = tiers.find(t => t.length > 0) || [];
    return tier[Math.floor(Math.random() * tier.length)];
  }

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
    const ids = new Set(state.members.map(m => m.id));
    if (!Array.isArray(state.plan) || state.plan.length !== 7 || state.plan.some(d => !d || !d.title)) {
      state.plan = generateWeek();
    }
    state.plan.forEach((day, idx) => {
      day.day = DAYS[idx];
      const before = Array.isArray(day.eaters) ? day.eaters : null;
      const valid = before ? before.filter(id => ids.has(id)) : null;
      day.eaters = !before || (valid.length === 0 && before.length > 0) ? [...ids] : valid;
      if (day.leftover_buffer === undefined) day.leftover_buffer = DEFAULT_BUFFER;
      if (!day.extra_guests) day.extra_guests = 0;
    });
  }

  function portionsFor(day) {
    const people = day.eaters.length + (day.extra_guests || 0);
    if (people === 0) return 0; // niemand zuhause = es wird nicht gekocht
    return people + (day.leftover_buffer || 0);
  }

  // ---------------------------------------------------------------------------
  // Einkaufsliste (R2: Basis + individuelle Proteine + Beilage, R3: Reste-Puffer, R6: Grundvorrat)
  // ---------------------------------------------------------------------------
  const COUNT_UNITS = /^(stk|stück|bund|glas|dose|kopf|rolle|tranchen|portion|becher|pck|packung|el|tl|prise|zehe|zehen)$/i;

  function formatAmount(amount, unit) {
    const u = (unit || "").trim();
    const lu = u.toLowerCase();
    if (lu === "g" || lu === "ml") {
      if (amount >= 1000) {
        return `${(Math.ceil(amount / 100) / 10).toString()} ${lu === "g" ? "kg" : "l"}`;
      }
      return `${Math.max(10, Math.ceil(amount / 10) * 10)} ${u}`;
    }
    if (lu === "dl") return `${Math.ceil(amount * 2) / 2} dl`;
    if (lu === "kg" || lu === "l") return `${Math.ceil(amount * 10) / 10} ${u}`;
    if (COUNT_UNITS.test(lu)) return `${Math.max(1, Math.ceil(amount - 0.05))} ${u}`;
    return `${Math.round(amount * 10) / 10} ${u}`.trim();
  }

  // Einkaufsnamen aufräumen: «Schweizer», Klammern, «à ca. 400 g» wandern in die Zusatzinfo (wie die Menge)
  const SYNONYMS = { "speisekartoffeln": "Kartoffeln", "festkochende kartoffeln": "Kartoffeln", "mehligkochende kartoffeln": "Kartoffeln", "zwiebeln": "Zwiebel" };
  const TAP_WATER = /^(lauwarmes|kaltes|heisses|warmes|kochendes)?\s*(liter\s+)?wasser$/i;
  function cleanIngredient(raw) {
    let name = String(raw || "").trim();
    const notes = [];
    name = name.replace(/\*+/g, "").trim();
    name = name.replace(/\s*\(([^)]*)\)/g, (_, x) => { if (x.trim()) notes.push(x.trim()); return ""; });
    name = name.replace(/\s+(à|a)\s+(ca\.?\s*)?\d.*$/i, m => { notes.push(m.trim()); return ""; });
    if (/^schweizer\s+/i.test(name)) { name = name.replace(/^schweizer\s+/i, ""); notes.unshift("Schweizer"); }
    name = name.replace(/^(stängel|stängeli|liter|zweig|zweige|zweiglein|prise|bund)\s+/i, "").trim();
    name = SYNONYMS[name.toLowerCase()] || name;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return { name, note: notes.join(", "), skip: TAP_WATER.test(name) };
  }

  function computeShopping() {
    const stapleKeywords = [];
    state.staples.forEach(s => {
      if (s.in_stock !== false) (s.keywords || [s.name.toLowerCase()]).forEach(k => stapleKeywords.push(k.toLowerCase()));
    });
    const onBring = state.bringItems.map(n => n.toLowerCase().trim());
    const agg = {};

    function add(rawName, unit, amount, cat) {
      const { name, note, skip } = cleanIngredient(rawName);
      if (!name || skip || !(amount > 0)) return;
      const key = `${name.toLowerCase()}__${(unit || "").toLowerCase()}`;
      if (agg[key]) {
        agg[key].amount += amount;
        if (note) agg[key].notes.add(note);
        return;
      }
      const lower = name.toLowerCase();
      agg[key] = {
        name,
        unit: unit || "",
        amount,
        notes: new Set(note ? [note] : []),
        cat: cat || "Sonstiges",
        isStaple: stapleKeywords.some(k => lower.includes(k)),
        isOnBring: onBring.some(b => b === lower || b.includes(lower) || lower.includes(b))
      };
    }

    state.plan.forEach(day => {
      const portions = portionsFor(day);
      if (portions === 0) return;
      const scale = portions / (day.servings || DEFAULT_SERVINGS);

      // 1. Gemeinsame Basis für alle + Reste
      (day.ingredients || []).forEach(ing => {
        add(ing.name.trim(), (ing.unit || "").trim(), parseFloat(ing.amount || "1") * scale, ing.bring_cat);
      });

      // 2. Individuelle Proteine je anwesendem Esser
      const present = state.members.filter(m => day.eaters.includes(m.id));
      const meat = present.filter(m => m.diet === "fleisch").length;
      const vegi = present.filter(m => m.diet === "vegi").length;
      const vegan = present.filter(m => m.diet === "vegan").length;
      if (meat > 0 && day.diet !== "fleisch") add("Schweizer Speckwürfeli / Rindssteak", "g", 150 * meat, "Fleisch & Fisch");
      if (vegi > 0) add("Schweizer Grillkäse / Halloumi", "g", 100 * vegi, "Milch & Käse");
      if (vegan > 0) add("Tofu / veganer Reibkäse", "Portion", vegan, "Milch & Käse");

      // 3. Frische Beilage
      add("Nüsslisalat / Saisonsalat", "g", 50 * portions, "Obst & Gemüse");
    });

    state.shopping = Object.values(agg).map(({ notes, ...it }) => {
      const info = [...new Set([...notes].join(", ").split(", "))].filter(Boolean).join(", ");
      return { ...it, spec: [formatAmount(it.amount, it.unit), info].filter(Boolean).join(", ") };
    });
  }

  const toBuyItems = () => state.shopping.filter(it => !it.isStaple && !it.isOnBring);
  const listLine = it => `${it.name} (${it.spec})`;

  // ---------------------------------------------------------------------------
  // Rendering: Plan
  // ---------------------------------------------------------------------------
  function renderHeader() {
    const now = new Date();
    $("weekLabel").textContent = `KW ${isoWeek(now)} · ${MONTHS[now.getMonth()]}`;
  }

  function renderDays() {
    const short = initialsMap();
    const today = todayIndex();
    $("days").innerHTML = state.plan.map((day, idx) => `
      <div class="day${idx === today ? " today" : ""}">
        <span class="d">${DAYS[idx].slice(0, 2)}</span>
        <button class="title-btn" type="button" data-pick="${idx}" aria-label="Menü am ${DAYS[idx]} wechseln: ${esc(day.title)}">
          <span class="t">${esc(day.title)}</span><span class="caret">▾</span>
          ${day.source_url ? `<a class="src" href="${esc(day.source_url)}" target="_blank" rel="noopener" data-link aria-label="Rezept öffnen">🌐</a>` : ""}
        </button>
        <span class="chips">
          ${state.members.map(m => `<button type="button" class="chip${day.eaters.includes(m.id) ? "" : " off"}" data-day="${idx}" data-member="${esc(m.id)}" aria-pressed="${day.eaters.includes(m.id)}" aria-label="${esc(m.name)} am ${DAYS[idx]}">${esc(short[m.id])}</button>`).join("")}
          <select class="buf" data-buffer="${idx}" aria-label="Reste-Puffer am ${DAYS[idx]}">
            ${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === day.leftover_buffer ? " selected" : ""}>+${n}</option>`).join("")}
          </select>
        </span>
      </div>`).join("");
  }

  function renderBasketLine() {
    const n = toBuyItems().length;
    const staples = state.shopping.filter(it => it.isStaple).length;
    const onBring = state.shopping.filter(it => it.isOnBring && !it.isStaple).length;
    const extra = [staples ? `${staples} Grundvorrat ausgeblendet` : "", onBring ? `${onBring} schon auf Bring!` : ""].filter(Boolean).join(" · ");
    $("basketLine").innerHTML = `<span><b>🛒 Einkaufskorb: ${n} Artikel</b><small>${extra || "Alles für die ganze Woche"}</small></span><span class="chev">›</span>`;
  }

  function renderSeasonHint() {
    const m = currentMonth();
    const names = (DATA.season_items || [])
      .filter(it => (it.field_months || []).includes(m))
      .map(it => it.name.replace(/^Schweizer\s+/i, "").replace(/\s*\(.*\)$/, ""));
    $("seasonHint").textContent = names.length ? `Saison im ${MONTHS[m - 1]}: ${names.slice(0, 8).join(", ")}.` : "";
  }

  function renderCta() {
    const n = toBuyItems().length;
    $("ctaCount").textContent = `· ${n} Artikel`;
    $("syncBtn").disabled = n === 0;
  }

  // ---------------------------------------------------------------------------
  // Rendering: Einkauf
  // ---------------------------------------------------------------------------
  function renderShop() {
    const groups = {
      toBuy: toBuyItems(),
      onBring: state.shopping.filter(it => it.isOnBring && !it.isStaple),
      staples: state.shopping.filter(it => it.isStaple)
    };
    $("cntToBuy").textContent = groups.toBuy.length;
    $("cntOnBring").textContent = groups.onBring.length;
    $("cntStaples").textContent = groups.staples.length;
    $("shopSummary").textContent = `${state.shopping.length} Zutaten diese Woche`;
    document.querySelectorAll("#tab-shop .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === state.shopFilter)));

    const items = groups[state.shopFilter];
    if (items.length === 0) {
      const msg = {
        toBuy: "Nichts mehr zu kaufen. 🎉",
        onBring: "Noch nichts davon steht auf Bring!.",
        staples: "Keine Grundzutaten in diesem Wochenplan."
      }[state.shopFilter];
      $("shopList").innerHTML = `<div class="empty">${msg}</div>`;
      return;
    }
    const byAisle = {};
    items.forEach(it => (byAisle[it.cat] = byAisle[it.cat] || []).push(it));
    $("shopList").innerHTML = Object.keys(byAisle).sort().map(cat => `
      <div class="aisle">
        <h3>${esc(cat)}</h3>
        ${byAisle[cat].map(it => `<div class="item"><span>${esc(it.name)}</span><span class="amt">${esc(it.spec)}</span></div>`).join("")}
      </div>`).join("");
  }

  // ---------------------------------------------------------------------------
  // Rendering: Saison
  // ---------------------------------------------------------------------------
  function renderSeason(month) {
    const m = parseInt(month, 10);
    const news = (DATA.monthly_news || {})[m] || {};
    $("newsHeadline").textContent = news.headline || `Saison im ${MONTHS[m - 1]}`;
    $("newsTip").textContent = news.farmer_tip || "";
    const items = DATA.season_items || [];
    const field = items.filter(it => (it.field_months || []).includes(m));
    const storage = items.filter(it => !(it.field_months || []).includes(m) && (it.storage_months || []).includes(m));
    const card = it => `<div class="card veg"><b>${esc(it.name)}</b><small>${esc(it.category)}</small></div>`;
    $("fieldGrid").innerHTML = field.map(card).join("") || `<p class="hint">Diesen Monat kein Freilandgemüse.</p>`;
    $("storageGrid").innerHTML = storage.map(card).join("") || `<p class="hint">Keine Lagerware.</p>`;
  }

  function setupSeason() {
    const sel = $("monthSelect");
    sel.innerHTML = MONTHS.map((name, i) => `<option value="${i + 1}">${name}</option>`).join("");
    sel.value = String(currentMonth());
    sel.onchange = () => renderSeason(sel.value);
    renderSeason(sel.value);
  }

  // ---------------------------------------------------------------------------
  // Rendering: WG
  // ---------------------------------------------------------------------------
  const DIET_LABEL = { fleisch: "Fleisch", vegi: "Vegi", vegan: "Vegan" };

  function renderMembers() {
    $("members").innerHTML = state.members.map(m => `
      <div class="member">
        <b>${esc(m.name)}</b>
        <select data-diet="${esc(m.id)}" aria-label="Ernährung von ${esc(m.name)}">
          ${Object.keys(DIET_LABEL).map(d => `<option value="${d}"${m.diet === d ? " selected" : ""}>${DIET_LABEL[d]}</option>`).join("")}
        </select>
        <button class="icon-btn" type="button" data-remove="${esc(m.id)}" aria-label="${esc(m.name)} entfernen">✕</button>
      </div>`).join("");
  }

  function renderAttendance() {
    const short = initialsMap();
    const head = `<tr><th></th>${DAYS.map(d => `<th>${d.slice(0, 2)}</th>`).join("")}</tr>`;
    const rows = state.members.map(m => `<tr><td>${esc(m.name)}</td>${state.plan.map((day, idx) => {
      const on = day.eaters.includes(m.id);
      return `<td><button type="button" class="att${on ? "" : " off"}" data-day="${idx}" data-member="${esc(m.id)}" aria-pressed="${on}" aria-label="${esc(m.name)} am ${DAYS[idx]}">${esc(short[m.id])}</button></td>`;
    }).join("")}</tr>`).join("");
    const guests = `<tr><td>Gäste</td>${state.plan.map((day, idx) => `<td><button type="button" class="att guest" data-guests="${idx}" aria-label="Gäste am ${DAYS[idx]}: ${day.extra_guests}">${day.extra_guests}</button></td>`).join("")}</tr>`;
    const totals = `<tr><td class="muted">Portionen</td>${state.plan.map(day => `<td class="muted">${portionsFor(day)}</td>`).join("")}</tr>`;
    $("attendance").innerHTML = head + rows + guests + totals;
  }

  // Alles neu berechnen und zeichnen
  function refresh() {
    computeShopping();
    renderDays();
    renderBasketLine();
    renderCta();
    renderShop();
    renderAttendance();
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

  $("days").addEventListener("click", e => {
    if (e.target.closest("[data-link]")) return; // Rezept-Link normal öffnen
    const chip = e.target.closest("[data-member]");
    if (chip) return toggleEater(+chip.dataset.day, chip.dataset.member);
    if (e.target.closest("[data-buffer]")) return; // Auswahl läuft über "change"
    const pick = e.target.closest("[data-pick]");
    if (pick) openCatalog(+pick.dataset.pick);
  });

  // Reste-Puffer pro Tag: +0 … +6 Portionen
  $("days").addEventListener("change", e => {
    const sel = e.target.closest("[data-buffer]");
    if (!sel) return;
    state.plan[+sel.dataset.buffer].leftover_buffer = parseInt(sel.value, 10);
    savePlan();
    refresh();
  });

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

  // ---------------------------------------------------------------------------
  // Wochenwahl (Memory): 14 Saison-Gerichte, alle tippen Favoriten an, Top 7 → Plan
  // ---------------------------------------------------------------------------
  const VOTE_KEY = "bringfrisch_week_vote";
  const ME_KEY = "bringfrisch_me";
  const GRID_SIZE = 14;
  const PLAN_SIZE = 7;

  const recipeById = id => allRecipes().find(r => String(r.id) === String(id));
  const dietGroup = r => (r.diet === "fleisch" ? "fleisch" : "vegi");

  function weekKey(date = new Date()) {
    return `${date.getFullYear()}-W${String(isoWeek(date)).padStart(2, "0")}`;
  }

  function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Ersatz-Gericht: zuerst saisonal + gleiche Gruppe, dann saisonal, dann irgendeins
  function backupRecipe(group, excludeIds) {
    const all = allRecipes().filter(r => !excludeIds.includes(String(r.id)));
    const tiers = [
      all.filter(r => inSeason(r) && dietGroup(r) === group),
      all.filter(r => inSeason(r)),
      all.filter(r => dietGroup(r) === group),
      all
    ];
    const tier = tiers.find(t => t.length) || [];
    return tier[Math.floor(Math.random() * tier.length)];
  }

  // 14 Kandidaten: halb vegi (inkl. vegan), halb Fleisch, saisonal zuerst
  function pickCandidates() {
    const ids = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      const r = backupRecipe(i % 2 === 0 ? "vegi" : "fleisch", ids);
      if (!r) break;
      ids.push(String(r.id));
    }
    return ids;
  }

  function loadVote() {
    const saved = load(VOTE_KEY, null);
    if (saved && saved.week === weekKey() && Array.isArray(saved.candidates)) {
      saved.candidates = saved.candidates.filter(id => recipeById(id));
      return saved;
    }
    return { week: weekKey(), candidates: pickCandidates(), votes: {} };
  }

  let vote = null;
  const saveVote = () => save(VOTE_KEY, vote);

  // Mit dem Worker abgleichen: Kandidaten + Stimmen aller holen, eigene Stimme bleibt lokal führend
  async function pullVote() {
    if (!connected() || !vote) return;
    try {
      const remote = await api(`/week/${vote.week}`);
      if (!remote.candidates) {
        await api(`/week/${vote.week}/candidates`, { method: "PUT", body: { candidates: vote.candidates } });
      } else {
        vote.candidates = remote.candidates.filter(id => recipeById(id));
      }
      const me = myId();
      Object.entries(remote.votes || {}).forEach(([member, v]) => {
        if (member !== me || !vote.votes[me]) vote.votes[member] = v;
      });
      saveVote();
      if ($("voteDialog").open) renderVote();
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  let votePushTimer = null;
  function pushMyVote() {
    if (!connected()) return;
    clearTimeout(votePushTimer);
    votePushTimer = setTimeout(() => {
      api(`/week/${vote.week}/vote/${encodeURIComponent(myId())}`, { method: "PUT", body: myVote() }).catch(e => setSyncStatus(e.message, false));
    }, 500);
  }

  function pushCandidates() {
    if (!connected()) return;
    api(`/week/${vote.week}/candidates`, { method: "PUT", body: { candidates: vote.candidates } }).catch(e => setSyncStatus(e.message, false));
  }

  function myId() {
    const saved = load(ME_KEY, null);
    return state.members.some(m => m.id === saved) ? saved : state.members[0].id;
  }

  function myVote() {
    const id = myId();
    vote.votes[id] = vote.votes[id] || { likes: [], days: {} };
    return vote.votes[id];
  }

  function votersOf(recipeId) {
    return state.members.filter(m => ((vote.votes[m.id] || {}).likes || []).includes(recipeId));
  }

  function ranking() {
    return vote.candidates
      .map((id, order) => ({ id, order, voters: votersOf(id) }))
      .sort((a, b) => b.voters.length - a.voters.length || a.order - b.order);
  }

  function renderVote() {
    const short = initialsMap();
    const mine = myVote();
    $("voteSubtitle").textContent = `KW ${isoWeek(new Date())} · ${GRID_SIZE} Saison-Gerichte, die Top ${PLAN_SIZE} kommen in den Plan`;
    $("voteMe").innerHTML = state.members.map(m => `<option value="${esc(m.id)}"${m.id === myId() ? " selected" : ""}>${esc(m.name)}</option>`).join("");
    $("voteMine").textContent = `${mine.likes.length} gewählt`;

    $("voteGrid").innerHTML = vote.candidates.map(id => {
      const r = recipeById(id);
      const on = mine.likes.includes(id);
      const wish = mine.days[id];
      return `
        <div class="vcard${on ? " on" : ""}">
          <button class="tap" type="button" data-like="${esc(id)}" aria-pressed="${on}" aria-label="${esc(r.title)} ${on ? "abwählen" : "wählen"}"></button>
          ${on ? `<span class="tick" aria-hidden="true">✓</span>` : ""}
          <span class="vt">${esc(r.title)}</span>
          <span class="vm">${DIET_LABEL[r.diet] || "Vegi"} · ${r.prep_time_min || 30} Min.${r.source_url ? ` · <a href="${esc(r.source_url)}" target="_blank" rel="noopener">🌐</a>` : ""}</span>
          ${on ? `<span class="days-pick" role="group" aria-label="Wunschtag">${DAYS.map((d, i) => `<button type="button" data-wish="${esc(id)}" data-day="${i}" aria-pressed="${wish === i}">${d.slice(0, 2)}</button>`).join("")}</span>` : ""}
          <span class="vv">${votersOf(id).map(m => `<span class="mini" title="${esc(m.name)}">${esc(short[m.id])}</span>`).join("")}</span>
        </div>`;
    }).join("");

    const voted = state.members.filter(m => ((vote.votes[m.id] || {}).likes || []).length > 0);
    $("voteWho").textContent = `${voted.length} von ${state.members.length} haben gewählt`;
    $("voteRank").innerHTML = ranking().map((x, k) => {
      const r = recipeById(x.id);
      return `<div class="rank-row${k < PLAN_SIZE ? "" : " out"}">
        <span class="n">${k + 1}</span><span class="t">${esc(r.title)}</span>
        <span class="vv">${x.voters.map(m => `<span class="mini">${esc(short[m.id])}</span>`).join("")}</span>
      </div>`;
    }).join("");
  }

  let votePoll = null;
  function openVote() {
    vote = loadVote();
    saveVote();
    renderVote();
    $("voteDialog").showModal();
    pullVote();
    clearInterval(votePoll);
    if (connected()) votePoll = setInterval(pullVote, 15000); // Stimmen der anderen live nachladen
  }
  $("voteDialog").addEventListener("close", () => clearInterval(votePoll));

  $("openVoteBtn").onclick = openVote;

  $("voteMe").onchange = () => {
    save(ME_KEY, $("voteMe").value);
    renderVote();
  };

  $("voteGrid").addEventListener("click", e => {
    const wish = e.target.closest("[data-wish]");
    if (wish) {
      const mine = myVote();
      const day = +wish.dataset.day;
      if (mine.days[wish.dataset.wish] === day) delete mine.days[wish.dataset.wish];
      else mine.days[wish.dataset.wish] = day;
      saveVote();
      pushMyVote();
      renderVote();
      return;
    }
    const like = e.target.closest("[data-like]");
    if (!like) return;
    const mine = myVote();
    const id = like.dataset.like;
    if (mine.likes.includes(id)) {
      mine.likes = mine.likes.filter(x => x !== id);
      delete mine.days[id];
    } else {
      mine.likes.push(id);
    }
    saveVote();
    pushMyVote();
    renderVote();
  });

  // Nur Gerichte ohne Stimme werden durch saisonale Reserve ersetzt
  $("voteShuffleBtn").onclick = () => {
    let swapped = 0;
    vote.candidates = vote.candidates.map(id => {
      if (votersOf(id).length > 0) return id;
      const r = backupRecipe(dietGroup(recipeById(id)), vote.candidates);
      if (!r) return id;
      swapped++;
      return String(r.id);
    });
    saveVote();
    pushCandidates();
    renderVote();
    toast(swapped ? `${swapped} Gerichte neu gemischelt` : "Alle Gerichte haben schon Stimmen");
  };

  $("voteAddBtn").onclick = () => {
    state.catalogMode = "vote";
    $("voteDialog").close();
    openCatalog(0);
  };

  // Faire Tagesverteilung: Gericht auf Tag, an dem seine Fans zuhause sind (+2 je Fan), Wunschtag +3
  function assignDays(recipeIds) {
    const score = (id, day) => votersOf(id).reduce((s, m) => {
      const v = vote.votes[m.id];
      return s + (state.plan[day].eaters.includes(m.id) ? 2 : 0) + (v.days[id] === day ? 3 : 0);
    }, 0);
    const pairs = [];
    recipeIds.forEach(id => DAYS.forEach((_, day) => pairs.push({ id, day, s: score(id, day) })));
    pairs.sort((a, b) => b.s - a.s || a.day - b.day);
    const result = {};
    const usedDays = new Set();
    pairs.forEach(p => {
      if (result[p.id] === undefined && !usedDays.has(p.day)) {
        result[p.id] = p.day;
        usedDays.add(p.day);
      }
    });
    return result; // recipeId -> dayIdx
  }

  $("voteApplyBtn").onclick = () => {
    const top = ranking().slice(0, PLAN_SIZE);
    const withVotes = top.filter(x => x.voters.length > 0).length;
    if (withVotes === 0) return toast("Noch niemand hat gewählt");
    const previous = state.plan;
    const days = assignDays(top.map(x => x.id));
    const next = [...state.plan];
    Object.entries(days).forEach(([id, day]) => { next[day] = makeDay(recipeById(id), day, state.plan[day]); });
    state.plan = next;
    savePlan();
    refresh();
    $("voteDialog").close();
    toast(withVotes < PLAN_SIZE ? `Plan übernommen (${PLAN_SIZE - withVotes} ohne Stimme aufgefüllt)` : "Plan übernommen", {
      label: "Rückgängig",
      run: () => { state.plan = previous; savePlan(); refresh(); }
    });
  };

  $("voteRandomBtn").onclick = () => {
    $("voteDialog").close();
    planRandomWeek();
  };

  $("basketLine").onclick = () => showTab("shop");

  // ---------------------------------------------------------------------------
  // Menü-Katalog
  // ---------------------------------------------------------------------------
  function assignRecipe(recipe, dayIdx) {
    state.plan[dayIdx] = makeDay(recipe, dayIdx, state.plan[dayIdx]);
    savePlan();
    refresh();
  }

  // Katalog dient zwei Zwecken: Gericht für einen Tag wählen ("day") oder zur Wochenwahl hinzufügen ("vote")
  function openCatalog(dayIdx) {
    state.catalogDay = dayIdx;
    const forVote = state.catalogMode === "vote";
    $("catalogSubtitle").textContent = forVote
      ? "Gericht zur Wochenwahl hinzufügen"
      : `für ${DAYS[dayIdx]} · ${state.plan[dayIdx].eaters.length} Esser`;
    $("randomPickBtn").hidden = forVote;
    $("catalogSearch").value = "";
    renderCatalog();
    $("catalogDialog").showModal();
  }

  function renderCatalog() {
    const q = $("catalogSearch").value.toLowerCase().trim();
    const f = state.catalogFilter;
    document.querySelectorAll("#catalogFilters button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
    const list = allRecipes().filter(r => {
      if (f === "vegi" && !fitsDiet(r, "vegi")) return false;
      if (f === "fleisch" && r.diet !== "fleisch") return false;
      if (f === "season" && !inSeason(r)) return false;
      if (f === "custom" && !r.is_custom && !String(r.id).startsWith("custom-")) return false;
      if (q) {
        const hay = [r.title, ...(r.ingredients || []).map(i => i.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const actionLabel = state.catalogMode === "vote" ? "Zur Wochenwahl" : `Für ${DAYS[state.catalogDay].slice(0, 2)} einplanen`;
    $("catalogList").innerHTML = list.length === 0
      ? `<div class="empty">Keine Rezepte gefunden.</div>`
      : list.map(r => {
        const custom = r.is_custom || String(r.id).startsWith("custom-");
        return `
        <div class="card recipe">
          <div class="recipe-head">
            <div>
              <b>${esc(r.title)}</b>
              <small>${DIET_LABEL[r.diet] || "Vegi"} · ${r.servings || DEFAULT_SERVINGS} Port. · ${r.prep_time_min || 30} Min.${inSeason(r) ? "" : " · nicht Saison"}</small>
            </div>
            ${r.source_url ? `<a class="pill" href="${esc(r.source_url)}" target="_blank" rel="noopener">🌐 Rezept</a>` : ""}
          </div>
          <div class="row">
            <button class="btn dark" type="button" data-assign="${esc(r.id)}">${actionLabel}</button>
            ${custom ? `<button class="btn" type="button" data-delete="${esc(r.id)}" style="flex:0 0 auto">Löschen</button>` : ""}
          </div>
        </div>`;
      }).join("");
  }

  $("catalogSearch").oninput = renderCatalog;
  $("catalogFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.catalogFilter = b.dataset.filter;
    renderCatalog();
  });

  $("catalogList").addEventListener("click", e => {
    const assign = e.target.closest("[data-assign]");
    if (assign) {
      const recipe = allRecipes().find(r => String(r.id) === assign.dataset.assign);
      if (!recipe) return;
      const mode = state.catalogMode;
      state.catalogMode = "day";
      $("catalogDialog").close();
      useRecipe(recipe, mode);
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      if (del.dataset.armed !== "1") {
        del.dataset.armed = "1";
        del.textContent = "Wirklich?";
        return;
      }
      importer.deleteCustomRecipe(del.dataset.delete);
      renderCatalog();
      toast("Rezept gelöscht");
    }
  });

  function useRecipe(recipe, mode) {
    if (mode === "vote") {
      const id = String(recipe.id);
      if (!vote.candidates.includes(id)) vote.candidates.push(id);
      saveVote();
      pushCandidates();
      renderVote();
      $("voteDialog").showModal();
      toast(`${recipe.title} ist in der Wochenwahl`);
      return;
    }
    assignRecipe(recipe, state.catalogDay);
    toast(`${DAYS[state.catalogDay]}: ${recipe.title}`);
  }

  // Schliessen ohne Auswahl: im Wochenwahl-Modus zurück zur Wochenwahl
  $("catalogDialog").addEventListener("close", () => {
    if (state.catalogMode === "vote" && !$("recipeDialog").open) {
      state.catalogMode = "day";
      renderVote();
      $("voteDialog").showModal();
    }
  });

  $("randomPickBtn").onclick = () => {
    const idx = state.catalogDay;
    const current = state.plan[idx];
    const recipe = pickRecipe(effectiveDiet(current.eaters), state.plan.map(d => d.id));
    assignRecipe(recipe, idx);
    $("catalogDialog").close();
    toast(`${DAYS[idx]}: ${recipe.title}`);
  };

  // ---------------------------------------------------------------------------
  // Eigenes Rezept
  // ---------------------------------------------------------------------------
  $("newRecipeBtn").onclick = () => {
    $("recipeForm").reset();
    $("recipeServings").value = DEFAULT_SERVINGS;
    $("recipeDialog").showModal();
    $("catalogDialog").close();
  };

  $("recipeDialog").addEventListener("close", () => {
    if (state.catalogMode === "vote") {
      state.catalogMode = "day";
      renderVote();
      $("voteDialog").showModal();
    }
  });

  $("recipeUrl").addEventListener("change", async () => {
    const link = $("recipeUrl").value.trim();
    if (await importFromLink(link)) return;
    const title = $("recipeTitle");
    if (!title.value.trim()) title.value = importer.analyzeRecipeUrl(link).title;
  });

  $("recipeForm").addEventListener("submit", e => {
    e.preventDefault();
    const recipe = importer.createCustomRecipe({
      title: $("recipeTitle").value,
      url: $("recipeUrl").value,
      diet: $("recipeDiet").value,
      servings: $("recipeServings").value,
      ingredientsText: $("recipeIngredients").value,
      instructions: $("recipeInstructions").value
    });
    const mode = state.catalogMode;
    state.catalogMode = "day";
    $("recipeDialog").close();
    useRecipe(recipe, mode);
  });

  // ---------------------------------------------------------------------------
  // Einkauf & Grundvorrat
  // ---------------------------------------------------------------------------
  document.querySelector("#tab-shop .seg").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.shopFilter = b.dataset.filter;
    renderShop();
  });

  $("copyListBtn").onclick = async () => {
    const items = toBuyItems();
    const ok = await copyText(items.map(listLine).join("\n"));
    toast(ok ? `${items.length} Artikel kopiert` : "Kopieren nicht möglich");
  };

  function renderStaples() {
    const byCat = {};
    state.staples.forEach((s, idx) => (byCat[s.category || "Grundzutaten"] = byCat[s.category || "Grundzutaten"] || []).push({ ...s, idx }));
    $("staplesList").innerHTML = Object.keys(byCat).map(cat => `
      <div>
        <p class="label" style="padding:0 0 6px">${esc(cat)}</p>
        <div class="row" style="gap:6px">
          ${byCat[cat].map(s => `<button type="button" class="staple${s.in_stock === false ? " empty-stock" : ""}" data-staple="${s.idx}" aria-pressed="${s.in_stock !== false}" style="flex:0 0 auto">${esc(s.name)}</button>`).join("")}
        </div>
      </div>`).join("");
  }

  $("openStaplesBtn").onclick = () => {
    renderStaples();
    $("staplesDialog").showModal();
  };

  $("staplesList").addEventListener("click", e => {
    const b = e.target.closest("[data-staple]");
    if (!b) return;
    const s = state.staples[+b.dataset.staple];
    s.in_stock = s.in_stock === false;
    saveStaples();
    renderStaples();
    refresh();
  });

  $("addStapleForm").addEventListener("submit", e => {
    e.preventDefault();
    const val = $("newStaple").value.trim();
    if (!val) return;
    state.staples.push({ id: "custom-" + Date.now(), name: val, category: "Eigene", in_stock: true, keywords: [val.toLowerCase()] });
    saveStaples();
    $("newStaple").value = "";
    renderStaples();
    refresh();
  });

  // ---------------------------------------------------------------------------
  // WG: Mitbewohner, Anwesenheit, Plan teilen
  // ---------------------------------------------------------------------------
  $("members").addEventListener("change", e => {
    const sel = e.target.closest("[data-diet]");
    if (!sel) return;
    const m = state.members.find(x => x.id === sel.dataset.diet);
    m.diet = sel.value;
    saveMembers();
    refresh();
  });

  $("members").addEventListener("click", e => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    if (state.members.length <= 1) return toast("Mindestens eine Person braucht es");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Entfernen?";
      return;
    }
    const id = b.dataset.remove;
    state.members = state.members.filter(m => m.id !== id);
    state.plan.forEach(d => { d.eaters = d.eaters.filter(x => x !== id); });
    saveMembers();
    savePlan();
    renderMembers();
    refresh();
  });

  $("addMemberForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("newMemberName").value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9äöü]+/g, "-") + "-" + Date.now().toString(36);
    state.members.push({ id, name, diet: $("newMemberDiet").value });
    state.plan.forEach(d => d.eaters.push(id));
    saveMembers();
    savePlan();
    $("newMemberName").value = "";
    renderMembers();
    refresh();
  });

  $("attendance").addEventListener("click", e => {
    const att = e.target.closest("[data-member]");
    if (att) return toggleEater(+att.dataset.day, att.dataset.member);
    const g = e.target.closest("[data-guests]");
    if (g) {
      const day = state.plan[+g.dataset.guests];
      day.extra_guests = ((day.extra_guests || 0) + 1) % 5;
      savePlan();
      refresh();
    }
  });

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
  // Bring! füllen (Übergabe per Teilen / Kopieren)
  // ---------------------------------------------------------------------------
  function openHandoff() {
    const items = toBuyItems();
    $("handoffSubtitle").textContent = `${items.length} Artikel · Teilen-Menü, Kopieren oder direkt in Bring! einfügen`;
    $("handoffPreview").textContent = items.map(listLine).join("\n");
    $("handoffDialog").showModal();
  }

  $("syncBtn").onclick = () => (connected() ? syncToBring() : openHandoff());

  $("shareListBtn").onclick = async () => {
    const text = toBuyItems().map(listLine).join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "BringFrisch Einkaufsliste", text });
        return;
      } catch (e) { /* abgebrochen → kopieren */ }
    }
    toast((await copyText(text)) ? "Liste kopiert" : "Kopieren nicht möglich");
  };

  $("copyOnlyBtn").onclick = async () => {
    const items = toBuyItems();
    toast((await copyText(items.map(listLine).join("\n"))) ? `${items.length} Artikel kopiert` : "Bitte Text oben markieren und kopieren");
  };

  $("copyOpenBringBtn").onclick = async () => {
    await copyText(toBuyItems().map(listLine).join("\n"));
    toast("Kopiert – Bring! wird geöffnet");
    setTimeout(() => { location.href = "bring://"; }, 300);
  };

  // ---------------------------------------------------------------------------
  // Verbindung zum Cloudflare Worker (Bring!-Sync, gemeinsamer Plan, Wochenwahl, Kalender)
  // ---------------------------------------------------------------------------
  let sync = { url: DEFAULT_SYNC_URL, pin: "", ...(load(SYNC_KEY, {}) || {}) };
  if (!sync.url) sync.url = DEFAULT_SYNC_URL;

  function connected() {
    return !!(sync.url && sync.pin);
  }

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(sync.url.replace(/\/+$/, "") + path, {
      method,
      headers: { "X-WG-PIN": sync.pin, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* keine JSON-Antwort */ }
    if (!res.ok) throw new Error(data.error || `Verbindungsfehler (${res.status})`);
    return data;
  }

  function setSyncStatus(text, ok) {
    const el = $("syncStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "var(--accent)" : "var(--muted)";
  }

  let planPushTimer = null;
  function schedulePlanPush() {
    if (!connected()) return;
    clearTimeout(planPushTimer);
    planPushTimer = setTimeout(() => {
      api("/plan", {
        method: "PUT",
        body: { week: weekKey(), plan: state.plan, members: state.members, dinnerTime: load(DINNER_KEY, "18:30") }
      }).catch(e => setSyncStatus(e.message, false));
    }, 1500);
  }

  // Neuerer Plan von einem anderen Handy? Dann übernehmen.
  async function pullShared() {
    if (!connected()) return;
    try {
      const [remote, bring] = await Promise.all([api("/plan"), api("/bring/list")]);
      state.bringItems = bring.items || [];
      const localUpdated = load(PLAN_UPDATED_KEY, 0);
      if (remote.plan && remote.updated > localUpdated) {
        if (Array.isArray(remote.members) && remote.members.length) state.members = remote.members;
        state.plan = remote.plan;
        normalizePlan();
        save(KEYS.plan, state.plan);
        save(KEYS.members, state.members);
        save(PLAN_UPDATED_KEY, remote.updated);
        renderMembers();
        toast("Wochenplan der WG geladen");
      }
      refresh();
      setSyncStatus("Verbunden ✓", true);
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  async function syncToBring() {
    // Bring! kennt pro Name nur einen Eintrag: gleiche Namen mit verschiedenen Einheiten zusammenfassen
    const byName = new Map();
    for (const it of toBuyItems()) {
      const k = it.name.toLowerCase();
      const prev = byName.get(k);
      byName.set(k, prev ? { name: prev.name, spec: `${prev.spec} + ${it.spec}` } : { name: it.name, spec: it.spec });
    }
    const items = [...byName.values()];
    const btn = $("syncBtn");
    btn.disabled = true;
    try {
      let pushed = 0;
      for (let i = 0; i < items.length; i += 40) {
        const res = await api("/bring/sync", { method: "POST", body: { items: items.slice(i, i + 40) } });
        pushed += res.pushed || 0;
      }
      state.bringItems = (await api("/bring/list")).items || [];
      refresh();
      toast(`${pushed} Artikel in Bring! ✓`);
    } catch (e) {
      toast(`Bring!: ${e.message}`);
      openHandoff();
    } finally {
      renderCta();
    }
  }

  function renderSyncSettings() {
    $("syncUrl").value = sync.url || "";
    $("syncPin").value = sync.pin || "";
    $("dinnerTime").value = load(DINNER_KEY, "18:30");
    setSyncStatus(connected() ? "Verbinde …" : "Nicht verbunden: Bring! über Teilen/Kopieren", false);
    if (connected()) loadBringLists();
  }

  $("syncForm").addEventListener("submit", async e => {
    e.preventDefault();
    sync = { url: $("syncUrl").value.trim(), pin: $("syncPin").value.trim() };
    save(SYNC_KEY, sync);
    if (!connected()) return setSyncStatus("Adresse und PIN eingeben", false);
    setSyncStatus("Verbinde …", false);
    await pullShared();
    if ($("syncStatus").textContent.startsWith("Verbunden")) {
      save(PLAN_UPDATED_KEY, Math.max(load(PLAN_UPDATED_KEY, 0), 1));
      schedulePlanPush();
      loadBringLists();
    }
  });

  // Welche Bring!-Liste? Auswahl gilt für die ganze WG (im Worker gespeichert).
  async function loadBringLists() {
    const field = $("bringListField"), sel = $("bringListSelect"), hint = $("bringListHint");
    if (!field || !connected()) return;
    try {
      const { lists, active } = await api("/bring/lists");
      sel.innerHTML = "";
      for (const l of lists) {
        const o = document.createElement("option");
        o.value = l.uuid;
        o.textContent = l.name;
        o.selected = l.uuid === active;
        sel.appendChild(o);
      }
      field.hidden = false;
      hint.hidden = false;
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  $("bringListSelect").addEventListener("change", async e => {
    try {
      const { name } = await api("/bring/target", { method: "PUT", body: { uuid: e.target.value } });
      state.bringItems = (await api("/bring/list")).items || [];
      refresh();
      toast(`Bring!-Liste: ${name} ✓`);
    } catch (err) {
      toast(err.message);
      loadBringLists();
    }
  });

  $("dinnerTime").addEventListener("change", () => {
    save(DINNER_KEY, $("dinnerTime").value || "18:30");
    schedulePlanPush();
  });

  $("calendarBtn").onclick = async () => {
    if (!connected()) return toast("Zuerst mit dem WG-Server verbinden");
    try {
      const { url } = await api("/cal-link");
      await copyText(url);
      toast("Kalender-Link kopiert – wird geöffnet");
      setTimeout(() => { location.href = url.replace(/^https:/, "webcal:"); }, 400);
    } catch (e) {
      toast(e.message);
    }
  };

  // Rezept-Link: Zutaten und Portionen direkt von der Rezeptseite holen
  async function importFromLink(link) {
    if (!connected() || !link) return false;
    try {
      const r = await api(`/recipe?url=${encodeURIComponent(link)}`);
      if (!$("recipeTitle").value.trim()) $("recipeTitle").value = r.title || "";
      $("recipeServings").value = r.servings || DEFAULT_SERVINGS;
      if (!$("recipeIngredients").value.trim()) $("recipeIngredients").value = (r.ingredients || []).join("\n");
      toast(`${(r.ingredients || []).length} Zutaten übernommen`);
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
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
    document.querySelectorAll("nav button").forEach(b => {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    document.querySelector("main").scrollTop = 0;
  }

  document.querySelector("nav").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (b) showTab(b.dataset.tab);
  });

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  const fromLink = importPlanFromHash();
  if (!fromLink) state.plan = load(KEYS.plan, []);
  normalizePlan();
  if (fromLink) {
    savePlan(); // per Link empfangener Plan gilt als neueste Version
    saveMembers();
  } else {
    save(KEYS.plan, state.plan); // nur lokal sichern, Zeitstempel bleibt (sonst wäre der WG-Plan nie "neuer")
    save(KEYS.members, state.members);
  }

  renderHeader();
  renderSeasonHint();
  setupSeason();
  renderMembers();
  renderSyncSettings();
  refresh();
  if (fromLink) toast("Wochenplan aus Link übernommen");
  else pullShared();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service Worker:", err));
  }
})();
