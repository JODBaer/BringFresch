# BringFrisch – Plan

Ziel: Tool für **unsere WG**, einfach zu benutzen. Erst mit der WG testen, dann erweitern.
Grundsatz: **Bring! ist die Wahrheit** für die Einkaufsliste – BringFrisch baut nur drumherum. **Grundvorrat, Plan und Wochenwahl** sind die Wahrheit von BringFrisch (gemeinsam im WG-Server).

## Erledigt

- [x] App-Absturz behoben (doppelte Variable), CI-Syntaxcheck
- [x] Schlanke App: Matrix-Plan, Alpine-Design (Schneeweiss/Alpengrün, Dark Mode), echte WG
- [x] Mengen korrekt (Rezepte für 4 Portionen), saubere Bring!-Mengen
- [x] Wochenwahl (Memory): 14 Saison-Gerichte, Stimmen, Wunschtag, Neu mischeln, faire Tagesverteilung
- [x] Cloudflare Worker: Bring!-Sync (Bot-Konto), gemeinsame Wochenwahl, gemeinsamer Plan, Kalender-Abo, Rezept-Link-Import
- [x] 82 Saisonrezepte (Betty Bossi, Migusto, Fooby, Swissmilk), ½ vegi / ½ Fleisch pro Saison
- [x] Python-Backend entfernt (alter Stand: `git tag v0-full`)
- [x] **Worker live** (`bringfrisch.bringfrisch-worker.workers.dev`), Bot-Konto `allmenbot@gmail.com`, Adresse fest in der App
- [x] Bring!-Liste in der App wählbar (gilt für die ganze WG)
- [x] Bring!-Katalog: Artikel bekommen ihr Bring!-Bild (Butternuss-Kürbis → Kürbis, Sorte in der Mengenangabe), ~95 % der Zutaten
- [x] Einkaufsnamen aufgeräumt: «Schweizer», Klammern, «à ca. 400 g» in der Mengenangabe; Leitungswasser nie auf der Liste
- [x] Schnelles & Reste: Fertigpizza, Nuggets, Maultaschen, Gnocchi, Dumplings, Resteessen (2 pro Woche im Memory)
- [x] Grundvorrat wie Bring!: gleiche Abteilungen/Artikel, antippen = auf Bring!, nochmals = weg; gemeinsam für die WG
- [x] Jede Zeile der Einkaufsliste antippbar (auf/von Bring!), auch nach dem Füllen
- [x] Bot nimmt nur weg, was er selbst gesetzt hat; Gekauftes gilt wieder als «da»
- [x] «Bring! füllen»: Fehlendes einfach senden, bei schon Vorhandenem pro Artikel nachfragen (z.B. 2. Rezept mit Rahm), danach «Rückgängig»
- [x] Herunterziehen = sofort synchronisieren
- [x] Untere Navigation mit Icons (Plan · Einkauf · Rezepte & Saison · Einstellungen), Homescreen-Icon
- [x] Tests: App (jsdom), 2-Handy-Integration, Worker offline, `tools/check_live` (Kette), `tests/e2e_live` (echtes Bring!)

## Als Nächstes

- [ ] **Joshua**: WG-Liste in Bring! mit `allmenbot@gmail.com` teilen, in der App unter Einstellungen → «Bring!-Liste der WG» wählen
- [ ] **Design-Entscheid** (Joshua, live): Material 2014 oder 2018, Grün behalten oder Google-Farben – Vorschau: <https://claude.ai/artifact/GJVsoZBRtYx5RFzgP1w6ac>
  - danach ganze App umstellen, inkl. Android-Sync-Animation (Kreis mit Bogen) und Snackbar mit «Rückgängig»
- [ ] **Mehr Rezepte, von Hand geschrieben** (kein Scraping), je 4 Portionen, mit Saison:
  - **Salate als Hauptgang** (ohne zusätzlichen Beilagensalat): Feigen-Ziegenkäse-Rucola mit Baumnüssen (Aug–Okt), Nüsslisalat mit Ei, Speck und Croûtons (Okt–März), Randen-Linsen mit Feta und Apfel (Sep–März), Chicorée-Orangen mit Poulet (Nov–März), Kürbis-Quinoa mit Granatapfel (Sep–Dez, vegan), Wassermelone-Feta-Minze (Jun–Aug), Panzanella (Jul–Sep)
  - **Teigwaren**: Kürbis-Salbei-Penne (Sep–Dez), Carbonara (Jo: Champignons), Lauch-Rahm-Nudeln mit Schinken (Jo: Räuchertofu), Orecchiette mit Rosenkohl, Zitrone, Baumnüssen (Okt–Feb), Bolognese mit Rüebli (Jo: Vegi-Hack), Spinat-Ricotta-Penne (Frühling/Herbst), Cherrytomaten-Burrata-Pasta (Jun–Sep)
  - Regel: Salat-Rezepte bekommen `is_salad: true` → kein extra «Nüsslisalat / Saisonsalat» auf der Liste
- [ ] **Schütteln zum Mischeln** in der Wochenwahl: Handy schütteln = «Neu mischeln» (nur Gerichte ohne Stimme), mit kleiner Karten-Animation
  - iPhone verlangt eine Erlaubnis für Bewegungssensoren → einmal beim ersten Tippen auf «🔀 Neu mischeln» fragen; Schalter «📳 Schütteln» zum Ein/Aus
  - Entprellen (max. 1× pro 1.5 s), nur solange die Wochenwahl offen ist
- [ ] **Datum/Tag aktuell halten** (kleiner Fix)
  - Beim Zurückkehren in die App (`visibilitychange`) und um Mitternacht neu zeichnen: KW, Monat, «heute»-Markierung
  - **Neue Woche: Optionen offen lassen**, nichts erzwingen. Eine kleine, wegklickbare Leiste «Neue Woche» mit Auswahl:
    - **Weiter mit diesem Plan** (gilt dann für die neue Woche, Kalender rückt mit)
    - **🃏 Wochenwahl starten**
    - **🎲 Zufällig neu** (wie bisher «Neue Woche»)
    - **Einzelne Tage tauschen** (Plan bleibt, man ändert nur, was man will)
  - Ohne Auswahl bleibt alles wie es ist; der Plan ist mit seiner Woche beschriftet (z.B. «KW 46»), damit klar ist, welche gilt
- [ ] **Beilagen pro Person** beim Menü (z.B. Jo extra Salat, Lukas eine kleine Extraportion Gemüse)
  - Im Plan pro Tag: «+ Beilage» → Person(en) antippen → Beilage wählen: Salat, Gemüse, Brot, Reis/Teigwaren, eigene
  - Menge pro Person (z.B. Salat 80 g, Gemüse 150 g, Brot 1 Stk) kommt automatisch auf die Einkaufsliste, nur wenn die Person an dem Tag mitisst
  - Gemüse nach Saison vorschlagen (Saisonliste), auf Bring! wie alles andere (Katalogname + Bild)
  - Optional als Gewohnheit speichern: «Jo immer extra Salat» gilt für jeden Tag, bis man es ausschaltet
  - Sichtbar im Plan als kleines Zeichen neben dem Kürzel (z.B. `Jo 🥗`), im Kalender-Text erwähnt
- [ ] **Kürzel pro Person selbst wählen** (Einstellungen → Mitbewohner): max. 3 Buchstaben (z.B. `Jo`, `Leo`) **oder** ein Emoji (z.B. 🦊)
  - Prüfen: höchstens 3 Zeichen bzw. genau 1 Emoji (auch zusammengesetzte wie 👩‍🍳 zählen als eins → `Intl.Segmenter`)
  - Gilt überall, wo heute `J L Le Jo` steht (Plan, Wochenwahl, Kalender-Text); leer = automatisches Kürzel wie bisher
  - Wird mit den Mitbewohnern im WG-Server geteilt, damit alle Handys dieselben Kürzel zeigen
- [ ] **Live-Test** der neuen Bring!-Logik (Nachfragen, Rückgängig, Herunterziehen): `powershell -ExecutionPolicy Bypass -File tests\e2e_live.ps1`
- [ ] **Praxistest**: eine echte Woche mit Lukas, Leonie und Jo planen, einkaufen, Feedback sammeln
- [ ] Danach entscheiden: Mengen der Protein-Zusätze (150 g Fleisch / 100 g Käse pro Person), Rezeptauswahl, evtl. Koch-Zuteilung

## Später, nur wenn nötig

- Echte Kalender-Einladungen mit «Annehmen» (braucht E-Mail-Dienst)
- Weitere Rezepte einzeln über «Eigenes Rezept → Link» statt Massen-Import
- Bring!-Batch-Schnittstelle (`PUT bringlists/{uuid}/items`, ein Aufruf statt einer pro Artikel) → hebt das 45-Artikel-Limit auf
- Eigene Bilder für Artikel ohne Bring!-Bild (Bring!-API kann kein Hochladen; nur von Hand in der Bring!-App)
