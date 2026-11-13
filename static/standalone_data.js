// BringFrisch: Vollständige Standalone-Daten für alle 12 Monate & Rezepte
// Läuft 100% autonom direkt im Browser auf jedem Smartphone (iOS / Android)

window.BRINGFRISCH_DATA = {
  version: "3.0.0",
  // Alle Rezeptmengen gelten für 4 Portionen (recipe.servings, Standard 4)
  pantry_staples: [
    { id: "salz", name: "Speisesalz / Jodsalz", category: "Gewürze", in_stock: true, keywords: ["salz", "jodsalz", "speisesalz"] },
    { id: "pfeffer", name: "Schwarzer Pfeffer", category: "Gewürze", in_stock: true, keywords: ["pfeffer"] },
    { id: "aromat", name: "Aromat (Knorr)", category: "Gewürze", in_stock: true, keywords: ["aromat"] },
    { id: "gemuesebouillon", name: "Gemüsebouillon", category: "Gewürze", in_stock: true, keywords: ["bouillon", "gemüsebouillon"] },
    { id: "paprikapulver", name: "Paprikapulver", category: "Gewürze", in_stock: true, keywords: ["paprika", "paprikapulver"] },
    { id: "currypulver", name: "Currypulver", category: "Gewürze", in_stock: true, keywords: ["curry", "currypulver"] },
    { id: "muskatnuss", name: "Muskatnuss & Lorbeer", category: "Gewürze", in_stock: true, keywords: ["muskat", "muskatnuss", "lorbeer"] },
    { id: "zimt", name: "Zimt", category: "Gewürze", in_stock: true, keywords: ["zimt"] },
    { id: "oregano", name: "Italienische Kräuter / Oregano", category: "Gewürze", in_stock: true, keywords: ["oregano", "kräuter", "thymian", "rosmarin"] },
    { id: "chili", name: "Chiliflocken / Cayennepfeffer", category: "Gewürze", in_stock: true, keywords: ["chili", "cayenne"] },
    
    { id: "olivenoel", name: "Olivenöl extra vergine", category: "Öle & Essige", in_stock: true, keywords: ["olivenöl"] },
    { id: "rapsoel", name: "Schweizer Rapsöl / Speiseöl", category: "Öle & Essige", in_stock: true, keywords: ["rapsöl", "speiseöl", "sonnenblumenöl"] },
    { id: "bratbutter", name: "Bratbutter / Bratcrème", category: "Öle & Essige", in_stock: true, keywords: ["bratbutter", "bratcrème"] },
    { id: "essig", "name": "Kräuteressig / Apfelessig", category: "Öle & Essige", in_stock: true, keywords: ["essig", "apfelessig", "kräuteressig"] },
    { id: "balsamico", "name": "Aceto Balsamico", category: "Öle & Essige", in_stock: true, keywords: ["balsamico"] },
    { id: "salatsauce", "name": "Schweizer Salatsauce", category: "Öle & Essige", in_stock: true, keywords: ["salatsauce", "dressing"] },

    { id: "senf", name: "Thomy Senf", category: "Saucen & Pasten", in_stock: true, keywords: ["senf"] },
    { id: "mayonnaise", name: "Mayonnaise", category: "Saucen & Pasten", in_stock: true, keywords: ["mayonnaise", "mayo"] },
    { id: "ketchup", name: "Ketchup", category: "Saucen & Pasten", in_stock: true, keywords: ["ketchup"] },
    { id: "tomatenmark", name: "Tomatenpüree (Tube)", category: "Saucen & Pasten", in_stock: true, keywords: ["tomatenmark", "tomatenpüree"] },
    { id: "sojasauce", name: "Sojasauce", category: "Saucen & Pasten", in_stock: true, keywords: ["sojasauce"] },

    { id: "mehl", name: "Weissmehl / Ruchmehl", category: "Backen & Vorrat", in_stock: true, keywords: ["mehl", "weissmehl", "ruchmehl"] },
    { id: "zucker", name: "Kristallzucker", category: "Backen & Vorrat", in_stock: true, keywords: ["zucker"] },
    { id: "honig", name: "Schweizer Honig", category: "Backen & Vorrat", in_stock: true, keywords: ["honig"] },
    { id: "backpulver", name: "Backpulver & Natron", category: "Backen & Vorrat", in_stock: true, keywords: ["backpulver", "natron"] },
    { id: "maizena", name: "Maizena / Speisestärke", category: "Backen & Vorrat", in_stock: true, keywords: ["maizena", "speisestärke"] },

    { id: "knoblauch", name: "Knoblauch", category: "Grundzutaten", in_stock: true, keywords: ["knoblauch"] }
  ],
  // VSGP / Swisspatat Saisondaten: field_months = Freiland, storage_months = Schweizer Lagerware
  season_items: [
    {"id": "baerlauch", "name": "Bärlauch (Wildgemüse)", "category": "Wildgemüse", "field_months": [3, 4, 5], "storage_months": []},
    {"id": "spargeln_gruen", "name": "Schweizer Grünspargeln", "category": "Stängelgemüse", "field_months": [4, 5, 6], "storage_months": []},
    {"id": "spargeln_weiss", "name": "Schweizer Bleichspargeln", "category": "Stängelgemüse", "field_months": [4, 5, 6], "storage_months": []},
    {"id": "rhabarber", "name": "Schweizer Rhabarber", "category": "Stängelgemüse", "field_months": [4, 5, 6], "storage_months": []},
    {"id": "radiesli", "name": "Radiesli (Radieschen)", "category": "Wurzelgemüse", "field_months": [4, 5, 6, 7, 8, 9, 10], "storage_months": []},
    {"id": "kohlrabi", "name": "Kohlrabi", "category": "Kohlgemüse", "field_months": [5, 6, 7, 8, 9, 10, 11], "storage_months": []},
    {"id": "fenchel", "name": "Schweizer Fenchel", "category": "Knollengemüse", "field_months": [5, 6, 7, 8, 9, 10, 11], "storage_months": []},
    {"id": "blumenkohl", "name": "Schweizer Blumenkohl", "category": "Kohlgemüse", "field_months": [5, 6, 7, 8, 9, 10, 11], "storage_months": []},
    {"id": "brokkoli", "name": "Schweizer Brokkoli", "category": "Kohlgemüse", "field_months": [5, 6, 7, 8, 9, 10, 11], "storage_months": []},
    {"id": "zucchini", "name": "Schweizer Zucchini (Courgettes)", "category": "Fruchtgemüse", "field_months": [5, 6, 7, 8, 9, 10], "storage_months": []},
    {"id": "tomaten", "name": "Schweizer Tomaten (Strauch/Cherry)", "category": "Fruchtgemüse", "field_months": [5, 6, 7, 8, 9, 10], "storage_months": []},
    {"id": "gurken", "name": "Schweizer Salatgurken", "category": "Fruchtgemüse", "field_months": [4, 5, 6, 7, 8, 9, 10], "storage_months": []},
    {"id": "peperoni", "name": "Schweizer Peperoni (Paprika)", "category": "Fruchtgemüse", "field_months": [6, 7, 8, 9, 10], "storage_months": []},
    {"id": "auberginen", "name": "Schweizer Auberginen", "category": "Fruchtgemüse", "field_months": [6, 7, 8, 9, 10], "storage_months": []},
    {"id": "buschbohnen", "name": "Schweizer Buschbohnen (Grüne Bohnen)", "category": "Hülsenfrüchte", "field_months": [6, 7, 8, 9, 10], "storage_months": []},
    {"id": "zuckermais", "name": "Schweizer Zuckermais", "category": "Fruchtgemüse", "field_months": [8, 9, 10], "storage_months": []},
    {"id": "kuerbis", "name": "Schweizer Kürbis (Knirps / Butternut)", "category": "Fruchtgemüse", "field_months": [8, 9, 10, 11], "storage_months": [12, 1, 2]},
    {"id": "ruebli", "name": "Schweizer Speiserüebli (Karotten)", "category": "Wurzelgemüse", "field_months": [6, 7, 8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4, 5]},
    {"id": "kartoffeln_fest", "name": "Schweizer Speisekartoffeln (festkochend)", "category": "Knollengemüse", "field_months": [6, 7, 8, 9, 10], "storage_months": [11, 12, 1, 2, 3, 4, 5]},
    {"id": "kartoffeln_mehlig", "name": "Schweizer Speisekartoffeln (mehligkochend)", "category": "Knollengemüse", "field_months": [7, 8, 9, 10], "storage_months": [11, 12, 1, 2, 3, 4, 5, 6]},
    {"id": "lauch", "name": "Schweizer Lauch (Porree)", "category": "Zwiebelgemüse", "field_months": [6, 7, 8, 9, 10, 11, 12], "storage_months": [1, 2, 3, 4]},
    {"id": "wirz", "name": "Schweizer Wirz (Wirsing)", "category": "Kohl", "field_months": [6, 7, 8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4]},
    {"id": "weisskabis", "name": "Schweizer Weisskabis (Kopfkohl)", "category": "Kohl", "field_months": [6, 7, 8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4, 5]},
    {"id": "rotkabis", "name": "Schweizer Rotkabis (Rotkohl)", "category": "Kohl", "field_months": [7, 8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4, 5]},
    {"id": "federkohl", "name": "Schweizer Federkohl (Grünkohl / Kale)", "category": "Kohl", "field_months": [10, 11, 12, 1, 2], "storage_months": []},
    {"id": "randen", "name": "Schweizer Randen (Rote Bete)", "category": "Wurzelgemüse", "field_months": [7, 8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4, 5]},
    {"id": "pastinaken", "name": "Schweizer Pastinaken", "category": "Wurzelgemüse", "field_months": [9, 10, 11, 12], "storage_months": [1, 2, 3, 4]},
    {"id": "sellerie", "name": "Schweizer Knollensellerie", "category": "Wurzelgemüse", "field_months": [8, 9, 10, 11], "storage_months": [12, 1, 2, 3, 4, 5]},
    {"id": "chicoree", "name": "Schweizer Chicorée", "category": "Salat & Treibgemüse", "field_months": [10, 11, 12, 1, 2, 3], "storage_months": [4]},
    {"id": "nuesslisalat", "name": "Schweizer Nüsslisalat (Feldsalat)", "category": "Salat", "field_months": [1, 2, 3, 9, 10, 11, 12], "storage_months": []},
    {"id": "spinat", "name": "Schweizer Blattspinat", "category": "Blattgemüse", "field_months": [3, 4, 5, 6, 9, 10, 11], "storage_months": []},
    {"id": "zwiebeln", "name": "Schweizer Speisezwiebeln (Gelb & Rot)", "category": "Zwiebelgemüse", "field_months": [6, 7, 8, 9], "storage_months": [10, 11, 12, 1, 2, 3, 4, 5]},
    {"id": "schweizer_kaese", "name": "Schweizer Bergkäse / Gruyère / Emmentaler", "category": "Milchprodukt", "field_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "storage_months": []},
    {"id": "schweizer_quark", "name": "Schweizer Magerquark / Kräuterquark", "category": "Milchprodukt", "field_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "storage_months": []},
    {"id": "schweizer_butter", "name": "Schweizer Butter / Bratbutter", "category": "Milchprodukt", "field_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "storage_months": []}
  ],
  months: [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ],
  monthly_news: {
    "1": {
      headline: "Winter-Power: Schweizer Lagergemüse & knackiger Chicorée",
      farmer_tip: "Chicorée und Nüsslisalat liefern jetzt frische Vitamine und Bitterstoffe. Lager-Rüebli und Pastinaken sind im Keller optimal gereift und extra süss.",
      season_highlight: "Chicorée & Nüsslisalat"
    },
    "2": {
      headline: "Lagergemüse-Hochsaison: Wirz, Kabis und Wurzeln",
      farmer_tip: "Schweizer Kabis und Wirz halten sich im Gemüsefach wochenlang. Ideal für wärmende Eintöpfe, die das Haushaltsbudget schonen.",
      season_highlight: "Wirz & Knollensellerie"
    },
    "3": {
      headline: "Frühlingserwachen: Der wilde Bärlauch ist da!",
      farmer_tip: "In den Schweizer Auenwäldern spriesst der Bärlauch. Gleichzeitig startet die Ernte von zartem Spinat und Bundzwiebeln.",
      season_highlight: "Bärlauch & Frühlingsspinat"
    },
    "4": {
      headline: "Saisonstart: Knackige Radiesli und erste Spargeln",
      farmer_tip: "Die ersten weissen und grünen Schweizer Spargeln werden gestochen. Frische Radiesli und Rhabarber bringen Farbe auf den Teller.",
      season_highlight: "Schweizer Spargeln & Rhabarber"
    },
    "5": {
      headline: "Spargel-Hochsaison & die ersten Schweizer Erdbeeren",
      farmer_tip: "Schweizer Spargeln haben jetzt Spitzenqualität. Freiland-Kohlrabi, Lattich und Fenchel wachsen rasant.",
      season_highlight: "Spargeln & Kohlrabi"
    },
    "6": {
      headline: "Sommerfrische: Schweizer Zucchini, Brokkoli & Blumenkohl",
      farmer_tip: "Die Ernte von Freiland-Zucchini und Sommerblumenkohl läuft auf Hochtouren. Perfekt für leichte Sommerküche und Grillgemüse.",
      season_highlight: "Zucchini & Blumenkohl"
    },
    "7": {
      headline: "Vollernte auf den Schweizer Feldern: Tomaten & Buschbohnen",
      farmer_tip: "Schweizer Tomaten haben jetzt das intensivste Aroma. Frische Buschbohnen und Gurken sind knackig und preiswert.",
      season_highlight: "Aroma-Tomaten & Bohnen"
    },
    "8": {
      headline: "Bunte Vielfalt: Peperoni, Auberginen & Zuckermais",
      farmer_tip: "Hochsommer in den Gewächshäusern und auf den Feldern. Schweizer Zuckermais und Auberginen sind jetzt besonders günstig.",
      season_highlight: "Peperoni & Zuckermais"
    },
    "9": {
      headline: "Herbstauftakt: Die grosse Kürbis- und Kartoffelernte",
      farmer_tip: "Knirps, Butternut und Muskatkürbis füllen die Hofläden. Swisspatat vermeldet erstklassige Speisekartoffeln für Rösti und Gschwellti.",
      season_highlight: "Schweizer Kürbis & Neukartoffeln"
    },
    "10": {
      headline: "Goldener Herbst: Marroni, Randen und Schwarzwurzeln",
      farmer_tip: "Erdige Randen und süssliche Pastinaken sind frisch geerntet. Nüsslisalat beginnt seine zweite grosse Hochsaison.",
      season_highlight: "Randen & Butternut-Kürbis"
    },
    "11": {
      headline: "Herbst-Endspurt: Lauch, Wirz und frischer Nüsslisalat",
      farmer_tip: "Die Schweizer Gemüsebauern lagern die Ernte in kontrollierten Kühlhäusern ein. Schweizer Lauch und Federkohl trotzen den ersten Frösten.",
      season_highlight: "Schweizer Lauch & Wirz"
    },
    "12": {
      headline: "Winter-Vorratsküche: Federkohl, Wurzelgemüse & Festtagsküche",
      farmer_tip: "Schweizer Federkohl (Grünkohl) wird nach dem ersten Frost besonders mild. Rüebli, Sellerie und Kartoffeln garantieren Unabhängigkeit von Importen.",
      season_highlight: "Federkohl & Schweizer Lagerkartoffeln"
    }
  },
  recipes: [
    {
      id: "aelplermagronen",
      source_url: "https://fooby.ch/de/rezepte/13040/aelplermagronen",
      title: "Klassische Älplermagronen mit Apfelmus",
      category: "schweizerisch",
      diet: "vegi",
      prep_time_min: 25,
      cost_per_person_chf: 2.80,
      primary_vegetables: ["kartoffeln_fest", "zwiebeln"],
      ingredients: [
        { name: "Magronen / Teigwaren", amount: "400", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Schweizer Festkochende Kartoffeln", amount: "400", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Reibkäse (Gruyère/Bergkäse)", amount: "180", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Schweizer Halbrahm", amount: "1.5", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Apfelmus", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Kartoffelwürfel und Magronen zusammen im Salzwasser al dente kochen. Zwiebelringe in Butter goldbraun anbraten. Magronen/Kartoffeln mit Käse und Rahm schichten, mit Röstzwiebeln toppen und Apfelmus servieren.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      health_tip: "Ergänzt mit ungesüsstem Apfelmus und ballaststoffreichen Kartoffeln."
    },
    {
      id: "gschwellti_abendbrot",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/SM2018_ALLT_05/gschwellti/",
      title: "Schweizer Gschwellti mit Käseauswahl & Quarkdip",
      category: "abendbrot",
      diet: "vegi",
      prep_time_min: 30,
      cost_per_person_chf: 3.20,
      primary_vegetables: ["kartoffeln_fest", "randen", "nuesslisalat"],
      ingredients: [
        { name: "Schweizer Festkochende Kartoffeln", amount: "750", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Magerquark / Kräuterquark", amount: "250", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Schweizer Käseplatte (Gruyère, Tilsiter)", amount: "200", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Schnittlauch / Frische Kräuter", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" },
        { name: "Gekochte Randen (in Scheiben)", amount: "250", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Butter", amount: "50", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Kartoffeln mit der Schale im Dämpfkörbchen weichkochen. Quark mit fein gehacktem Schnittlauch, Salz und Pfeffer anrühren. Zusammen mit Schweizer Käse und Randenscheiben servieren.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      health_tip: "Gschwellti enthalten dank Schale wertvolle Kalium- und Ballaststoffe, kombiniert mit magerem Protein."
    },
    {
      id: "kuerbis_linsen_curry",
      source_url: "https://fooby.ch/de/rezepte/27588/kuerbis-dal",
      title: "Herbstliches Kürbis-Kokos-Curry mit roten Linsen",
      category: "exotisch",
      diet: "vegan",
      prep_time_min: 30,
      cost_per_person_chf: 2.50,
      primary_vegetables: ["kuerbis", "zwiebeln", "ruebli"],
      ingredients: [
        { name: "Schweizer Knirps / Butternut Kürbis", amount: "600", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Rote Linsen", amount: "200", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Kokosmilch", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Rüebli", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Currypulver mild/scharf", amount: "2", unit: "EL", bring_cat: "Gewürze & Saucen" },
        { name: "Basmatireis", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Zwiebeln und Rüebli anbraten, Currypulver kurz mitdünsten. Kürbiswürfel und rote Linsen beigeben, mit Kokosmilch und 3dl Gemüsebouillon 18 Min. köcheln lassen. Mit Reis servieren.",
      season_months: [8, 9, 10, 11, 12, 1, 2],
      health_tip: "Hoher Beta-Carotin- und pflanzlicher Proteingehalt bei minimalen Zutatenkosten."
    },
    {
      id: "wirz_eintopf",
      title: "Währschafter Schweizer Wirz-Rüebli-Eintopf",
      category: "schweizerisch",
      diet: "vegi",
      prep_time_min: 35,
      cost_per_person_chf: 2.20,
      primary_vegetables: ["wirz", "ruebli", "kartoffeln_fest", "zwiebeln"],
      ingredients: [
        { name: "Schweizer Wirz (Wirsing)", amount: "0.5", unit: "Kopf", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "3", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Festkochende Kartoffeln", amount: "400", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Gemüsebouillon", amount: "8", unit: "dl", bring_cat: "Gewürze & Saucen" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Muskatnuss & Lorbeerblatt", amount: "1", unit: "Prise", bring_cat: "Gewürze & Saucen" }
      ],
      instructions: "Zwiebel und Rüebli andünsten. Wirzstreifen und Kartoffelwürfel dazugeben, mit Bouillon ablöschen und 25 Min. sanft köcheln. Mit Muskat und Pfeffer abschmecken.",
      season_months: [9, 10, 11, 12, 1, 2, 3, 4],
      health_tip: "Klassisches Schweizer Power-Essen: voller Vitamin C, Ballaststoffe und extrem budgetfreundlich."
    },
    {
      id: "lauch_waehe",
      source_url: "https://fooby.ch/de/rezepte/25828/lauchwaehe",
      title: "Knusprige Schweizer Lauchwähe mit Käseguss",
      category: "schweizerisch",
      diet: "vegi",
      prep_time_min: 40,
      cost_per_person_chf: 2.90,
      primary_vegetables: ["lauch", "zwiebeln"],
      ingredients: [
        { name: "Kuchenteig (rund)", amount: "1", unit: "Rolle", bring_cat: "Kühlregal" },
        { name: "Schweizer Lauch", amount: "500", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Eier", amount: "2", unit: "Stk", bring_cat: "Milch & Käse" },
        { name: "Schweizer Halbrahm oder Milch", amount: "2", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Schweizer Reibkäse", amount: "100", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Muskatnuss", amount: "1", unit: "Prise", bring_cat: "Gewürze & Saucen" }
      ],
      instructions: "Lauch in Ringe schneiden und in wenig Butter 5 Min. andünsten. Teig in Kuchenblech legen, mit Gabel einstechen. Lauch verteilen. Guss aus Eiern, Rahm, Käse, Muskat und Salz darübergiessen. Bei 200°C ca. 30 Min. backen.",
      season_months: [1, 2, 3, 4, 8, 9, 10, 11, 12],
      health_tip: "Günstig, sättigend und auch am nächsten Tag kalt als Lunch perfekt geeignet."
    },
    {
      id: "randen_risotto",
      source_url: "https://fooby.ch/de/rezepte/26051/randenrisotto-mit-ziegenkaese",
      title: "Leuchtendes Schweizer Randen-Risotto mit Ziegenkäse",
      category: "exotisch",
      diet: "vegi",
      prep_time_min: 35,
      cost_per_person_chf: 3.40,
      primary_vegetables: ["randen", "zwiebeln"],
      ingredients: [
        { name: "Risottoreis (Carnaroli/Maratelli)", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Gekochte Schweizer Randen", amount: "350", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebel / Schalotte", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Gemüsebouillon", amount: "9", unit: "dl", bring_cat: "Gewürze & Saucen" },
        { name: "Schweizer Ziegenfrischkäse / Feta", amount: "120", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Schweizer Butter", amount: "30", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Zwiebel dünsten, Reis glasig dünsten. Randen pürieren oder fein würfeln. Reis nach und nach mit heisser Bouillon ablöschen (ca. 20 Min.). Randenpüree unterrühren, mit Ziegenkäse servieren.",
      season_months: [1, 2, 3, 4, 9, 10, 11, 12],
      health_tip: "Randen liefern reichlich sekundäre Pflanzenstoffe (Betanin) und fördern die Durchblutung."
    },
    {
      id: "pastinaken_suppe",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/KO2021_SBLV_32/pastinakensuppe/",
      title: "Cremige Pastinaken-Rüebli-Suppe mit gerösteten Kernen",
      category: "abendbrot",
      diet: "vegan",
      prep_time_min: 25,
      cost_per_person_chf: 2.10,
      primary_vegetables: ["pastinaken", "ruebli", "zwiebeln"],
      ingredients: [
        { name: "Schweizer Pastinaken", amount: "400", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Gemüsebouillon", amount: "7", unit: "dl", bring_cat: "Gewürze & Saucen" },
        { name: "Sonnenblumenkerne / Kürbiskerne", amount: "50", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Vollkornbrot zum Dippen", amount: "4", unit: "Scheiben", bring_cat: "Brot & Gebäck" }
      ],
      instructions: "Gemüse grob würfeln, in etwas Rapsöl anbraten. Mit Bouillon weichkochen (15 Min.) und fein pürieren. Mit gerösteten Kernen und Vollkornbrot servieren.",
      season_months: [10, 11, 12, 1, 2, 3],
      health_tip: "Leichtes Abendessen, ballaststoffreich und schont den Magen vor dem Schlafen."
    },
    {
      id: "schweizer_roesti_spiegelei",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200911_74/scheibenroesti-mit-spiegeleiern/",
      title: "Knusprige Schweizer Rösti mit Spiegelei & Nüsslisalat",
      category: "schweizerisch",
      diet: "vegi",
      prep_time_min: 30,
      cost_per_person_chf: 2.70,
      primary_vegetables: ["kartoffeln_mehlig", "nuesslisalat"],
      ingredients: [
        { name: "Schweizer Rösti-Kartoffeln (vorgekocht)", amount: "700", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Freilandeier", amount: "4", unit: "Stk", bring_cat: "Milch & Käse" },
        { name: "Schweizer Butter / Bratbutter", amount: "40", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Nüsslisalat", amount: "120", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Salatsauce / Rapsöl & Essig", amount: "3", unit: "EL", bring_cat: "Gewürze & Saucen" }
      ],
      instructions: "Kartoffeln an der Röstiraffel reiben. In heisser Bratbutter beidseitig goldbraun anbraten. Spiegeleier braten, auf die Rösti legen und mit frischem Nüsslisalat anrichten.",
      season_months: [1, 2, 3, 4, 9, 10, 11, 12],
      health_tip: "Traditionell, sättigend und dank frischem Nüsslisalat reich an Folsäure."
    },
    {
      id: "ghackets_hoernli",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200903_89/ghackets-mit-hoernli-und-apfelmus/",
      title: "Ghackets mit Hörnli, Lauch & Apfelmus (WG-Klassiker)",
      category: "fleisch",
      diet: "fleisch",
      prep_time_min: 25,
      cost_per_person_chf: 3.90,
      primary_vegetables: ["lauch", "zwiebeln", "ruebli"],
      ingredients: [
        { name: "Schweizer Rindshackfleisch (oder Vegi-Hack)", amount: "400", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Hörnli Teigwaren", amount: "400", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Schweizer Lauch (fein geschnitten)", amount: "1", unit: "Stange", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli (fein geraffelt)", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Reibkäse", amount: "80", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Apfelmus", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Zwiebeln, Lauch und Rüebli andünsten. Hackfleisch scharf anbraten, mit etwas Bouillon ablöschen. Hörnli kochen, alles mischen und mit Käse und Apfelmus servieren.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      health_tip: "Gemüseanteil im Hackfleisch verdoppelt: Saftiger, gesünder und senkt die Portionskosten drastisch."
    },
    {
      id: "chicoree_gratin",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200803_81_B/chicoree-gratin-mit-schinken/",
      title: "Überbackener Schweizer Chicorée-Schinken-Gratin",
      category: "schweizerisch",
      diet: "fleisch",
      prep_time_min: 35,
      cost_per_person_chf: 3.60,
      primary_vegetables: ["chicoree", "kartoffeln_fest"],
      ingredients: [
        { name: "Schweizer Chicorée", amount: "6", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Beinschinken (oder Vegi-Aufschnitt)", amount: "6", unit: "Tranchen", bring_cat: "Fleisch & Fisch" },
        { name: "Schweizer Speisekartoffeln", amount: "500", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Schweizer Halbrahm", amount: "1.5", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Schweizer Reibkäse", amount: "120", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Chicorée 5 Min. im Salzwasser blanchieren, abtropfen lassen. In Schinkentranchen wickeln, in eine Gratinform legen. Mit Rahm und Käse übergiessen, bei 200°C 20 Min. überbacken. Mit Salzkartoffeln servieren.",
      season_months: [10, 11, 12, 1, 2, 3],
      health_tip: "Wertvolle Bitterstoffe im Chicorée regen die Verdauung und Leberfunktion optimal an."
    },
    {
      id: "resteessen",
      title: "Resteessen – Kühlschrank leeren",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 15,
      ingredients: [

      ],
      instructions: "Alles, was noch da ist, aufwärmen oder zu einer Pfanne/Rösti/Omelette verarbeiten. Nichts einkaufen.",
      is_leftovers: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "fertigpizza",
      title: "Fertigpizza mit Salat",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 20,
      ingredients: [
        { name: "Tiefkühlpizza", amount: "4", unit: "Stk", bring_cat: "Tiefkühl" }
      ],
      instructions: "Pizzen nach Packung backen (Fleisch-Fans nehmen Salami/Prosciutto, Jo Margherita/Gemüse). Dazu Salat.",
      no_addons: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "chicken_nuggets",
      title: "Chicken Nuggets mit Pommes",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 25,
      ingredients: [
        { name: "Chicken Nuggets", amount: "500", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Pommes frites", amount: "800", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Ketchup / Mayo", amount: "1", unit: "Flasche", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Nuggets und Pommes im Ofen oder Airfryer nach Packung backen. Jo bekommt Vegi-Nuggets.",
      vegi_swap: { name: "Vegi-Nuggets", amount: 150, unit: "g", bring_cat: "Tiefkühl" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "maultaschen",
      title: "Maultaschen mit Zwiebeln und Bouillon",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 20,
      ingredients: [
        { name: "Maultaschen", amount: "800", unit: "g", bring_cat: "Kühlregal" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Gemüsebouillon", amount: "1", unit: "l", bring_cat: "Vorrat & Konserven" },
        { name: "Schnittlauch", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Maultaschen in Bouillon ziehen lassen oder mit Zwiebeln in Butter anbraten. Mit Schnittlauch servieren.",
      vegi_swap: { name: "Vegi-Maultaschen", amount: 200, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "gnocchi_tomate",
      title: "Gnocchi mit Tomatensauce und Mozzarella",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 20,
      ingredients: [
        { name: "Gnocchi", amount: "1", unit: "kg", bring_cat: "Kühlregal" },
        { name: "Passata / Tomatensauce", amount: "700", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Mozzarella", amount: "250", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Basilikum", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Gnocchi kurz kochen oder in der Pfanne anbraten, mit warmer Tomatensauce mischen, Mozzarella darüber zupfen, Basilikum dazu.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "dumplings",
      title: "Dumplings mit Pak Choi und Sojasauce",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 20,
      ingredients: [
        { name: "Dumplings / Gyoza (Tiefkühl)", amount: "1", unit: "kg", bring_cat: "Tiefkühl" },
        { name: "Pak Choi", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Frühlingszwiebeln", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" },
        { name: "Sojasauce", amount: "1", unit: "Flasche", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Dumplings in der Pfanne anbraten und mit etwas Wasser zugedeckt garen. Pak Choi kurz mitdünsten, mit Sojasauce und Frühlingszwiebeln servieren.",
      vegi_swap: { name: "Vegi-Dumplings (Tiefkühl)", amount: 250, unit: "g", bring_cat: "Tiefkühl" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    // Mehr Klassiker (Mengen von Hand; Link = Swissmilk-Original, ohne Link -> «Rezept suchen»): Schnelles ohne Nachdenken + Schweizer Klassiker
    {
      id: "abendbrot",
      title: "Abendbrot mit Käse, Aufschnitt und Rohkost",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 10,
      ingredients: [
        { name: "Brot (Ruchbrot)", amount: "1", unit: "Stk", bring_cat: "Brot & Gebäck" },
        { name: "Käse (Appenzeller, Tilsiter)", amount: "300", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Aufschnitt (Salami, Schinken)", amount: "250", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Butter", amount: "100", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Cornichons", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Tomaten", amount: "4", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Gurke", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "3", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Brot aufschneiden, Käse, Aufschnitt, Butter und Cornichons auf ein Brett, Rohkost in Stängel schneiden. Jo bekommt mehr Käse statt Aufschnitt.",
      vegi_swap: { name: "Käse (Vegi statt Aufschnitt)", amount: 80, unit: "g", bring_cat: "Milch & Käse" },
      no_salad: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "cafe_complet",
      title: "Café complet mit Zopf, Käse und Konfi",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 10,
      ingredients: [
        { name: "Zopf", amount: "1", unit: "Stk", bring_cat: "Brot & Gebäck" },
        { name: "Brot (Ruchbrot)", amount: "1", unit: "Stk", bring_cat: "Brot & Gebäck" },
        { name: "Butter", amount: "150", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Konfitüre", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Honig", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Käse (Greyerzer, Emmentaler)", amount: "300", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Milch", amount: "1", unit: "l", bring_cat: "Milch & Käse" },
        { name: "Kaffee", amount: "1", unit: "Pck", bring_cat: "Vorrat & Konserven" },
        { name: "Äpfel", amount: "4", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Milchkaffee machen, Zopf und Brot aufschneiden, mit Butter, Konfi, Honig, Käse und Äpfeln auf den Tisch. Wer will, brät dazu ein Spiegelei.",
      no_addons: true,
      no_salad: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "birchermueesli",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200806_89/birchermueesli/",
      title: "Birchermüesli zum Znacht",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 15,
      ingredients: [
        { name: "Haferflocken", amount: "250", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Joghurt (nature)", amount: "500", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Milch", amount: "3", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Äpfel", amount: "4", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zitrone", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Haselnüsse", amount: "80", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Beeren (Tiefkühl)", amount: "300", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Bananen", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Honig", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Haferflocken mit Milch und Joghurt einweichen, Äpfel mit der Schale dazureiben, Zitronensaft, Bananen, Beeren und gehackte Nüsse untermischen, mit Honig süssen.",
      no_addons: true,
      no_salad: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "spaghetti_pesto",
      title: "Spaghetti mit Pesto und Parmesan",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 15,
      ingredients: [
        { name: "Spaghetti", amount: "500", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Pesto alla genovese", amount: "2", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Parmesan (oder Sbrinz)", amount: "100", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Cherrytomaten", amount: "250", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Rucola", amount: "100", unit: "g", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Spaghetti al dente kochen, etwas Kochwasser aufheben. Mit Pesto und einem Schluck Kochwasser mischen, halbierte Cherrytomaten und Rucola darüber, Käse dazu.",
      no_addons: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "fischstaebli",
      title: "Fischstäbli mit Kartoffelstock und Erbsli",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 25,
      ingredients: [
        { name: "Fischstäbli (Tiefkühl)", amount: "600", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Kartoffelstock (Flocken)", amount: "1", unit: "Pck", bring_cat: "Vorrat & Konserven" },
        { name: "Milch", amount: "5", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Erbsli (Tiefkühl)", amount: "400", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Zitrone", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Fischstäbli im Ofen backen, Kartoffelstock nach Packung mit Milch anrühren, Erbsli mit etwas Butter erwärmen, Zitronenschnitze dazu.",
      vegi_swap: { name: "Vegi-Fischstäbli (Tiefkühl)", amount: 150, unit: "g", bring_cat: "Tiefkühl" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "toast_hawaii",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/CHDO201612_42/toast-hawaii/",
      title: "Toast Hawaii",
      category: "schnell",
      quick: true,
      diet: "fleisch",
      servings: 4,
      prep_time_min: 20,
      ingredients: [
        { name: "Brot (Toastbrot)", amount: "1", unit: "Pck", bring_cat: "Brot & Gebäck" },
        { name: "Schinken", amount: "250", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Ananas (Dose, Scheiben)", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Raclette (Käse in Scheiben)", amount: "300", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Toast mit Butter bestreichen, Schinken, Ananas und Käse darauf, im Ofen bei 220 °C überbacken. Jo: Toasts ohne Schinken, dafür mit Tomate.",
      vegi_swap: { name: "Tomaten (Vegi-Toast)", amount: 1, unit: "Stk", bring_cat: "Obst & Gemüse" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "raviolis_salbeibutter",
      title: "Ravioli mit Salbeibutter",
      category: "schnell",
      quick: true,
      diet: "vegi",
      servings: 4,
      prep_time_min: 15,
      ingredients: [
        { name: "Ravioli (Kühlregal)", amount: "1", unit: "kg", bring_cat: "Kühlregal" },
        { name: "Butter", amount: "80", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Salbei", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" },
        { name: "Parmesan (oder Sbrinz)", amount: "80", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Ravioli nach Packung kochen. Butter mit Salbeiblättern aufschäumen, Ravioli darin schwenken, Käse darüber.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "kaeseschnitte",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/KB_KB1996_182/walliser-kaeseschnitten/",
      title: "Walliser Käseschnitten mit Weisswein",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 30,
      ingredients: [
        { name: "Brot (Ruchbrot vom Vortag)", amount: "1", unit: "Stk", bring_cat: "Brot & Gebäck" },
        { name: "Raclette (oder Greyerzer)", amount: "400", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Weisswein", amount: "1", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Knoblauch", amount: "2", unit: "Zehe", bring_cat: "Obst & Gemüse" },
        { name: "Cornichons", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Silberzwiebeln", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Brotscheiben mit Knoblauch einreiben, mit Weisswein beträufeln, mit Käse belegen und im Ofen bei 220 °C goldbraun überbacken. Mit Cornichons und Salat.",
      season_months: [10, 11, 12, 1, 2, 3]
    },
    {
      id: "kaesefondue",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200411_08/fondue-moitie-moitie/",
      title: "Käsefondue moitié-moitié",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 30,
      ingredients: [
        { name: "Fondue (moitié-moitié)", amount: "800", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Weisswein", amount: "3", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Knoblauch", amount: "1", unit: "Zehe", bring_cat: "Obst & Gemüse" },
        { name: "Maizena", amount: "2", unit: "EL", bring_cat: "Vorrat & Konserven" },
        { name: "Kirsch", amount: "1", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Brot (Halbweissbrot)", amount: "800", unit: "g", bring_cat: "Brot & Gebäck" },
        { name: "Kartoffeln (für Gschwellti)", amount: "600", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Cornichons", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Caquelon mit Knoblauch ausreiben, Käse mit Wein unter Rühren schmelzen, Maizena mit Kirsch anrühren und einrühren. Mit Brotwürfeln und Kartoffeln.",
      no_salad: true,
      season_months: [11, 12, 1, 2]
    },
    {
      id: "raclette_gschwellti",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/KB_KB1996_172/raclette/",
      title: "Raclette mit Gschwellti, Cornichons und Silberzwiebeln",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 30,
      ingredients: [
        { name: "Raclette (Käse in Scheiben)", amount: "900", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Festkochende Kartoffeln", amount: "1.2", unit: "kg", bring_cat: "Obst & Gemüse" },
        { name: "Cornichons", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Silberzwiebeln", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Ananas (Dose, Scheiben)", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Kartoffeln in der Schale kochen, Käse im Raclette-Ofen schmelzen, mit Pfeffer und Paprika würzen. Fleisch-Fans essen Bündnerfleisch dazu.",
      season_months: [11, 12, 1, 2, 3]
    },
    {
      id: "kartoffelgratin",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/KO2021_SBLV_08/schneller-kartoffelgratin/",
      title: "Kartoffelgratin mit Rahm und Greyerzer",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 70,
      ingredients: [
        { name: "Festkochende Kartoffeln", amount: "1.2", unit: "kg", bring_cat: "Obst & Gemüse" },
        { name: "Rahm (Vollrahm)", amount: "2", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Milch", amount: "3", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Greyerzer", amount: "150", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Knoblauch", amount: "1", unit: "Zehe", bring_cat: "Obst & Gemüse" },
        { name: "Muskatnuss", amount: "1", unit: "Prise", bring_cat: "Gewürze & Saucen" }
      ],
      instructions: "Kartoffeln in dünne Scheiben hobeln, mit Milch, Rahm, Knoblauch, Salz und Muskat kurz aufkochen, in die Form geben, Käse darüber und 45 Min. bei 180 °C backen.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "chaeswaehe",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200003_24_MEN003B024A/zwiebel-kaesewaehe/",
      title: "Zwiebel-Käsewähe",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 50,
      ingredients: [
        { name: "Kuchenteig (ausgewallt)", amount: "1", unit: "Stk", bring_cat: "Kühlregal" },
        { name: "Greyerzer / Emmentaler", amount: "250", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Eier", amount: "3", unit: "Stk", bring_cat: "Milch & Käse" },
        { name: "Milch", amount: "2", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Rahm (Halbrahm)", amount: "1", unit: "dl", bring_cat: "Milch & Käse" }
      ],
      instructions: "Teig in das Blech legen, mit der Gabel einstechen. Zwiebeln andünsten, mit dem geriebenen Käse auf den Teig. Eier, Milch und Rahm verquirlen, darübergiessen, 30 Min. bei 220 °C backen.",
      season_months: [9, 10, 11, 12, 1, 2, 3, 4]
    },
    {
      id: "pilzrisotto",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/SM2021_OUTD_08/pilzrisotto-risotto-ai-funghi/",
      title: "Steinpilz-Champignon-Risotto",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 35,
      ingredients: [
        { name: "Reis (Risotto)", amount: "350", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Champignons", amount: "400", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Getrocknete Steinpilze", amount: "20", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Weisswein", amount: "1.5", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Gemüsebouillon", amount: "1.2", unit: "l", bring_cat: "Vorrat & Konserven" },
        { name: "Parmesan (oder Sbrinz)", amount: "80", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Butter", amount: "40", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Petersilie", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Steinpilze einweichen. Zwiebel und Reis andünsten, mit Wein ablöschen, nach und nach Bouillon und Pilzwasser zugeben. Champignons separat anbraten, mit Butter und Käse unterziehen.",
      season_months: [9, 10, 11, 12]
    },
    {
      id: "polenta_pilzragout",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201409_27/polenta-mit-pilzragout/",
      title: "Polenta mit Pilzragout",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 35,
      ingredients: [
        { name: "Bramata-Polenta", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Gemüsebouillon", amount: "1.2", unit: "l", bring_cat: "Vorrat & Konserven" },
        { name: "Champignons / Kräuterseitlinge", amount: "600", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rahm (Halbrahm)", amount: "2", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Parmesan (oder Sbrinz)", amount: "60", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Petersilie", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Polenta in Bouillon unter Rühren weich kochen, Käse unterziehen. Pilze mit Zwiebeln kräftig anbraten, mit Rahm ablöschen, abschmecken, Petersilie darüber.",
      season_months: [9, 10, 11, 12, 1, 2]
    },
    {
      id: "spaghetti_pomodoro",
      title: "Spaghetti al pomodoro",
      category: "italienisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 25,
      ingredients: [
        { name: "Spaghetti", amount: "500", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Pelati / gehackte Tomaten", amount: "2", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Knoblauch", amount: "2", unit: "Zehe", bring_cat: "Obst & Gemüse" },
        { name: "Basilikum", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" },
        { name: "Parmesan (oder Sbrinz)", amount: "80", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Zwiebel und Knoblauch in Olivenöl andünsten, Tomaten dazu und 15 Min. köcheln, mit Salz und einer Prise Zucker abschmecken. Mit Spaghetti, Basilikum und Käse.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "gemueselasagne",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/KO2021_SBLV_15/gemueselasagne/",
      title: "Gemüselasagne mit Spinat und Ricotta",
      category: "italienisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 70,
      ingredients: [
        { name: "Lasagneblätter", amount: "250", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Blattspinat (Tiefkühl)", amount: "600", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Ricotta", amount: "250", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Passata", amount: "700", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Zucchetti", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Mozzarella", amount: "250", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Parmesan (oder Sbrinz)", amount: "60", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Tomatensauce mit Zwiebeln und Zucchettiwürfeln kochen. Spinat mit Ricotta mischen. Lagenweise Sauce, Blätter, Spinat in die Form schichten, Mozzarella und Käse obendrauf, 40 Min. bei 200 °C.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "fotzelschnitten",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201501_61_B/fotzelschnitten/",
      title: "Fotzelschnitten mit Zwetschgenkompott",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 25,
      ingredients: [
        { name: "Zopf (vom Vortag)", amount: "600", unit: "g", bring_cat: "Brot & Gebäck" },
        { name: "Eier", amount: "4", unit: "Stk", bring_cat: "Milch & Käse" },
        { name: "Milch", amount: "4", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Zimt und Zucker", amount: "1", unit: "Pck", bring_cat: "Vorrat & Konserven" },
        { name: "Zwetschgen / Apfelmus", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Butter", amount: "50", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Brotscheiben in Milch und verquirlten Eiern wenden, in Butter goldbraun braten, in Zimtzucker wenden. Mit Kompott oder Apfelmus.",
      no_addons: true,
      no_salad: true,
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "ofenkartoffeln_quark",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/SM2020_GEOF_15/ofenkartoffeln-mit-kraeuter-quarksauce/",
      title: "Ofenkartoffeln mit Kräuterquark und Gemüse vom Blech",
      category: "schweizerisch",
      diet: "vegi",
      servings: 4,
      prep_time_min: 50,
      ingredients: [
        { name: "Kartoffeln (gross)", amount: "1.2", unit: "kg", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "4", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Peperoni", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Kräuterquark", amount: "500", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Schnittlauch", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Kartoffeln halbieren, mit Rüebli, Peperoni und Zwiebeln in Stücken auf ein Blech, mit Öl und Salz 40 Min. bei 200 °C backen. Mit Kräuterquark und Schnittlauch.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "zuercher_geschnetzeltes",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201401_83/zuercher-geschnetzeltes/",
      title: "Zürcher Geschnetzeltes mit Rösti",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 40,
      ingredients: [
        { name: "Kalbs- oder Schweinsgeschnetzeltes", amount: "600", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Champignons", amount: "250", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Weisswein", amount: "1", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Rahm (Halbrahm)", amount: "2.5", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Rösti (Beutel)", amount: "2", unit: "Pck", bring_cat: "Kühlregal" },
        { name: "Petersilie", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Fleisch portionenweise scharf anbraten, herausnehmen. Zwiebeln und Champignons dünsten, mit Wein ablöschen, Rahm dazu, einkochen lassen, Fleisch nur noch erwärmen. Mit knuspriger Rösti.",
      vegi_swap: { name: "Vegi-Geschnetzeltes (z.B. planted)", amount: 130, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "hackbraten",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201205_73/hackbraten-klassisch/",
      title: "Hackbraten mit Kartoffelstock und Rüebli",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 80,
      ingredients: [
        { name: "Hackfleisch (Rind/Schwein)", amount: "700", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Eier", amount: "1", unit: "Stk", bring_cat: "Milch & Käse" },
        { name: "Paniermehl", amount: "50", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Mehligkochende Kartoffeln", amount: "1.2", unit: "kg", bring_cat: "Obst & Gemüse" },
        { name: "Milch", amount: "3", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Butter", amount: "50", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Rüebli", amount: "600", unit: "g", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Hackfleisch mit Ei, Paniermehl, gehackter Zwiebel und Gewürzen kneten, zu einem Laib formen, 50 Min. bei 180 °C braten. Kartoffeln weichkochen und mit Milch und Butter stampfen, Rüebli glasieren.",
      vegi_swap: { name: "Vegi-Hack", amount: 150, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "spaghetti_bolognese",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200105_44_MEN10526/spaghetti-bolognese/",
      title: "Spaghetti Bolognese",
      category: "italienisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 50,
      ingredients: [
        { name: "Spaghetti", amount: "500", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Hackfleisch (Rind)", amount: "500", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Pelati / gehackte Tomaten", amount: "2", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Tomatenpüree", amount: "1", unit: "Tube", bring_cat: "Vorrat & Konserven" },
        { name: "Rüebli", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Stangensellerie", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rotwein", amount: "1", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Parmesan (oder Sbrinz)", amount: "80", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Zwiebel, Rüebli und Sellerie fein hacken und andünsten, Hackfleisch krümelig braten, Tomatenpüree mitrösten, mit Wein ablöschen, Tomaten dazu und 30 Min. köcheln. Jo: kleiner Topf mit Vegi-Hack.",
      vegi_swap: { name: "Vegi-Hack", amount: 130, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "lasagne_klassisch",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/SM2017_DIVE_15/lasagne/",
      title: "Lasagne al forno",
      category: "italienisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 90,
      ingredients: [
        { name: "Lasagneblätter", amount: "250", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Hackfleisch (Rind)", amount: "500", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Passata", amount: "700", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Milch", amount: "6", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Butter", amount: "50", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Mehl", amount: "50", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Parmesan (oder Sbrinz)", amount: "80", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Bolognese kochen, aus Butter, Mehl und Milch eine Béchamel rühren. Abwechselnd Sauce, Béchamel und Blätter schichten, Käse darüber, 40 Min. bei 200 °C backen.",
      vegi_swap: { name: "Vegi-Hack", amount: 130, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "riz_casimir",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200609_53/riz-casimir/",
      title: "Riz Casimir",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 35,
      ingredients: [
        { name: "Pouletbrüstli", amount: "600", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Reis (Langkorn)", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Ananas (Dose, Stücke)", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Bananen", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rahm (Halbrahm)", amount: "2", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Currypulver", amount: "2", unit: "EL", bring_cat: "Gewürze & Saucen" },
        { name: "Zwiebeln", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rosinen", amount: "50", unit: "g", bring_cat: "Vorrat & Konserven" }
      ],
      instructions: "Reis kochen. Poulet in Streifen anbraten, Zwiebel und Curry mitdünsten, mit Rahm und etwas Ananassaft ablöschen. Ananas, Bananenscheiben und Rosinen darin erwärmen.",
      vegi_swap: { name: "Vegi-Chicken (z.B. planted)", amount: 130, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "bratwurst_zwiebelsauce",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201403_65/bratwurst-an-zwiebelsauce/",
      title: "St. Galler Bratwurst mit Zwiebelsauce und Rösti",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 35,
      ingredients: [
        { name: "Bratwurst (St. Galler Kalb)", amount: "4", unit: "Stk", bring_cat: "Fleisch & Fisch" },
        { name: "Zwiebeln", amount: "3", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Bratensauce (Pulver)", amount: "1", unit: "Pck", bring_cat: "Vorrat & Konserven" },
        { name: "Rösti (Beutel)", amount: "2", unit: "Pck", bring_cat: "Kühlregal" }
      ],
      instructions: "Zwiebeln in Ringe schneiden und langsam goldbraun dünsten, Bratensauce dazu. Bratwürste bei mittlerer Hitze braten, Rösti knusprig backen.",
      vegi_swap: { name: "Vegi-Bratwurst", amount: 1, unit: "Stk", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "gerstensuppe",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201401_54/buendner-gerstensuppe/",
      title: "Bündner Gerstensuppe",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 60,
      ingredients: [
        { name: "Rollgerste", amount: "150", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Speckwürfeli", amount: "150", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Lauch", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rüebli", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Knollensellerie", amount: "200", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Kartoffeln", amount: "300", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Gemüsebouillon", amount: "1.5", unit: "l", bring_cat: "Vorrat & Konserven" },
        { name: "Rahm (Halbrahm)", amount: "1", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Bündner Rohschinken / Salsiz", amount: "100", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Brot (Ruchbrot)", amount: "1", unit: "Stk", bring_cat: "Brot & Gebäck" }
      ],
      instructions: "Speck und Gemüsewürfel andünsten, Gerste dazu, mit Bouillon auffüllen und 45 Min. köcheln. Mit Rahm verfeinern, Rohschinkenstreifen darüber, Brot dazu. Jo: Teil vor dem Speck abschöpfen.",
      season_months: [10, 11, 12, 1, 2, 3]
    },
    {
      id: "chili_con_carne",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM201511_23/chili-con-carne/",
      title: "Chili con Carne mit Reis",
      category: "exotisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 45,
      ingredients: [
        { name: "Hackfleisch (Rind)", amount: "500", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Kidneybohnen", amount: "2", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Mais", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Pelati / gehackte Tomaten", amount: "2", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Peperoni", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Chilipulver / Paprika", amount: "2", unit: "TL", bring_cat: "Gewürze & Saucen" },
        { name: "Reis", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Sauerrahm", amount: "180", unit: "g", bring_cat: "Milch & Käse" }
      ],
      instructions: "Zwiebeln und Peperoni andünsten, Hackfleisch braten, würzen, Tomaten, Bohnen und Mais dazu und 25 Min. köcheln. Mit Reis und Sauerrahm. Jo: Topf mit doppelt Bohnen statt Fleisch.",
      vegi_swap: { name: "Kidneybohnen (Vegi-Topf)", amount: 0.5, unit: "Dose", bring_cat: "Vorrat & Konserven" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "cordon_bleu",
      source_url: "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200703_10/cordon-bleu/",
      title: "Cordon bleu mit Pommes und Rüebli",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 40,
      ingredients: [
        { name: "Cordon bleu (Schwein)", amount: "4", unit: "Stk", bring_cat: "Fleisch & Fisch" },
        { name: "Pommes frites (Tiefkühl)", amount: "800", unit: "g", bring_cat: "Tiefkühl" },
        { name: "Rüebli", amount: "600", unit: "g", bring_cat: "Obst & Gemüse" },
        { name: "Zitrone", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Cordon bleus in Bratbutter beidseitig goldbraun braten und im Ofen fertig garen. Pommes im Ofen, Rüebli dämpfen. Mit Zitronenschnitzen.",
      vegi_swap: { name: "Vegi-Cordon-bleu", amount: 1, unit: "Stk", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "poulet_curry",
      title: "Poulet-Curry mit Kokosmilch und Reis",
      category: "exotisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 35,
      ingredients: [
        { name: "Pouletbrüstli", amount: "600", unit: "g", bring_cat: "Fleisch & Fisch" },
        { name: "Kokosmilch", amount: "1", unit: "Dose", bring_cat: "Vorrat & Konserven" },
        { name: "Rote Currypaste", amount: "2", unit: "EL", bring_cat: "Gewürze & Saucen" },
        { name: "Peperoni", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Zucchetti", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Reis (Basmati)", amount: "300", unit: "g", bring_cat: "Vorrat & Konserven" },
        { name: "Koriander", amount: "1", unit: "Bund", bring_cat: "Obst & Gemüse" },
        { name: "Limette", amount: "1", unit: "Stk", bring_cat: "Obst & Gemüse" }
      ],
      instructions: "Currypaste anrösten, Poulet anbraten, Gemüse dazu, mit Kokosmilch ablöschen und 10 Min. köcheln. Mit Limette abschmecken, mit Reis und Koriander servieren.",
      vegi_swap: { name: "Tofu", amount: 120, unit: "g", bring_cat: "Kühlregal" },
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    },
    {
      id: "schweinsbraten_kartoffelstock",
      title: "Schweinsbraten mit Kartoffelstock und Rotkraut",
      category: "schweizerisch",
      diet: "fleisch",
      servings: 4,
      prep_time_min: 120,
      ingredients: [
        { name: "Schweinsbraten (Hals)", amount: "1", unit: "kg", bring_cat: "Fleisch & Fisch" },
        { name: "Mehligkochende Kartoffeln", amount: "1.2", unit: "kg", bring_cat: "Obst & Gemüse" },
        { name: "Milch", amount: "3", unit: "dl", bring_cat: "Milch & Käse" },
        { name: "Butter", amount: "50", unit: "g", bring_cat: "Milch & Käse" },
        { name: "Rotkraut", amount: "1", unit: "Glas", bring_cat: "Vorrat & Konserven" },
        { name: "Zwiebeln", amount: "2", unit: "Stk", bring_cat: "Obst & Gemüse" },
        { name: "Rotwein", amount: "2", unit: "dl", bring_cat: "Vorrat & Konserven" },
        { name: "Kastanien / Marroni (glasiert)", amount: "200", unit: "g", bring_cat: "Tiefkühl" }
      ],
      instructions: "Braten rundum anbraten, mit Zwiebeln und Rotwein im Ofen bei 160 °C 90 Min. schmoren. Kartoffelstock machen, Rotkraut mit Marroni erwärmen. Jo: Grillkäse in der Pfanne.",
      season_months: [10, 11, 12, 1, 2]
    }
  ]
};
