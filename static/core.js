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

      // 3. Frische Beilage (nicht zu Müesli, Café complet, Fondue …: no_salad)
      if (!day.no_salad) add("Nüsslisalat / Saisonsalat", "g", 50 * portions, "Obst & Gemüse", day.title);
    });

    // Leerer oder knapper Grundvorrat kommt NICHT von selbst auf die Liste (Variante C): er steht beim Einkauf unter
    // «Aus dem Vorrat – wird knapp» und geht erst nach «Prüfen» (Gegenüberstellung) auf Bring!. Braucht ein Rezept
    // einen leeren Artikel, steht die Zutat ganz normal unter «Kaufen» (sie gilt dann nicht als Grundvorrat).

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
  // «Rezept suchen auf …» – wie die Suchmaschine im Browser, pro Handy umschaltbar (Standard Swissmilk).
  // Auf den Rezeptseiten ohne das Wort «Rezept» suchen (dort ist alles ein Rezept), bei Google mit.
  const SEARCH_SITES = {
    swissmilk: { name: "Swissmilk", url: q => `https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/?qt=${encodeURIComponent(q)}` },
    fooby: { name: "Fooby", url: q => `https://fooby.ch/de/suche.html?query=${encodeURIComponent(q)}` },
    google: { name: "Google", url: q => `https://www.google.com/search?q=${encodeURIComponent(q + " Rezept")}` }
  };
  const searchSite = key => SEARCH_SITES[key] ? key : "swissmilk";
  function searchHref(key, query) {
    const q = String(query || "").replace(/\brezepte?\b/gi, " ").replace(/\s+/g, " ").trim();
    return SEARCH_SITES[searchSite(key)].url(q);
  }
  // Gleiches Gericht = gleicher Titel (ohne Gross/Klein, Satzzeichen) oder gleicher Rezept-Link,
  // z.B. ein eigenes Rezept, das es im Katalog schon gibt
  const dishKey = r => String((r && r.title) || "").toLowerCase().replace(/[^a-z0-9äöüéèàç]+/g, " ").trim();
  const sameDish = (a, b) => String(a.id) === String(b.id) || (!!dishKey(a) && dishKey(a) === dishKey(b)) || (!!a.source_url && a.source_url === b.source_url);
  function backupRecipe(all, group, excludeIds, quick, month) {
    const taken = all.filter(r => excludeIds.includes(String(r.id)));
    const free = all.filter(r => !excludeIds.includes(String(r.id)) && !taken.some(t => sameDish(t, r)) && !!r.quick === !!quick);
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
  // Gespeicherte Wochenwahl reparieren: unbekannte und doppelte Gerichte weg (auch alte Listen vom WG-Server,
  // die noch aus der Zeit vor dem Mischen-Fix stammen), dann wieder auf gridSize auffüllen
  function cleanCandidates(all, ids, month, gridSize, quickSlots) {
    const out = [];
    (ids || []).forEach(id => {
      const r = all.find(x => String(x.id) === String(id));
      if (r && !out.some(o => sameDish(all.find(x => String(x.id) === o), r))) out.push(String(r.id));
    });
    const quickCount = () => out.filter(id => all.find(x => String(x.id) === id).quick).length;
    while (out.length < gridSize) {
      const quick = quickCount() < quickSlots;
      const vegi = out.filter(id => dietGroup(all.find(x => String(x.id) === id)) === "vegi").length;
      const group = vegi * 2 < out.length ? "vegi" : "fleisch";
      const r = backupRecipe(all, group, out, quick, month) || backupRecipe(all, group, out, !quick, month);
      if (!r) break;
      out.push(String(r.id));
    }
    return out;
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

  // ---------------------------------------------------------------------------
  // Grundvorrat mit Mengen (Variante C, docs/design/grundvorrat-varianten.html)
  // Ein Artikel im Vorrat-Dokument /vorrat: { id, name, keywords, in_stock, sent,           <- altes Format (weiter gültig)
  //   qty, unit: "Znacht"|"Stk", pack, size, since: "2026-11", weekly, empties: ["2026-W46"], booked: { w, n }, prev, checked }
  // Alte Handys kennen nur in_stock (false = leer). Darum gilt: in_stock === false -> leer (0), egal was qty sagt;
  // in_stock true, aber qty 0 (altes Handy hat «wieder da» gemeldet) -> eine volle Packung. Neue Handys halten
  // in_stock immer passend zu qty (in_stock = qty > 0), so verliert keiner etwas.
  // ---------------------------------------------------------------------------
  const KNAPP_MAX = 2;
  const vUnit = st => (st && st.unit === "Stk" ? "Stk" : "Znacht");
  const vPack = st => (st && st.pack > 0 ? Math.round(st.pack) : vUnit(st) === "Stk" ? 2 : 10);
  function vQty(st) {
    if (!st || st.in_stock === false) return 0;
    const q = Number(st.qty);
    return Number.isFinite(q) && q > 0 ? Math.round(q) : vPack(st);
  }
  // Knapp: 2 oder weniger – bei Artikeln mit nur 1–2 Stück pro Packung erst unter einer vollen Packung
  const knappAb = st => Math.min(KNAPP_MAX, Math.max(0, vPack(st) - 1));
  const isKnapp = st => vQty(st) <= knappAb(st);
  // Menge setzen: in_stock passt immer dazu; «leer» merkt sich die Woche (für «geht oft aus»)
  function setQty(st, n, week) {
    const q = Math.max(0, Math.round(Number(n) || 0));
    if (q === 0 && vQty(st) > 0) {
      st.prev = vQty(st);
      if (week) st.empties = [...new Set([...(st.empties || []), week])].sort().slice(-8);
    }
    st.qty = q;
    st.in_stock = q > 0;
    return st;
  }
  // In Bring! gekauft (abgehakt): eine Packung dazu, «im Vorrat seit» neu
  function boughtStaple(st, month) {
    setQty(st, vQty(st) + vPack(st));
    st.since = month;
    st.sent = false;
    return st;
  }
  // Wie viele gekochte Tage der Woche brauchen den Artikel? (offene Tage, Resteessen, niemand zuhause zählen nicht)
  function stapleUse(st, plan) {
    const keys = (st.keywords && st.keywords.length ? st.keywords : [String(st.name).toLowerCase()]).map(k => String(k).toLowerCase());
    return (plan || []).filter(day => day && !day.empty && !day.is_leftovers && portionsFor(day) > 0 &&
      (day.ingredients || []).some(ing => { const n = cleanIngredient(ing.name).name.toLowerCase(); return keys.some(k => hasWord(n, k)); })).length;
  }
  // «Woche gekocht»: abbuchen, was der Plan braucht (pro Woche nur einmal) – und wieder rückgängig
  const isBooked = (staples, week) => staples.some(st => st.booked && st.booked.w === week);
  function bookWeek(staples, plan, week) {
    let count = 0;
    staples.forEach(st => {
      if (st.booked && st.booked.w === week) return;
      const use = stapleUse(st, plan);
      if (!use) return;
      const n = Math.min(use, vQty(st));
      setQty(st, vQty(st) - n, week);
      st.booked = { w: week, n };
      count++;
    });
    return count;
  }
  function unbookWeek(staples, week) {
    let count = 0;
    staples.forEach(st => {
      if (!st.booked || st.booked.w !== week) return;
      const back = vQty(st) + st.booked.n;
      if (vQty(st) === 0 && st.empties) st.empties = st.empties.filter(w => w !== week);
      setQty(st, back);
      delete st.booked;
      count++;
    });
    return count;
  }
  // Wochen zwischen zwei KW-Schlüsseln («2026-W42» -> «2026-W46» = 4)
  function weeksBetween(a, b) {
    const ma = mondayOf(a), mb = mondayOf(b);
    return ma && mb ? Math.round((mb - ma) / (7 * 86400000)) : Infinity;
  }
  // Von der App erkannt: in wie vielen der letzten 4 Wochen leer gemeldet? (ab 3 = Vorschlag «geht oft aus»)
  function emptyWeeks(st, week) {
    return (st.empties || []).filter(w => { const d = weeksBetween(w, week); return d >= 0 && d < 4; }).length;
  }
  const oftLeer = (st, week) => !!st.weekly || emptyWeeks(st, week) >= 3;
  // Monate seit «2025-10» bis «2026-11»
  function monthsSince(ym, nowYm) {
    const a = /^(\d{4})-(\d{2})/.exec(ym || ""), b = /^(\d{4})-(\d{2})/.exec(nowYm || "");
    return a && b ? (+b[1] - +a[1]) * 12 + (+b[2] - +a[2]) : 0;
  }
  const isOld = (st, nowYm) => !!st.since && monthsSince(st.since, nowYm) > 12;
  // Anzeige: «2 × 1 l», «3 Stk», «~6 Znacht», «leer»
  function qtyText(st, n = vQty(st), long = false) {
    if (n === 0) return "leer";
    if (vUnit(st) === "Stk") return st.size ? (long ? `${n} Stück à ${st.size}` : `${n} × ${st.size}`) : `${n} Stk`;
    return long ? `reicht für ~${n} Znacht` : `~${n} Znacht`;
  }
  const packText = st => (vUnit(st) === "Stk" ? qtyText(st, vPack(st)) : `${vPack(st)} Znacht`);
  const qtyLevels = st => [["Leer", 0], ["Fast leer", 1], ["Halb", Math.max(2, Math.ceil(vPack(st) / 2))], ["Voll", vPack(st)]];

  // Hinzufügen: Vorschläge aus dem Bring!-Katalog («Olivenoel» -> Olivenöl, «Rüebli» -> Karotten), höchstens 5
  const normName = s => String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü").replace(/ß/g, "ss").replace(/[^a-z0-9äöüéèàç]/g, "");
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function bringSuggest(query, limit = 5) {
    const n = normName(query);
    if (!n) return [];
    const out = new Map();
    const syn = bringLookup(String(query).trim());
    if (syn) out.set((root.BRING_CATALOG || {})[syn] || syn, -1);
    for (const name of Object.values(root.BRING_CATALOG || {})) {
      const nn = normName(name);
      let sc = 9;
      if (nn === n) sc = 0; else if (nn.startsWith(n)) sc = 1; else if (nn.includes(n)) sc = 2;
      else if (n.length >= 4 && Math.abs(nn.length - n.length) <= 2 && lev(n, nn) <= (n.length > 7 ? 2 : 1)) sc = 3;
      if (sc < 9 && !(out.has(name) && out.get(name) <= sc)) out.set(name, sc);
    }
    return [...out.entries()].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, limit).map(e => e[0]);
  }

  // ---------------------------------------------------------------------------
  // Wochenplan: Gerichte zwischen zwei Tagen tauschen. Was zum Tag gehört (wer isst, Gäste, Reste-Puffer, Zeit)
  // bleibt am Tag, nur das Gericht wandert.
  // ---------------------------------------------------------------------------
  const DAY_KEYS = ["day", "eaters", "leftover_buffer", "extra_guests", "time", "time_by"];
  function dishOf(day) {
    const out = {};
    Object.keys(day || {}).forEach(k => { if (!DAY_KEYS.includes(k)) out[k] = day[k]; });
    return out;
  }
  function slotOf(day) {
    const out = {};
    DAY_KEYS.forEach(k => { if (day && day[k] !== undefined) out[k] = day[k]; });
    return out;
  }
  function swapDishes(plan, a, b) {
    if (a === b || !plan[a] || !plan[b]) return plan.slice();
    const out = plan.slice();
    out[a] = { ...dishOf(plan[b]), ...slotOf(plan[a]) };
    out[b] = { ...dishOf(plan[a]), ...slotOf(plan[b]) };
    return out;
  }

  // Einkauf nach Gericht: pro Gericht in der Reihenfolge des Plans, was nur dieses Gericht braucht; was mehrere
  // Gerichte brauchen (z.B. Salat, Extra-Fleisch), steht zusammen unter «Für mehrere Gerichte».
  function groupByDish(items, plan) {
    const titles = [];
    (plan || []).forEach(d => { if (d && d.title && !d.empty && !titles.includes(d.title)) titles.push(d.title); });
    const groups = new Map(titles.map(t => [t, []]));
    const several = [], other = [];
    items.forEach(it => {
      const from = [...new Set(it.from || [])];
      if (from.length > 1) several.push(it);
      else if (from.length === 1 && groups.has(from[0])) groups.get(from[0]).push(it);
      else other.push(it);
    });
    const byName = list => list.slice().sort((x, y) => x.name.localeCompare(y.name, "de"));
    const out = [...groups.entries()].filter(([, list]) => list.length).map(([title, list]) => ({ title, items: byName(list) }));
    if (several.length) out.push({ title: "Für mehrere Gerichte", several: true, items: byName(several) });
    if (other.length) out.push({ title: "Sonstiges", items: byName(other) });
    return out;
  }

  // Beliebtheit (pro WG): Stimmen der Wochenwahl, gesammelt pro Woche { "2026-W46": { rezeptId: Anzahl } }
  function popularity(weeks) {
    const out = {};
    Object.values(weeks || {}).forEach(w => Object.entries(w || {}).forEach(([id, n]) => { out[id] = (out[id] || 0) + (+n || 0); }));
    return out;
  }
  const byPopularity = (counts, month) => (a, b) =>
    ((counts[b.id] || 0) - (counts[a.id] || 0)) || (inSeason(b, month) - inSeason(a, month)) || a.title.localeCompare(b.title, "de");

  root.BF_CORE = {
    swapDishes, groupByDish, popularity, byPopularity,
    normName, bringSuggest, vUnit, vPack, vQty, knappAb, isKnapp, setQty, boughtStaple, stapleUse, isBooked, bookWeek, unbookWeek, weeksBetween,
    emptyWeeks, oftLeer, monthsSince, isOld, qtyText, packText, qtyLevels,
    effectiveDiet, fitsDiet, inSeason, dietGroup, pickRecipe, backupRecipe, pickCandidates, cleanCandidates, dishKey, sameDish, SEARCH_SITES, searchSite, searchHref, votersOf, ranking, assignDays,
    DEFAULT_SERVINGS, isoWeek, weekKey, plusWeek, mondayOf, weekAfter, portionsFor,
    formatAmount, cleanIngredient, hasWord, inStaples, bringLookup, bringItemId, bringPayload, shoppingList
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
