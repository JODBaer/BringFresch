// BringFrisch – reine Regeln (Woche, Portionen, Zutaten, Einkaufsliste). Kein Bildschirm, kein Speicher, kein Netz.
// Dieselbe Datei läuft als <script> in der App (vor app.js) und als Import im WG-Server (worker/src/index.js) und in
// Node-Tests: sie legt alles unter BF_CORE ab. Nichts hier darf document, localStorage oder fetch benutzen.
(function (root) {
  "use strict";

  const DEFAULT_SERVINGS = 4;

  // ---------------------------------------------------------------------------
  // Woche: KW nach ISO (Montag–Sonntag, KW 1 enthält den ersten Donnerstag)
  // ---------------------------------------------------------------------------
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
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

  // Montag (UTC) einer Woche «2026-W46» – für Kalender und Server
  function mondayOf(weekKey) {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekKey || "");
    if (!m) return null;
    const year = +m[1], week = +m[2];
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
    return monday;
  }
  // Die Woche danach als «2026-W47» (Jahreswechsel inbegriffen)
  function weekAfter(weekKey) {
    const monday = mondayOf(weekKey);
    if (!monday) return null;
    const thu = new Date(monday);
    thu.setUTCDate(monday.getUTCDate() + 7 + 3);
    const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
    const week = Math.floor((thu - jan1) / 86400000 / 7) + 1;
    return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------------------
  // Portionen = Esser + Gäste + Reste-Puffer
  // ---------------------------------------------------------------------------
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

  // Wort-Abgleich (Grundvorrat): ganze Wörter statt Teilwörter. «Mehl» passt auf «Weissmehl»-Stichwort nur als Wort,
  // nie auf «Mehlig kochende Kartoffeln»; «Pfeffer» nie auf «Pfefferminze». Gleiche Ware in anderer Form zählt
  // (Knoblauch -> Knoblauchzehen, Zimt -> Zimtpulver, Lorbeer -> Lorbeerblätter). Was nach «mit/aus/in …» steht, zählt nicht
  // («Frischkäse mit Kräutern» ist kein Kraut). Bindestrich-Wörter zählen mit dem Grundwort hinten (Madras-Curry = Curry,
  // Chili-Öl = Öl). «A und B» braucht beides im Vorrat, «A oder B» / «A / B» eines. Im Zweifel lieber auf der Liste
  // (sichtbar) als still weggelassen.
  const WORD_FORM = /^(n|e|en|s|zehe|zehen|pulver|flocken|blatt|blätter|zweig|zweige|zweiglein)$/;
  const wordsOf = s => String(s || "").toLowerCase().replace(/\s+(in|am|an|mit|aus|zum|ohne|für|nach)\s+.*$/, "").split(/[^a-z0-9äöüàâçéèêëïîôûß-]+/).map(t => t.replace(/^.*-(?=[^-])/, "").replace(/-+$/, "")).filter(Boolean);
  function hasWord(name, key) {
    const k = wordsOf(key), w = wordsOf(name);
    if (!k.length) return false;
    const last = k.length - 1;
    for (let i = 0; i + k.length <= w.length; i++) {
      if (k.every((x, j) => w[i + j] === x || (j === last && w[i + j].startsWith(x) && WORD_FORM.test(w[i + j].slice(x.length))))) return true;
    }
    return false;
  }
  const inStaples = (name, keywords) => String(name).split(/\s+(?:und|&)\s+/i).every(part => keywords.some(k => hasWord(part, k)));

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
      for (const [id, n] of Object.entries(root.BRING_CATALOG || {})) {
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
    if (!root.BRING_CATALOG) return null;
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

  // Einkaufsliste der Woche aus Plan, Mitbewohnern, Grundvorrat und dem Stand auf Bring!
  // state = { plan, members, staples, bringItems } -> [{ name, bring, unit, amount, cat, isStaple, isOnBring, from, spec }]
  function shoppingList(state) {
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
      const bringLower = bring ? [bring.toLowerCase(), String((root.BRING_CATALOG || {})[bring] || "").toLowerCase()] : [];
      agg[key] = {
        name,
        bring,
        unit: unit || "",
        amount,
        notes: new Set(note ? [note] : []),
        from: new Set(from ? [from] : []),
        cat: cat || "Sonstiges",
        isStaple: inStaples(lower, stapleKeywords),
        // gleicher Name oder gleicher Bring!-Artikel – keine Teilwörter («Butter» deckt nicht «Butternuss-Kürbis»)
        isOnBring: onBring.some(b => b === lower || bringLower.includes(b))
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

    return Object.values(agg).map(({ notes, from, ...it }) => {
      const info = [...new Set([...notes].join(", ").split(", "))].filter(Boolean).join(", ");
      return { ...it, from: [...from], spec: [formatAmount(it.amount, it.unit), info].filter(Boolean).join(", ") };
    });
  }

  // ---------------------------------------------------------------------------
  // Rezeptwahl und Wochenwahl: was passt zu wem, was hat Saison, wer hat was gewählt, welches Gericht an welchem Tag
  // ---------------------------------------------------------------------------
  // Strengste Ernährung der Esser: ein Vegi am Tisch = vegi für alle
  function effectiveDiet(eaterIds, members) {
    const diets = (eaterIds || []).map(id => (members.find(m => m.id === id) || {}).diet);
    if (diets.includes("vegan")) return "vegan";
    if (diets.includes("vegi")) return "vegi";
    return "fleisch";
  }
  function fitsDiet(recipe, diet) {
    if (diet === "vegan") return recipe.diet === "vegan";
    if (diet === "vegi") return recipe.diet === "vegi" || recipe.diet === "vegan";
    return true;
  }
  const inSeason = (recipe, month) => !recipe.season_months || recipe.season_months.includes(month);
  const dietGroup = r => (r.diet === "fleisch" ? "fleisch" : "vegi");
  // Zufälliges Gericht: zuerst Saison und noch nicht gebraucht, dann noch nicht gebraucht, dann irgendeines
  function pickRecipe(all, diet, excludeIds, month) {
    const fitting = all.filter(r => fitsDiet(r, diet));
    const pool = fitting.length ? fitting : all;
    const tiers = [
      pool.filter(r => inSeason(r, month) && !excludeIds.includes(r.id)),
      pool.filter(r => !excludeIds.includes(r.id)),
      pool
    ];
    const tier = tiers.find(t => t.length > 0) || [];
    return tier[Math.floor(Math.random() * tier.length)];
  }
  // Ein Gericht für die Wochenwahl: Saison + Gruppe (vegi/fleisch), sonst Saison, sonst Gruppe, sonst irgendeines
  function backupRecipe(all, group, excludeIds, quick, month) {
    const free = all.filter(r => !excludeIds.includes(String(r.id)) && !!r.quick === !!quick);
    const tiers = [
      free.filter(r => inSeason(r, month) && dietGroup(r) === group),
      free.filter(r => inSeason(r, month)),
      free.filter(r => dietGroup(r) === group),
      free
    ];
    const tier = tiers.find(t => t.length) || [];
    return tier[Math.floor(Math.random() * tier.length)];
  }
  // Die Gerichte der Wochenwahl: abwechselnd vegi / Fleisch, die letzten «quickSlots» sind Schnelles & Reste, nie doppelt
  function pickCandidates(all, month, gridSize, quickSlots) {
    const ids = [];
    for (let i = 0; i < gridSize; i++) {
      const quick = i >= gridSize - quickSlots;
      const group = i % 2 === 0 ? "vegi" : "fleisch";
      const r = backupRecipe(all, group, ids, quick, month) || backupRecipe(all, group, ids, !quick, month);
      if (!r) break;
      ids.push(String(r.id));
    }
    return ids;
  }
  // votes = { mitbewohnerId: { likes: [rezeptId], days: { rezeptId: tagIdx } } }
  const votersOf = (members, votes, recipeId) => members.filter(m => ((votes[m.id] || {}).likes || []).includes(recipeId));
  // Rangliste: meiste Stimmen zuerst, bei Gleichstand die Reihenfolge im Raster
  function ranking(candidates, members, votes) {
    return candidates
      .map((id, order) => ({ id, order, voters: votersOf(members, votes, id) }))
      .sort((a, b) => b.voters.length - a.voters.length || a.order - b.order);
  }
  // Gerichte auf Tage verteilen: 2 Punkte pro Fan, der an dem Tag isst, 3 Punkte für den Wunschtag -> rezeptId: tagIdx
  function assignDays(recipeIds, plan, members, votes) {
    const score = (id, day) => votersOf(members, votes, id).reduce((s, m) => {
      const v = votes[m.id];
      return s + (plan[day].eaters.includes(m.id) ? 2 : 0) + (v.days[id] === day ? 3 : 0);
    }, 0);
    const pairs = [];
    recipeIds.forEach(id => plan.forEach((_, day) => pairs.push({ id, day, s: score(id, day) })));
    pairs.sort((a, b) => b.s - a.s || a.day - b.day);
    const result = {};
    const usedDays = new Set();
    pairs.forEach(p => {
      if (result[p.id] === undefined && !usedDays.has(p.day)) {
        result[p.id] = p.day;
        usedDays.add(p.day);
      }
    });
    return result;
  }

  root.BF_CORE = {
    effectiveDiet, fitsDiet, inSeason, dietGroup, pickRecipe, backupRecipe, pickCandidates, votersOf, ranking, assignDays,
    DEFAULT_SERVINGS, isoWeek, weekKey, plusWeek, mondayOf, weekAfter, portionsFor,
    formatAmount, cleanIngredient, hasWord, inStaples, bringLookup, bringItemId, bringPayload, shoppingList
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
