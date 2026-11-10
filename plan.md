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
- [x] Redesign Plan-Ansicht + Navigation live (iPhone Glas / Android Material 3 Expressive)
- [x] Tests: App (jsdom), 2-Handy-Integration, Worker offline, `tools/check_live` (Kette), `tests/e2e_live` (echtes Bring!)

## Als Nächstes

- [ ] **Redesign Plan-Ansicht – prüfen**: `node tests/layout_check.mjs --shots` (390×844, 375×667, 390×600; iPhone/Android, hell/dunkel) und auf dem echten iPhone/Android ansehen
- [ ] Redesign für Einkauf, Rezepte & Saison, Einstellungen (folgt separat, gleiche Vorgabe)
- [x] **Ab Donnerstag die nächste Woche planen**: Chip «KW 47 →» in der Abschnittszeile (oder seitlich wischen), Tage zuerst «noch offen», Wochenwahl/Bring!/Kalender für die angezeigte Woche, am Montag wird sie zur laufenden

- [ ] **Joshua**: WG-Liste in Bring! mit `allmenbot@gmail.com` teilen, in der App unter Einstellungen → «Bring!-Liste der WG» wählen
- [x] **Design-Entscheid**: eigene Spezifikation (`docs/design/`) – iPhone Glas, Android Material 3 Expressive, Hellgrün + Pistazie; Plan-Ansicht + Navigation umgesetzt
- [ ] **Mehr Rezepte, von Hand geschrieben** (kein Scraping), je 4 Portionen, mit Saison:
  - **Salate als Hauptgang** (ohne zusätzlichen Beilagensalat): Feigen-Ziegenkäse-Rucola mit Baumnüssen (Aug–Okt), Nüsslisalat mit Ei, Speck und Croûtons (Okt–März), Randen-Linsen mit Feta und Apfel (Sep–März), Chicorée-Orangen mit Poulet (Nov–März), Kürbis-Quinoa mit Granatapfel (Sep–Dez, vegan), Wassermelone-Feta-Minze (Jun–Aug), Panzanella (Jul–Sep)
  - **Teigwaren**: Kürbis-Salbei-Penne (Sep–Dez), Carbonara (Jo: Champignons), Lauch-Rahm-Nudeln mit Schinken (Jo: Räuchertofu), Orecchiette mit Rosenkohl, Zitrone, Baumnüssen (Okt–Feb), Bolognese mit Rüebli (Jo: Vegi-Hack), Spinat-Ricotta-Penne (Frühling/Herbst), Cherrytomaten-Burrata-Pasta (Jun–Sep)
  - Regel: Salat-Rezepte bekommen `is_salad: true` → kein extra «Nüsslisalat / Saisonsalat» auf der Liste
- [ ] **Auswärts essen: bestellen oder abholen** – zwei neue Menüs
  - **🍕 Pizza bestellen** und **🥙 Döner holen** (später erweiterbar, z.B. Sushi)
  - Kauft nichts ein: keine Zutaten, kein Reste-Puffer, kein Beilagensalat (wie Resteessen)
  - Bring! bleibt unberührt; im Plan und Kalender als «🍕 Pizza bestellen» bzw. «🥙 Döner holen» mit Uhrzeit
  - Pro Person antippbar wie immer (wer isst mit); optional Notiz pro Person («Jo: vegi», «Lukas: scharf»), damit die Bestellung klar ist
  - Gehört zum Topf «⚡ schnell / ♻️ Reste» und kann so auch in der Wochenwahl auftauchen (die 2 schnellen Plätze)
- [ ] **Jeden Monat 2 neue Saison-Gerichte**
  - Je 1 vegi + 1 Fleisch, mit Gemüse, das in dem Monat Saison hat (VSGP-Liste), von Hand geschrieben (kein Scraping), 4 Portionen
  - Zum Monatsanfang in `standalone_data.js`, Feld `added: "2026-12"` → in der App als «Neu im Dezember» markiert und in der Wochenwahl bevorzugt (mind. 1 der beiden im Memory)
  - Ablauf: monatliche Erinnerung/Routine (z.B. geplanter Claude-Auftrag am 1. des Monats → Vorschlag als Commit, Joshua schaut drüber); Wünsche der WG fliessen ein
  - Startliste Dez–Feb: Rotkabis-Apfel-Gratin / Rindsvoressen mit Wintergemüse · Pastinaken-Risotto / Wirz-Capuns · Lauch-Quiche / Schweinsbraten mit Rosenkohl
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
- [ ] **Extras im Menü sichtbar** (Menü in der Wochenübersicht öffnen)
  - Unter den Rezept-Zutaten ein Block «Extras» mit allem, was die App dazurechnet, pro Person:
    - Vegi-Menü: «+ 150 g Speckwürfeli / Rindssteak für J, L, Le»
    - Fleisch-Menü: «+ 100 g Grillkäse für Jo» bzw. der Ersatz (z.B. «+ 150 g Vegi-Nuggets für Jo»)
    - Beilagensalat: «+ 50 g Salat pro Portion»; eigene Beilagen: «+ 80 g Salat für Jo», «+ 150 g Gemüse für Lukas»
  - Mengen gelten für die Esser **an diesem Tag** (wer weg ist, fällt raus); Kürzel wie im Plan
  - Im Plan pro Tag als kleine Zeichen sichtbar (🥩 / 🧀 / 🥗), damit man es ohne Öffnen sieht
  - Gleiche Zahlen wie auf der Einkaufsliste (eine Rechnung, zwei Ansichten)
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
- [ ] **Grundvorrat zählt mit** (nach dem Praxistest)
  - Pro Artikel «reicht für ca. N Znacht» (z.B. Olivenöl 500 ml ≈ 15, Bouillon ≈ 10, Tomatenpüree ≈ 4, Knoblauch ≈ 3); Salz, Pfeffer & Co. zählen nicht (halten Monate)
  - Jeder gekochte Tag, dessen Rezept den Artikel braucht (Zuordnung wie heute über `keywords`), zählt 1 ab; offene Tage und Resteessen nicht
  - Nicht speichern, sondern rechnen: Rest = N − gekochte Tage seit «zuletzt gekauft» → keine Konflikte zwischen den Handys
  - Vorschlag, wenn Rest ≤ 2 oder der Plan der Woche mehr braucht: «Olivenöl reicht noch für ~2 Znacht, geplant sind 4 → auf Bring!?» (ein Tipp, wie heute die Pille)
  - In Bring! gekauft/abgehakt = wieder voll; von Hand korrigierbar («noch voll» / «fast leer»)
- [ ] **Praxistest**: eine echte Woche mit Lukas, Leonie und Jo planen, einkaufen, Feedback sammeln
- [ ] Danach entscheiden: Mengen der Protein-Zusätze (150 g Fleisch / 100 g Käse pro Person), Rezeptauswahl, evtl. Koch-Zuteilung

## Später, nur wenn nötig

- Echte Kalender-Einladungen mit «Annehmen» (braucht E-Mail-Dienst)
- Weitere Rezepte einzeln über «Eigenes Rezept → Link» statt Massen-Import
- Bring!-Batch-Schnittstelle (`PUT bringlists/{uuid}/items`, ein Aufruf statt einer pro Artikel) → hebt das 45-Artikel-Limit auf
- Eigene Bilder für Artikel ohne Bring!-Bild (Bring!-API kann kein Hochladen; nur von Hand in der Bring!-App)
- Grundvorrat zusätzlich als eigene Bring!-Liste «Vorrat» im Bot-Konto (oben = haben wir, «Zuletzt verwendet» = fehlt), geteilt mit allen, auch ohne PWA. Bot gleicht per Cron (~10 Min.) ab: leer → Einkaufsliste, gekauft → wieder «da». Vorher eine Woche ohne Code testen (Liste von Hand anlegen und teilen). Siehe Entscheid #22
