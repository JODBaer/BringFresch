// BringFrisch: Vollständige Standalone-Daten für alle 12 Monate & Rezepte
// Läuft 100% autonom direkt im Browser auf jedem Smartphone (iOS / Android)

window.BRINGFRISCH_DATA = {
  version: "2.0.0",
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
    }
  ]
};

