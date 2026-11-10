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
  const VORRAT_UPDATED_KEY = "bringfrisch_vorrat_updated";
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
    bringMine: [], // vom Bot gesetzt -> darf er wieder wegnehmen
    bringSpecs: {}, // name (klein) -> Mengenangabe auf Bring!
    sentSpecs: {}, // name (klein) -> was der Bot zuletzt gesendet hat
    shopFilter: "toBuy",
    catalogDay: 0,
    catalogFilter: "all",
    catalogMode: "day"
  };

  // Nächste Woche (ab Donnerstag): eigener Plan pro KW. state.plan ist immer die angezeigte Woche.
  const NEXT_KEY = "bringfrisch_next_plan"; // { week, plan, updated }
  const PLAN_WEEK_KEY = "bringfrisch_plan_week"; // KW, zu der der gespeicherte Plan gehört
  let viewNext = false; // zeigt gerade die nächste Woche
  let curPlan = null; // Plan der laufenden Woche, solange die nächste angezeigt wird
  let nextDoc = load(NEXT_KEY, null);
  const currentPlan = () => (viewNext ? curPlan : state.plan);
  const otherPlan = () => (viewNext ? curPlan : nextDoc && nextDoc.plan);

  const savePlan = () => {
    if (viewNext) {
      nextDoc = { week: nextWeekKey(), plan: state.plan, updated: Date.now() };
      save(NEXT_KEY, nextDoc);
      scheduleNextPush();
      return;
    }
    save(KEYS.plan, state.plan);
    save(PLAN_UPDATED_KEY, Date.now());
    schedulePlanPush();
  };
  const saveMembers = () => {
    save(KEYS.members, state.members);
    save(PLAN_UPDATED_KEY, Date.now());
    schedulePlanPush();
  };
  // Grundvorrat gehört der ganzen WG: lokal speichern und (verbunden) an den Server schicken
  var vorratTimer = null;
  const saveStaples = () => {
    save(KEYS.staples, state.staples);
    save(VORRAT_UPDATED_KEY, Date.now());
    let online = false;
    try { online = connected(); } catch (e) { /* beim Start noch nicht bereit */ }
    if (!online) return;
    clearTimeout(vorratTimer);
    vorratTimer = setTimeout(() => {
      vorratTimer = null;
      api("/vorrat", { method: "PUT", body: { staples: state.staples } })
        .then(r => save(VORRAT_UPDATED_KEY, r.updated))
        .catch(e => setSyncStatus(e.message, false));
    }, 800);
  };

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
        const { eaters, leftover_buffer, extra_guests } = day;
        plan[idx] = { ...fresh, day: DAYS[idx], eaters, leftover_buffer, extra_guests };
      }
    });
    return plan;
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
  const TAP_WATER = /^((lauwarmes|kaltes|heisses|warmes|kochendes)?\s*(liter\s+)?(salz)?wasser|bratschlauch|backpapier)$/i;
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

  // ---------------------------------------------------------------------------
  // Bring!-Katalog: Namen auf bekannte Bring!-Artikel abbilden, damit sie ein Bild bekommen.
  // «Butternuss-Kürbis» -> Kürbis (Zusatz «Butternuss-Kürbis» in der Mengenangabe)
  // ---------------------------------------------------------------------------
  const BRING_SYNONYMS = {
    "zwiebel": "Zwiebeln", "schalotte": "Zwiebeln", "schalotten": "Zwiebeln", "röstzwiebeln": "Zwiebeln", "zwiebelringe": "Zwiebeln",
    "rüebli": "Karotten", "bundrüebli": "Karotten", "pfälzerrüebli": "Karotten", "bundkarotten": "Karotten",
    "knoblauchzehe": "Knoblauch", "knoblauchzehen": "Knoblauch", "peterli": "Petersilie",
    "ei": "Eier", "eigelb": "Eier", "eigelbe": "Eier", "eiweiss": "Eier", "freilandeier": "Eier",
    "bratbutter": "Butter", "bratcrème": "Butter", "bratcreme": "Butter", "butterflocken": "Butter",
    "bio-zitrone": "Zitrone", "zitronenschnitz": "Zitrone", "limetten": "Limette", "blutorangen": "Orange",
    "bundzwiebel": "Frühlingszwiebeln", "bundzwiebeln": "Frühlingszwiebeln",
    "zucchini": "Zucchetti", "auberginen": "Aubergine", "chicorée": "Salat", "nüsslisalat": "Salat", "salatspinat": "Spinat",
    "peperoncino": "Peperoncini", "chilischote": "Peperoncini", "kefen": "Erbsen", "maiskolben": "Mais",
    "pastinaken": "Gemüse", "schwarzwurzeln": "Gemüse", "okras": "Gemüse", "federkohl": "Kohl", "rosenkohl": "Kohl", "wirz": "Kohl", "pak choi": "Kohl",
    "stangensellerie": "Sellerie", "knollensellerie": "Sellerie", "sellerieknolle": "Sellerie", "salatgurke": "Gurke",
    "tomate": "Tomaten", "gehackte tomaten": "Pelati", "passata": "Tomatensauce", "tomatensugo": "Tomatensauce", "tomatenpüree": "Tomatenmark",
    "estragon": "Kräuter", "dill": "Kräuter", "kerbel": "Kräuter", "kresse": "Kräuter", "bärlauch": "Kräuter", "salbeiblätter": "Salbei",
    "maizena": "Speisestärke", "maisstärke": "Speisestärke", "panko": "Paniermehl", "crème fraîche": "Creme fraiche",
    "paprika": "Paprikapulver", "edelsüss-paprika": "Paprikapulver", "zimtpulver": "Zimt",
    "sultaninen": "Dörrobst", "apfelschnitze": "Dörrobst", "birnenschnitze": "Dörrobst", "dörraprikosen": "Dörrobst",
    "kürbiskerne": "Nüsse", "sonnenblumenkerne": "Nüsse", "cashewkerne": "Nüsse",
    "teigwaren": "Pasta", "magronen": "Pasta", "hörnli": "Pasta", "pappardelle": "Pasta", "maultaschen": "Pasta",
    "spätzle": "Nudeln", "spätzli": "Nudeln", "knöpfle": "Nudeln", "wildreismix": "Reis", "risotto-reis": "Risottoreis",
    "tiefkühlpizza": "Pizza", "chicken nuggets": "Chicken Wings", "dumplings": "Chinesisches Essen", "gyoza": "Chinesisches Essen",
    "sbrinz": "Reibkäse", "sbrinzlocken": "Reibkäse", "gruyère": "Käse", "appenzeller": "Käse", "emmentaler": "Käse", "cheddar": "Käse",
    "pecorino": "Käse", "grillkäse": "Käse", "halloumi": "Käse", "raclettekäse": "Raclette",
    "speckwürfeli": "Speck", "speckwürfelchen": "Speck", "apfelwein": "Cidre", "cornflakes": "Corn Flakes", "fleur de sel": "Salz",
    "quinoa": "Couscous", "goldhirse": "Couscous", "pleurotus": "Pilze", "kräuterseitlinge": "Pilze", "estragonzweiglein": "Kräuter",
    "cervelats": "Cervelat", "luganighe": "Wurst", "mortadella": "Aufschnitt", "schinkentranchen": "Schinken",
  };
  const BRING_PREFIX = [
    [/^kalbs?/, "Kalbfleisch"], [/^schweins?/, "Schweinefleisch"], [/^rinds?/, "Rindfleisch"], [/^lamm/, "Lamm"],
    [/^poulet/, "Poulet"], [/^lachs/, "Lachs"], [/^thunfisch/, "Thunfisch"],
    [/^(kabeljau|seelachs|seehecht|seeteufel|saibling|forelle|egli|zander)/, "Fisch"],
  ];
  let bringIndex = null;
  function bringLookup(word) {
    if (!bringIndex) {
      bringIndex = {};
      for (const [id, n] of Object.entries(window.BRING_CATALOG || {})) {
        bringIndex[id.toLowerCase()] = id;
        bringIndex[n.toLowerCase()] = id;
      }
    }
    const w = String(word || "").toLowerCase().trim();
    if (!w) return null;
    const syn = BRING_SYNONYMS[w];
    if (syn && bringIndex[syn.toLowerCase()]) return bringIndex[syn.toLowerCase()];
    for (const v of [w, w.replace(/n$/, ""), w.replace(/en$/, ""), w.replace(/e$/, ""), w + "n", w + "e"]) {
      if (bringIndex[v]) return bringIndex[v];
    }
    return null;
  }
  // -> Bring!-itemId oder null (dann eigener Artikel ohne Bild)
  function bringItemId(name) {
    if (!window.BRING_CATALOG) return null;
    const full = String(name || "").replace(/(AOP|IGP|Bio)/g, "").replace(/\s+(in|am|an|mit|aus|zum|ohne|für|nach)\s+.*$/i, "").trim();
    let id = bringLookup(full);
    if (id) return id;
    const alt = full.split(/\s+(?:oder|und|&)\s+|\s*\/\s*/)[0].trim();
    if (alt && alt !== full && (id = bringItemId(alt))) return id;
    // mehrteilige Katalognamen («Getrocknete Tomaten») im Text
    const lower = full.toLowerCase();
    for (const key of Object.keys(bringIndex)) if (key.includes(" ") && lower.includes(key)) return bringIndex[key];
    const words = full.split(/[\s-]+/).filter(Boolean);
    for (let i = words.length - 1; i >= 0; i--) if ((id = bringLookup(words[i]))) return id;
    // Kompositum: das Grundwort steht hinten (Blattspinat -> Spinat, Weissweinessig -> Essig)
    const last = words[words.length - 1].toLowerCase();
    if (/öl$/.test(last)) return bringLookup("Öl");
    if (/bouillon/.test(last)) return bringLookup("Bouillon");
    for (const [re, target] of BRING_PREFIX) if (re.test(last)) return bringLookup(target);
    let best = null;
    for (const key of Object.keys(bringIndex)) {
      if (key.length >= 4 && !key.includes(" ") && last.endsWith(key) && last.length - key.length >= 3 && (!best || key.length > best.length)) best = key;
    }
    if (best) return bringIndex[best];
    // Bestimmungswort vorne (Spinatblätter -> Spinat, Lauchstängel -> Lauch)
    for (const key of Object.keys(bringIndex)) {
      if (key.length >= 4 && !key.includes(" ") && last.startsWith(key) && last.length - key.length >= 3 && (!best || key.length > best.length)) best = key;
    }
    return best ? bringIndex[best] : null;
  }

  // Einkaufsliste -> Bring!-Einträge. Ziel ist der Bring!-Katalogname (mit Bild); Bring! kennt pro Artikel nur
  // einen Eintrag, also alles mit demselben Ziel zusammenfassen: Mengen gleicher Einheit addieren,
  // genaue Sorte und Zusatzinfos dahinter: «Kartoffeln: 3.3 kg, Fest kochende Kartoffeln, Schweizer».
  const UNIT_BASE = { g: ["g", 1], kg: ["g", 1000], ml: ["dl", 0.01], dl: ["dl", 1], l: ["dl", 10] };
  function bringPayload(list) {
    const groups = new Map();
    for (const it of list) {
      const target = it.bring || it.name;
      const k = target.toLowerCase();
      const g = groups.get(k) || { name: target, amounts: new Map(), extra: new Set(), from: new Set() };
      (it.from || []).forEach(f => g.from.add(f));
      const [base, f] = UNIT_BASE[(it.unit || "").toLowerCase()] || [it.unit || "", 1];
      g.amounts.set(base, (g.amounts.get(base) || 0) + it.amount * f);
      if (it.bring && bringLookup(it.name) !== it.bring) g.extra.add(it.name); // Sorte nur, wenn nicht schon der Katalogname
      it.spec.split(", ").slice(1).forEach(x => g.extra.add(x));
      groups.set(k, g);
    }
    return [...groups.values()].map(g => {
      const parts = [...g.amounts].map(([u, a]) =>
        u === "g" && a >= 1000 ? formatAmount(a / 1000, "kg") : u === "dl" && a >= 10 ? formatAmount(a / 10, "l") : formatAmount(a, u));
      return { name: g.name, spec: [parts.join(" + "), ...g.extra].filter(Boolean).join(", "), from: [...g.from] };
    });
  }

  function computeShopping() {
    const stapleKeywords = [];
    state.staples.forEach(s => {
      if (s.in_stock !== false) (s.keywords || [s.name.toLowerCase()]).forEach(k => stapleKeywords.push(k.toLowerCase()));
    });
    const onBring = state.bringItems.map(n => n.toLowerCase().trim());
    const agg = {};

    function add(rawName, unit, amount, cat, from) {
      const { name, note, skip } = cleanIngredient(rawName);
      if (!name || skip || !(amount > 0)) return;
      const key = `${name.toLowerCase()}__${(unit || "").toLowerCase()}`;
      if (agg[key]) {
        agg[key].amount += amount;
        if (note) agg[key].notes.add(note);
        if (from) agg[key].from.add(from);
        return;
      }
      const lower = name.toLowerCase();
      const bring = bringItemId(name); // Bring!-Katalogartikel (mit Bild) oder null
      const bringLower = bring ? [bring.toLowerCase(), String((window.BRING_CATALOG || {})[bring] || "").toLowerCase()] : [];
      agg[key] = {
        name,
        bring,
        unit: unit || "",
        amount,
        notes: new Set(note ? [note] : []),
        from: new Set(from ? [from] : []),
        cat: cat || "Sonstiges",
        isStaple: stapleKeywords.some(k => lower.includes(k)),
        isOnBring: onBring.some(b => b === lower || b.includes(lower) || lower.includes(b) || bringLower.includes(b))
      };
    }

    state.plan.forEach(day => {
      const portions = portionsFor(day);
      if (portions === 0 || day.is_leftovers || day.empty) return; // Resteessen / noch offen: nichts einkaufen
      const scale = portions / (day.servings || DEFAULT_SERVINGS);

      // 1. Gemeinsame Basis für alle + Reste
      (day.ingredients || []).forEach(ing => {
        add(ing.name.trim(), (ing.unit || "").trim(), parseFloat(ing.amount || "1") * scale, ing.bring_cat, day.title);
      });

      // 2. Individuelle Proteine je anwesendem Esser
      const present = state.members.filter(m => day.eaters.includes(m.id));
      const meat = present.filter(m => m.diet === "fleisch").length;
      const vegi = present.filter(m => m.diet === "vegi").length;
      const vegan = present.filter(m => m.diet === "vegan").length;
      if (meat > 0 && day.diet !== "fleisch" && !day.no_addons) add("Schweizer Speckwürfeli / Rindssteak", "g", 150 * meat, "Fleisch & Fisch", day.title);
      const swap = day.vegi_swap; // z.B. Vegi-Nuggets statt Grillkäse
      if (vegi > 0 && swap) add(swap.name, swap.unit, swap.amount * vegi, swap.bring_cat, day.title);
      else if (vegi > 0 && !day.no_addons) add("Schweizer Grillkäse / Halloumi", "g", 100 * vegi, "Milch & Käse", day.title);
      if (vegan > 0) add("Tofu / veganer Reibkäse", "Portion", vegan, "Milch & Käse", day.title);

      // 3. Frische Beilage
      add("Nüsslisalat / Saisonsalat", "g", 50 * portions, "Obst & Gemüse", day.title);
    });

    // Leerer Grundvorrat kommt auf die Liste, auch wenn ihn diese Woche kein Rezept braucht
    state.staples.forEach(st => {
      if (st.in_stock !== false) return;
      const { name } = cleanIngredient(st.name);
      if (!Object.values(agg).some(it => it.name.toLowerCase() === name.toLowerCase())) add(st.name, "", 1, "Grundvorrat", "Grundvorrat");
    });

    state.shopping = Object.values(agg).map(({ notes, from, ...it }) => {
      const info = [...new Set([...notes].join(", ").split(", "))].filter(Boolean).join(", ");
      return { ...it, from: [...from], spec: [formatAmount(it.amount, it.unit), info].filter(Boolean).join(", ") };
    });
  }

  const toBuyItems = () => state.shopping.filter(it => !it.isStaple && !it.isOnBring);
  const listLine = it => `${it.name} (${it.spec})`;

  // ---------------------------------------------------------------------------
  // Rendering: Plan
  // ---------------------------------------------------------------------------
  function renderHeader() {
    const now = new Date();
    const kwNow = isoWeek(now);
    const kwNext = isoWeek(plusWeek());
    $("weekLabel").textContent = viewNext ? `KW ${kwNext} · nächste Woche` : `KW ${kwNow} · ${MONTHS[now.getMonth()]}`;
    $("appbar").classList.toggle("nextwk", viewNext);
    $("secTitle").textContent = viewNext ? `Nächste Woche` : "Wochenplan";
    const chip = $("weekChip");
    chip.hidden = !canPlanNext();
    chip.textContent = viewNext ? `← KW ${kwNow}` : `KW ${kwNext} →`;
    chip.setAttribute("aria-label", viewNext ? `Zurück zu dieser Woche (KW ${kwNow})` : `Nächste Woche planen (KW ${kwNext})`);
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
    const diff = bringDiff();
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
    $("shopSummary").textContent = `${viewNext ? `Nächste Woche (KW ${isoWeek(plusWeek())}) · ` : ""}${state.shopping.length} Zutaten · antippen = auf/von Bring!`;
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
        ${byAisle[cat].map(it => `<button type="button" class="item tap-item${it.isOnBring ? " on" : ""}" data-shop="${esc(it.name)}" aria-pressed="${it.isOnBring}"><span>${esc(it.name)}</span><span class="amt">${esc(it.spec)}</span></button>`).join("")}
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
    // ISO-Jahr (Donnerstag der Woche), damit KW 1 am Jahreswechsel stimmt
    const thu = new Date(date);
    thu.setDate(thu.getDate() + 3 - ((thu.getDay() + 6) % 7));
    return `${thu.getFullYear()}-W${String(isoWeek(date)).padStart(2, "0")}`;
  }
  function plusWeek(date = new Date()) {
    const d = new Date(date);
    d.setDate(d.getDate() + 7);
    return d;
  }
  const nextWeekKey = () => weekKey(plusWeek());
  const canPlanNext = () => todayIndex() >= 3; // ab Donnerstag
  const shownWeek = () => (viewNext ? nextWeekKey() : weekKey());

  // Noch nicht geplanter Tag der nächsten Woche: kauft nichts, Gericht antippen = wählen
  function emptyDay(idx) {
    return { id: null, title: "noch offen", empty: true, day: DAYS[idx], ingredients: [], eaters: state.members.map(m => m.id), leftover_buffer: DEFAULT_BUFFER, extra_guests: 0 };
  }
  const isOpenWeek = plan => !Array.isArray(plan) || plan.every(d => d && d.empty);
  function nextPlan() {
    if (nextDoc && nextDoc.week === nextWeekKey() && Array.isArray(nextDoc.plan) && nextDoc.plan.length === 7) return normalizeWeek(nextDoc.plan);
    return DAYS.map((_, i) => emptyDay(i));
  }
  function setCurrentPlan(plan) {
    if (viewNext) curPlan = plan;
    else state.plan = plan;
    save(KEYS.plan, plan);
  }

  // Woche wechseln: nur Inhalt und Beschriftung ändern sich, das Raster bleibt stehen
  function setWeekView(next) {
    next = !!next && canPlanNext();
    if (next === viewNext) return;
    if (next) {
      curPlan = state.plan;
      viewNext = true;
      state.plan = nextPlan();
    } else {
      viewNext = false;
      state.plan = curPlan || state.plan;
      curPlan = null;
    }
    openIdx = -1;
    renderHeader();
    refresh();
    fitDensity();
    markWahl();
    const days = $("days");
    if (days.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      days.animate([{ transform: `translateX(${next ? 28 : -28}px)`, opacity: 0.25 }, { transform: "none", opacity: 1 }], { duration: 280, easing: "cubic-bezier(.3,0,.1,1)" });
    }
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
  // quick = Schnelles/Reste (Pizza, Nuggets, Gnocchi …): eigener Topf, damit sie das Saison-Memory nicht fluten
  function backupRecipe(group, excludeIds, quick = false) {
    const all = allRecipes().filter(r => !excludeIds.includes(String(r.id)) && !!r.quick === quick);
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
  const QUICK_SLOTS = 2; // pro Woche 2 schnelle Sachen / Resteessen im Memory
  function pickCandidates() {
    const ids = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      const quick = i >= GRID_SIZE - QUICK_SLOTS;
      const r = backupRecipe(i % 2 === 0 ? "vegi" : "fleisch", ids, quick) || backupRecipe(i % 2 === 0 ? "vegi" : "fleisch", ids, !quick);
      if (!r) break;
      ids.push(String(r.id));
    }
    return ids;
  }

  const voteKey = week => `${VOTE_KEY}_${week}`;
  function loadVote() {
    const week = shownWeek();
    const saved = load(voteKey(week), null);
    if (saved && saved.week === week && Array.isArray(saved.candidates)) {
      saved.candidates = saved.candidates.filter(id => recipeById(id));
      return saved;
    }
    return { week, candidates: pickCandidates(), votes: {} };
  }

  let vote = null;
  const saveVote = () => save(voteKey(vote.week), vote);

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
    $("voteSubtitle").textContent = `KW ${+vote.week.split("W")[1]}${viewNext ? " (nächste Woche)" : ""} · ${GRID_SIZE} Saison-Gerichte, die Top ${PLAN_SIZE} kommen in den Plan`;
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
          <span class="vm">${r.is_leftovers ? "♻️ Reste" : r.quick ? "⚡ schnell" : DIET_LABEL[r.diet] || "Vegi"} · ${r.prep_time_min || 30} Min.${r.source_url ? ` · <a href="${esc(r.source_url)}" target="_blank" rel="noopener">🌐</a>` : ""}</span>
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

  // Kalender-Symbol: ab Donnerstag geht es zur nächsten Woche, solange dort noch nichts gewählt ist
  function openVoteFor() {
    if (canPlanNext() && !viewNext && !wahlDone(nextWeekKey())) setWeekView(true);
    openVote();
  }
  $("openVoteBtn").onclick = openVoteFor;

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
      const old = recipeById(id);
      const r = backupRecipe(dietGroup(old), vote.candidates, !!(old && old.quick));
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
    Object.entries(days).forEach(([id, day]) => { next[day] = makeDay(recipeById(id), day, state.plan[day]); countDish(id); });
    state.plan = next;
    savePlan();
    refresh();
    save(`bringfrisch_wahl_${vote.week}`, true);
    markWahl();
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
    countDish(recipe.id);
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

  // ---------------------------------------------------------------------------
  // Grundvorrat wie in Bring!: gleiche Abteilungen und Artikel (kleine Pillen).
  // Antippen = auf Bring! (rot), nochmals antippen = wieder weg (nur was der Bot selbst gesetzt hat).
  // ---------------------------------------------------------------------------
  function stapleTarget(st) {
    const name = cleanIngredient(st.name).name;
    return bringItemId(name) || name;
  }
  function onBringNow(name) {
    return state.bringItems.some(n => n.toLowerCase() === String(name).toLowerCase());
  }

  function renderStaples() {
    const order = window.BRING_SECTION_ORDER || [];
    const groups = {};
    state.staples.forEach((st, idx) => {
      const target = stapleTarget(st);
      const known = !!(window.BRING_CATALOG || {})[target];
      const sec = (known && (window.BRING_SECTIONS || {})[target]) || "Eigene Artikel";
      (groups[sec] = groups[sec] || []).push({ st, idx, target, known });
    });
    const rank = sec => (order.indexOf(sec) + 1) || 99;
    const secs = Object.keys(groups).sort((a, b) => rank(a) - rank(b));
    $("staplesList").innerHTML = secs.map(sec => `
      <section class="bsec">
        <h3>${esc(sec)}</h3>
        <div class="btiles">
          ${groups[sec].map(({ st, idx, target, known }) => {
            const red = connected() ? onBringNow(target) : st.in_stock === false;
            const label = known ? window.BRING_CATALOG[target] : target;
            const sub = label.toLowerCase() !== cleanIngredient(st.name).name.toLowerCase() ? st.name : "";
            return `<button type="button" class="btile${red ? " on" : ""}" data-staple="${idx}" aria-pressed="${red}" title="${esc(st.name)}">
              <span class="bname">${esc(label)}</span>
            </button>`;
          }).join("")}
        </div>
      </section>`).join("");
    $("staplesHint").textContent = connected()
      ? "Antippen = auf eure Bring!-Liste. Nochmals antippen = wieder weg."
      : "Antippen = «leer», kommt beim nächsten «Bring! füllen» mit.";
  }

  $("openStaplesBtn").onclick = () => {
    if (!$("bringNames").children.length) {
      $("bringNames").innerHTML = Object.values(window.BRING_CATALOG || {}).sort().map(n => `<option value="${esc(n)}">`).join("");
    }
    renderStaples();
    $("staplesDialog").showModal();
    if (connected()) api("/bring/list").then(d => { setBringList(d); renderStaples(); refresh(); }).catch(() => {});
  };

  // Einen Artikel auf Bring! setzen oder wieder wegnehmen – jederzeit, auch nach «Bring! füllen».
  // Wegnehmen nur, was der Bot selbst gesetzt hat. Rückgabe: "on", "off", "foreign" oder null (Fehler).
  async function toggleOnBring(target, spec) {
    try {
      let result;
      if (onBringNow(target)) {
        const r = await api("/bring/remove", { method: "POST", body: { names: [target] } });
        if (r.notMine && r.notMine.length) {
          toast(`${target} hat jemand anderes auf Bring! gesetzt – dort abhaken`);
          result = "foreign";
        } else {
          toast(`${target} von Bring! genommen`);
          result = "off";
        }
      } else {
        await api("/bring/sync", { method: "POST", body: { items: [{ name: target, spec: spec || "" }] } });
        toast(`${target} auf Bring! ✓`);
        result = "on";
      }
      setBringList(await api("/bring/list"));
      return result;
    } catch (err) {
      toast(`Bring!: ${err.message}`);
      return null;
    }
  }

  // Passender Grundvorrat-Eintrag zu einer Zutat (z.B. «Olivenöl» -> Olivenöl extra vergine)
  function stapleFor(name) {
    const lower = name.toLowerCase();
    return state.staples.find(st => (st.keywords || [st.name.toLowerCase()]).some(k => lower.includes(k.toLowerCase())));
  }

  $("shopList").addEventListener("click", async e => {
    const b = e.target.closest("[data-shop]");
    if (!b || b.disabled) return;
    const it = state.shopping.find(x => x.name === b.dataset.shop);
    if (!it) return;
    const st = it.isStaple || stapleFor(it.name) ? stapleFor(it.name) : null;
    if (!connected()) {
      // ohne Server: Grundvorrat als «leer» markieren, kommt beim nächsten Teilen/Kopieren mit
      if (st) { st.in_stock = st.in_stock === false; saveStaples(); refresh(); }
      else toast("Ohne WG-Server: «Bring! füllen» → Teilen/Kopieren");
      return;
    }
    b.disabled = true;
    const [payload] = bringPayload([it]);
    const r = await toggleOnBring(payload.name, payload.spec);
    if (st && r === "on") { st.in_stock = false; st.sent = true; saveStaples(); }
    if (st && r === "off") { st.in_stock = true; st.sent = false; saveStaples(); }
    refresh();
  });

  $("staplesList").addEventListener("click", async e => {
    const b = e.target.closest("[data-staple]");
    if (!b || b.disabled) return;
    const st = state.staples[+b.dataset.staple];
    const target = stapleTarget(st);
    if (!connected()) {
      st.in_stock = st.in_stock === false;
      saveStaples();
      renderStaples();
      return refresh();
    }
    b.disabled = true;
    const spec = cleanIngredient(st.name).name.toLowerCase() !== target.toLowerCase() ? st.name : "";
    const r = await toggleOnBring(target, spec);
    if (r === "on") { st.in_stock = false; st.sent = true; }
    if (r === "off") { st.in_stock = true; st.sent = false; }
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
    [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => { d.eaters = d.eaters.filter(x => x !== id); }));
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
    [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => d.eaters.push(id)));
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
  async function pushPlanNow() {
    clearTimeout(planPushTimer);
    const r = await api("/plan", {
      method: "PUT",
      body: { week: weekKey(), plan: currentPlan(), members: state.members, dinnerTime: load(DINNER_KEY, "18:30") }
    });
    save(PLAN_UPDATED_KEY, r.updated);
  }
  let nextPushTimer = null;
  async function pushNextNow() {
    clearTimeout(nextPushTimer);
    nextPushTimer = null;
    if (!nextDoc) return;
    const r = await api(`/plan/${nextDoc.week}`, {
      method: "PUT",
      body: { plan: nextDoc.plan, members: state.members, dinnerTime: load(DINNER_KEY, "18:30") }
    });
    nextDoc.updated = r.updated;
    save(NEXT_KEY, nextDoc);
  }
  function scheduleNextPush() {
    if (!connected()) return;
    clearTimeout(nextPushTimer);
    nextPushTimer = setTimeout(() => pushNextNow().catch(e => setSyncStatus(e.message, false)), 1500);
  }
  function schedulePlanPush() {
    if (!connected()) return;
    clearTimeout(planPushTimer);
    planPushTimer = setTimeout(() => pushPlanNow().catch(e => setSyncStatus(e.message, false)), 1500);
  }

  // Herunterziehen = jetzt synchronisieren: meine Änderungen hoch, dann den Stand der anderen holen
  let syncing = false;
  async function syncNow() {
    if (!connected()) return toast("Nicht verbunden – im Tab WG den PIN eingeben");
    if (syncing) return;
    syncing = true;
    try {
      if (planPushTimer) await pushPlanNow();
      if (nextPushTimer) await pushNextNow();
      if (vorratTimer) {
        clearTimeout(vorratTimer);
        vorratTimer = null;
        const r = await api("/vorrat", { method: "PUT", body: { staples: state.staples } });
        save(VORRAT_UPDATED_KEY, r.updated);
      }
      await pullShared();
      if ($("voteDialog").open) await pullVote();
      const okSync = $("syncStatus").textContent.startsWith("Verbunden");
      const ready = bringDiff().missing.length;
      if (okSync) setChip(ready ? "ready" : "quiet");
      toast(okSync ? `Synchronisiert ✓${ready ? ` – ${ready} Artikel bereit für Bring!` : ""}` : $("syncStatus").textContent);
    } catch (e) {
      toast(e.message);
    } finally {
      syncing = false;
    }
  }

  // Herunterziehen = aktualisieren: Formwechsel-Anzeige (Android) bzw. Glas-Kreis (iPhone)
  async function runPullSync() {
    const ptr = $("ptr");
    ptr.classList.add("spin");
    ptr.style.transform = "translateY(24px) scale(1)";
    ptr.style.opacity = "1";
    try {
      await syncNow();
    } finally {
      ptr.classList.add("done");
      setTimeout(() => { ptr.className = "ptr g"; ptr.style.cssText = ""; }, 350);
    }
  }
  (function pullToRefresh() {
    const ptr = $("ptr");
    let startY = null, dist = 0;
    const blocked = () => document.querySelector("dialog[open]") || $("msheet").classList.contains("show") || !$("wpop").hidden;
    window.addEventListener("touchstart", e => {
      if (scroller.scrollTop > 0 || blocked() || e.touches.length !== 1 || syncing) return;
      startY = e.touches[0].clientY;
      dist = 0;
    }, { passive: true });
    window.addEventListener("touchmove", e => {
      if (startY === null) return;
      dist = Math.max(0, e.touches[0].clientY - startY);
      if (dist > 8 && tapStart) tapStart.moved = true;
      ptr.style.transform = `translateY(${Math.min(dist, 120) * 0.8 - 48}px) scale(${Math.min(1, 0.6 + dist / 200)}) rotate(${dist * 3}deg)`;
      ptr.style.opacity = String(Math.min(1, dist / 60));
    }, { passive: true });
    window.addEventListener("touchend", () => {
      if (startY === null) return;
      startY = null;
      if (dist > 70) runPullSync();
      else { ptr.style.transition = "transform .2s, opacity .2s"; ptr.style.transform = ""; ptr.style.opacity = "0"; setTimeout(() => { ptr.style.transition = ""; }, 220); }
      dist = 0;
    });
  })();

  // Neuerer Plan von einem anderen Handy? Dann übernehmen.
  async function pullShared() {
    if (!connected()) return;
    try {
      const [remote, bring, vorrat, remoteNext] = await Promise.all([
        api("/plan"), api("/bring/list"), api("/vorrat"),
        canPlanNext() ? api(`/plan/${nextWeekKey()}`).catch(() => null) : null
      ]);
      // Grundvorrat: neuerer Stand gewinnt; hat der Server noch keinen, bekommt er unseren
      if (Array.isArray(vorrat.staples) && vorrat.updated > load(VORRAT_UPDATED_KEY, 0)) {
        state.staples = vorrat.staples;
        save(KEYS.staples, state.staples);
        save(VORRAT_UPDATED_KEY, vorrat.updated);
      } else if (!Array.isArray(vorrat.staples) || vorrat.updated < load(VORRAT_UPDATED_KEY, 0)) {
        saveStaples();
      }
      setBringList(bring);
      const localUpdated = load(PLAN_UPDATED_KEY, 0);
      // Neue Woche, und ein anderes Handy hat sie schon geplant: dieser Plan wird zur laufenden Woche
      const promoted = remote.week && remote.week < weekKey() ? await api(`/plan/${weekKey()}`).catch(() => null) : null;
      if (promoted && !isOpenWeek(promoted.plan) && promoted.updated > localUpdated) {
        setCurrentPlan(normalizeWeek(promoted.plan));
        save(PLAN_UPDATED_KEY, Date.now());
        await pushPlanNow();
        toast("Neue Woche: euer geplanter Plan gilt jetzt");
      } else if (remote.plan && remote.updated > localUpdated) {
        if (Array.isArray(remote.members) && remote.members.length) state.members = remote.members;
        setCurrentPlan(normalizeWeek(remote.plan));
        save(KEYS.members, state.members);
        save(PLAN_UPDATED_KEY, remote.updated);
        renderMembers();
        toast("Wochenplan der WG geladen");
      }
      // Nächste Woche: neuerer Stand gewinnt
      const localNext = nextDoc && nextDoc.week === nextWeekKey() ? nextDoc.updated || 0 : 0;
      if (remoteNext && Array.isArray(remoteNext.plan) && remoteNext.updated > localNext) {
        nextDoc = { week: nextWeekKey(), plan: normalizeWeek(remoteNext.plan), updated: remoteNext.updated };
        save(NEXT_KEY, nextDoc);
        if (viewNext) state.plan = nextDoc.plan;
      } else if (remoteNext && localNext > (remoteNext.updated || 0)) {
        scheduleNextPush();
      }
      renderHeader();
      markWahl();
      refresh();
      setSyncStatus("Verbunden ✓", true);
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  // Bring!-Stand übernehmen. Vorrat, den der Bot gesetzt hat und der jetzt weg ist, wurde gekauft -> wieder «da».
  function setBringList(data) {
    state.bringItems = (data && data.items) || [];
    state.bringMine = (data && data.mine) || [];
    state.bringSpecs = Object.fromEntries(((data && data.details) || []).map(d => [d.name.toLowerCase(), d.spec || ""]));
    state.sentSpecs = Object.fromEntries(((data && data.mineDetails) || []).map(d => [d.name.toLowerCase(), d.spec || ""]));
    const on = new Set(state.bringItems.map(n => n.toLowerCase()));
    let changed = false;
    state.staples.forEach(st => {
      if (st.sent && !on.has(stapleTarget(st).toLowerCase())) {
        st.sent = false;
        st.in_stock = true;
        changed = true;
      }
    });
    if (changed) saveStaples();
  }

  // Was muss auf Bring!? Vergleich Plan <-> Liste:
  //  missing  = noch nicht drauf -> einfach senden
  //  changed  = vom Bot, aber der Plan braucht jetzt mehr/anders (z.B. zweites Rezept mit Rahm) -> nachfragen, vorausgewählt
  //  foreign  = hat jemand anderes eingetragen -> nachfragen, nicht vorausgewählt (Menge wird ergänzt)
  function bringDiff() {
    const wanted = bringPayload(state.shopping.filter(it => !it.isStaple));
    const res = { missing: [], changed: [], foreign: [] };
    for (const d of wanted) {
      const k = d.name.toLowerCase();
      if (!onBringNow(d.name)) res.missing.push(d);
      else if (k in state.sentSpecs) { if (state.sentSpecs[k] !== d.spec) res.changed.push({ ...d, now: state.bringSpecs[k] || "" }); }
      else res.foreign.push({ ...d, now: state.bringSpecs[k] || "" });
    }
    return res;
  }

  function askReview(diff) {
    return new Promise(resolve => {
      const rows = [
        ...diff.changed.map(d => ({ d, checked: true, kind: "changed" })),
        ...diff.foreign.map(d => ({ d, checked: false, kind: "foreign" })),
      ];
      $("dupText").textContent = (diff.missing.length ? `${diff.missing.length} neue Artikel werden hinzugefügt. ` : "") +
        "Diese stehen schon auf Bring!. Nochmals hinzufügen?";
      $("dupList").innerHTML = rows.map((r, i) => `
        <label class="duprow">
          <input type="checkbox" data-dup="${i}"${r.checked ? " checked" : ""}>
          <span><b>${esc(r.d.name)}</b>
            <small>auf Bring!: ${esc(r.d.now || "–")}${r.kind === "foreign" ? " (von jemand anderem)" : ""}</small>
            <small>Plan braucht: ${esc(r.d.spec)}${r.d.from.length ? ` · für ${esc(r.d.from.slice(0, 3).join(", "))}` : ""}</small>
          </span>
        </label>`).join("");
      const dlg = $("dupDialog");
      const done = v => { dlg.close(); resolve(v); };
      $("dupSendBtn").onclick = () => {
        const picked = [...$("dupList").querySelectorAll("[data-dup]")].filter(c => c.checked).map(c => rows[+c.dataset.dup]);
        // vom Bot: neue Gesamtmenge · fremd: Menge ergänzen, ihre Angabe bleibt stehen
        done(picked.map(r => ({ name: r.d.name, spec: r.kind === "foreign" && r.d.now ? `${r.d.now} + ${r.d.spec}` : r.d.spec })));
      };
      $("dupCancelBtn").onclick = () => done(null);
      dlg.showModal();
    });
  }

  async function undoBring({ remove, restore }) {
    try {
      for (let i = 0; i < remove.length; i += 40) {
        await api("/bring/remove", { method: "POST", body: { names: remove.slice(i, i + 40) } });
      }
      if (restore.length) await api("/bring/sync", { method: "POST", body: { items: restore } });
      setBringList(await api("/bring/list"));
      refresh();
      toast("Rückgängig gemacht – nichts eingefügt");
    } catch (e) {
      toast(`Bring!: ${e.message}`);
    }
  }

  async function syncToBring() {
    const btn = $("syncBtn");
    btn.disabled = true;
    try {
      setBringList(await api("/bring/list")); // aktueller Stand – vielleicht hat schon jemand gefüllt
      refresh();
      const diff = bringDiff();
      let extra = [];
      if (diff.changed.length || diff.foreign.length) {
        extra = await askReview(diff);
        if (extra === null) return;
      }
      const items = [...diff.missing, ...extra].map(({ name, spec }) => ({ name, spec }));
      if (!items.length) return toast("Alles schon auf Bring! ✓");
      // Für «Rückgängig»: neue Artikel wieder weg, bestehende auf die alte Menge zurück
      const undo = {
        remove: diff.missing.map(d => d.name),
        restore: extra.map(x => ({ name: x.name, spec: state.bringSpecs[x.name.toLowerCase()] || "" })),
      };
      let pushed = 0;
      for (let i = 0; i < items.length; i += 40) {
        const res = await api("/bring/sync", { method: "POST", body: { items: items.slice(i, i + 40) } });
        pushed += res.pushed || 0;
      }
      setBringList(await api("/bring/list"));
      refresh();
      setChip("done");
      const hidden = state.shopping.filter(it => it.isStaple).length;
      toast(`${pushed} Artikel in Bring! ✓${hidden ? ` · ${hidden} Grundvorrat ausgeblendet` : ""}`, { label: "Rückgängig", run: () => undoBring(undo) });
    } catch (e) {
      toast(`Bring!: ${e.message}`);
      openHandoff();
    } finally {
      renderCta();
    }
  }

  function renderSyncSettings() {
    $("syncPin").value = sync.pin || "";
    $("dinnerTime").value = load(DINNER_KEY, "18:30");
    setSyncStatus(connected() ? "Verbinde …" : "Nicht verbunden: WG-PIN unter «Mehr» eingeben. Bis dahin Bring! über Teilen/Kopieren.", false);
    if (connected()) loadBringLists(); else $("setMore").open = true;
  }

  $("syncForm").addEventListener("submit", async e => {
    e.preventDefault();
    sync = { url: sync.url || DEFAULT_SYNC_URL, pin: $("syncPin").value.trim() };
    save(SYNC_KEY, sync);
    if (!connected()) return setSyncStatus("WG-PIN eingeben", false);
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
      const cur = lists.find(l => l.uuid === active);
      $("bringListName").textContent = cur ? cur.name : "Liste wählen";
      field.hidden = false;
      hint.hidden = false;
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  $("bringListSelect").addEventListener("change", async e => {
    try {
      const { name } = await api("/bring/target", { method: "PUT", body: { uuid: e.target.value } });
      $("bringListName").textContent = name;
      setBringList(await api("/bring/list"));
      refresh();
      toast(`Bring!-Liste: ${name} ✓`);
    } catch (err) {
      toast(err.message);
      loadBringLists();
    }
  });

  $("syncNowBtn").onclick = () => (connected() ? runPullSync() : toast("Zuerst die WG-PIN eingeben"));

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
    if (name === "plan") fitDensity();
  }

  // ---------------------------------------------------------------------------
  // Plan-Ansicht (Redesign): Tag = Menü auf/zu · Gericht = wechseln · Kreise = mitessen · Zahl = +1
  // ---------------------------------------------------------------------------
  const CHEV = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>`;
  let openIdx = -1;

  function dayMeta(day) {
    if (day.empty) return "Antippen oder Wochenwahl";
    const kind = day.is_leftovers ? "Reste" : day.quick ? "schnell" : day.diet === "fleisch" ? "Fleisch" : day.diet === "vegan" ? "vegan" : "vegi";
    return `${kind} · ${day.prep_time_min || 30} Min.`;
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
    const many = state.members.length >= 5;
    const ings = dayIngredients(day);
    const b = day.leftover_buffer || 0;
    return `<div class="prow${idx === today ? " today" : ""}${idx === openIdx ? " open" : ""}${day.empty ? " unplanned" : ""}" data-i="${idx}">
      <div class="phead">
        <button type="button" class="pday" aria-expanded="${idx === openIdx}" aria-label="${DAYS[idx]}: ganzes Menü zeigen">${DAYS[idx].slice(0, 2)}</button>
        <div class="dish">
          <button type="button" class="t" data-pick="${idx}" aria-label="${DAYS[idx]}: ${esc(day.title)} – wechseln">${esc(day.title)}</button>
          <span class="meta">${esc(dayMeta(day))}</span>
        </div>
        <div class="who${many ? " many" : ""}">${state.members.map(m => {
          const on = day.eaters.includes(m.id);
          return `<button type="button" class="av${on ? "" : " off"}" data-day="${idx}" data-member="${esc(m.id)}" aria-pressed="${on}" aria-label="${esc(m.name)} isst am ${DAYS[idx]} ${on ? "mit" : "nicht mit"}">${esc(short[m.id])}</button>`;
        }).join("")}<span class="plus${b ? "" : " zero"}" aria-hidden="true">+${b}</span></div>
        <div class="tot">
          <button type="button" class="num" data-inc="${idx}" aria-label="${esc(totalLabel(day, idx))}">${portionsFor(day)}</button>
          <span class="dd">${CHEV}<select class="buf" data-buffer="${idx}" aria-label="Reste am ${DAYS[idx]}">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === b ? " selected" : ""}>+${n}</option>`).join("")}</select></span>
        </div>
      </div>
      <div class="more"><div><div class="inner">
        <ul class="ing">${ings.length ? ings.map(x => `<li>${x.amt ? `<b>${esc(x.amt)}</b> ` : ""}${esc(x.name)}</li>`).join("") : `<li class="none">${day.empty ? "Noch kein Menü – Gericht antippen oder Wochenwahl starten" : day.is_leftovers ? "Was im Kühlschrank ist – nichts einkaufen" : "Keine Zutaten hinterlegt"}</li>`}</ul>
        <div class="links">${day.source_url ? `<a href="${esc(day.source_url)}" target="_blank" rel="noopener">Zum Rezept ↗</a>` : ""}<button type="button" class="sw" data-pick="${idx}">Wechseln</button></div>
      </div></div></div>
    </div>`;
  }

  function renderDays() {
    const short = initialsMap();
    const today = viewNext ? -1 : todayIndex();
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
  let tapStart = null;
  function trackTaps(el, getScroll) {
    el.addEventListener("pointerdown", e => { tapStart = { x: e.clientX, y: e.clientY, st: getScroll(), moved: false }; });
    el.addEventListener("pointermove", e => { if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8) tapStart.moved = true; });
  }
  const wasScroll = getScroll => !!tapStart && (tapStart.moved || Math.abs(getScroll() - tapStart.st) > 2);
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
  });

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
  const COUNTS_KEY = "bringfrisch_dish_counts";
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
      return openCatalog(idx);
    }
    let recipe;
    if (btn.dataset.new) {
      recipe = importer.createCustomRecipe({ title: $("msearch").value.trim(), diet: "vegi", servings: DEFAULT_SERVINGS });
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

  // ---------------------------------------------------------------------------
  // Rahmen: Formen, Stil (iPhone/Android), Bring!-Chip, Wochenwahl-Pop-up, Navigation, Scrollbalken
  // ---------------------------------------------------------------------------
  // Ausdrucksstarke Formen: Keks (9 Wellen, «heute») und Blume (6 Blätter, Ladeanzeige)
  (function shapes() {
    const enc = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    const shape = (waves, amp) => {
      let d = "";
      for (let k = 0; k <= 200; k++) {
        const a = k / 200 * Math.PI * 2;
        const r = 50 - amp + amp * Math.cos(waves * a);
        d += (k ? "L" : "M") + (50 + r * Math.cos(a)).toFixed(2) + " " + (50 + r * Math.sin(a)).toFixed(2);
      }
      return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}Z"/></svg>`);
    };
    document.documentElement.style.setProperty("--cookie", shape(9, 4));
    document.documentElement.style.setProperty("--flower", shape(6, 9));
  })();

  const OS_KEY = "bf-os";
  function currentOs() { return document.documentElement.classList.contains("m3") ? "m3" : "glass"; }
  function setOs(v) {
    document.documentElement.classList.remove("m3", "glass");
    document.documentElement.classList.add(v);
    try { localStorage.setItem(OS_KEY, v); } catch (e) { /* ohne Speicher: nur für diese Sitzung */ }
    osLabels();
    fitDensity();
  }
  function osLabels() {
    const v = currentOs();
    $("menuOsLabel").textContent = v === "glass" ? "Android-Stil" : "iPhone-Stil";
    $("setOsBtn").textContent = v === "glass" ? "iPhone" : "Android";
  }
  osLabels();
  $("setOsBtn").onclick = () => setOs(currentOs() === "glass" ? "m3" : "glass");

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

  // Wochenwahl-Pop-up: beim Start, wenn für diese Woche noch nichts gewählt ist
  function wahlDone(week = shownWeek()) {
    if (load(`bringfrisch_wahl_${week}`, false)) return true;
    if (week === nextWeekKey() && nextDoc && nextDoc.week === week && Array.isArray(nextDoc.plan) && nextDoc.plan.every(d => !d.empty)) return true;
    const v = load(voteKey(week), null);
    const me = load(ME_KEY, null);
    return !!(v && v.week === week && me && v.votes && v.votes[me] && (v.votes[me].likes || []).length);
  }
  // Roter Punkt: Mo–Mi für diese Woche, ab Donnerstag für die nächste
  const wahlDue = () => (canPlanNext() ? !wahlDone(nextWeekKey()) : !wahlDone(weekKey()));
  function markWahl() { $("openVoteBtn").classList.toggle("due", wahlDue()); }
  function openWahlPop() {
    $("wpopText").textContent = canPlanNext()
      ? `Ab Donnerstag könnt ihr schon die nächste Woche planen. Für KW ${isoWeek(plusWeek())} ist noch nichts gewählt.`
      : `Für KW ${isoWeek(new Date())} ist noch nichts gewählt. Stellt den Plan in einer Minute zusammen – der Rest füllt sich von selbst.`;
    const pop = $("wpop");
    pop.hidden = false;
    pop.style.cssText = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { pop.classList.add("show"); $("wscrim").classList.add("show"); }));
    setTimeout(() => $("wgo").focus({ preventScroll: true }), 350);
  }
  // Pop-up fliegt in das Kalender-Symbol oben (FLIP)
  function dockWahlPop(then) {
    const pop = $("wpop");
    const btn = $("openVoteBtn");
    $("wscrim").classList.remove("show");
    const finish = () => { pop.classList.remove("show"); pop.hidden = true; markWahl(); if (then) then(); };
    const a = pop.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (!pop.animate || !a.width || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const anim = pop.animate([
      { transform: getComputedStyle(pop).transform, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0, borderRadius: "999px" }
    ], { duration: 520, easing: "cubic-bezier(.3,0,.1,1)" });
    anim.onfinish = () => {
      finish();
      if (btn.animate) btn.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.34,1.45,.5,1)" });
    };
  }
  $("wgo").onclick = () => dockWahlPop(openVoteFor);
  $("wlater").onclick = () => dockWahlPop();
  $("wscrim").onclick = () => dockWahlPop();
  $("wpop").addEventListener("keydown", e => { if (e.key === "Escape") dockWahlPop(); });

  // Navigation: Symbole animieren; «Einstellungen» öffnet das ⋮-Menü
  const navMenu = $("navMenu");
  function closeNavMenu() { navMenu.classList.remove("show"); $("moreBtn").setAttribute("aria-expanded", "false"); }
  document.querySelector(".bnav").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    b.classList.remove("anim");
    void b.offsetWidth;
    b.classList.add("anim");
    clearTimeout(b._anim);
    b._anim = setTimeout(() => b.classList.remove("anim"), 2300);
    if (b.id === "moreBtn") {
      e.stopPropagation();
      const open = !navMenu.classList.contains("show");
      navMenu.classList.toggle("show", open);
      b.setAttribute("aria-expanded", String(open));
      return;
    }
    closeNavMenu();
    showTab(b.dataset.tab);
  });
  document.addEventListener("click", e => { if (!navMenu.contains(e.target) && e.target.id !== "moreBtn" && !e.target.closest("#moreBtn")) closeNavMenu(); });
  $("menuSettings").onclick = () => { closeNavMenu(); showTab("wg"); };
  $("menuRefresh").onclick = () => { closeNavMenu(); runPullSync(); };
  $("menuVote").onclick = () => { closeNavMenu(); openVoteFor(); };

  // Woche wechseln: Chip in der Abschnittszeile oder seitlich über die Tage wischen
  $("weekChip").onclick = () => setWeekView(!viewNext);
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
  $("menuOs").onclick = () => { closeNavMenu(); setOs(currentOs() === "glass" ? "m3" : "glass"); };

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


  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  const fromLink = importPlanFromHash();
  if (!fromLink) state.plan = load(KEYS.plan, []);
  // Neue Woche: die schon geplante nächste Woche wird zur laufenden, sonst bleibt der Plan stehen
  const planWeek = load(PLAN_WEEK_KEY, null);
  const rolled = !fromLink && planWeek && planWeek < weekKey() && nextDoc && nextDoc.week === weekKey() && !isOpenWeek(nextDoc.plan);
  if (rolled) state.plan = nextDoc.plan;
  if (nextDoc && nextDoc.week <= weekKey()) {
    nextDoc = null;
    try { localStorage.removeItem(NEXT_KEY); } catch (e) { /* egal */ }
  }
  save(PLAN_WEEK_KEY, weekKey());
  // Alte Wochenwahlen aufräumen (je Woche gespeichert)
  try {
    Object.keys(localStorage).forEach(k => {
      const m = /^bringfrisch_(?:week_vote_|wahl_)(\d{4}-W\d{2})$/.exec(k);
      if (m && m[1] < weekKey()) localStorage.removeItem(k);
    });
    const oldVote = load(VOTE_KEY, null);
    if (oldVote && oldVote.week === weekKey() && !load(voteKey(oldVote.week), null)) save(voteKey(oldVote.week), oldVote);
    localStorage.removeItem(VOTE_KEY);
  } catch (e) { /* ohne Speicher */ }
  normalizePlan();
  if (fromLink || rolled) {
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
  fitDensity();
  markWahl();
  if (wahlDue()) setTimeout(openWahlPop, 500);
  if (fromLink) toast("Wochenplan aus Link übernommen");
  else pullShared();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service Worker:", err));
  }
})();
