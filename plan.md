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
- [x] Grundvorrat wie Bring!: gleiche Abteilungen/Artikel, antippen = auf Bring!, nochmals = weg; gemeinsam für die WG (abgelöst durch Variante C, 12.11.2026)
- [x] Jede Zeile der Einkaufsliste antippbar (auf/von Bring!), auch nach dem Füllen
- [x] Bot nimmt nur weg, was er selbst gesetzt hat; Gekauftes gilt wieder als «da»
- [x] «Bring! füllen»: Fehlendes einfach senden, bei schon Vorhandenem pro Artikel nachfragen (z.B. 2. Rezept mit Rahm), danach «Rückgängig»
- [x] Herunterziehen = sofort synchronisieren
- [x] Untere Navigation mit Icons (Plan · Einkauf · Rezepte & Saison · Einstellungen), Homescreen-Icon
- [x] Redesign Plan-Ansicht + Navigation live (iPhone Glas / Android Material 3 Expressive)
- [x] Tests: App (jsdom), 2-Handy-Integration, Worker offline, `tools/check_live` (Kette), `tests/e2e_live` (echtes Bring!)

## Rückmeldungen Joshua 12.11.2026 (Test v1.8/v1.9)

- [x] **Rezepte für alle WGs** (v1.9.0/1): ein Bestand für alle WGs; eigene Rezepte standardmässig geteilt (abwählbar «Mit allen WGs teilen»); Stimmen/Rangliste bleiben WG-intern. Herkunft wird nicht gezeigt, nur «geteilt»
- [x] **Bild kaputt in der Wochenwahl** (v1.9.1): Kartenbild nur als kleines Quadrat – Grundvorrat hatte die Klasse `.vimg` mitbenutzt; Test sichert ab
- [x] **iPhone: Zoom geht nicht zurück** (v1.8.0): Eingabefelder 16 px, Zusammenziehen erlaubt
- [ ] **iPhone ruckelt** – noch nicht gefunden; Joshua sagt, wo (Plan scrollen, Tag aufklappen, Tabs?)
- [x] **Einkauf nach Gericht** statt nach Abteilung (Obst, Milch …): pro Gericht in Plan-Reihenfolge, Tag davor; Gemeinsames (Salat, Extra-Fleisch) unter «Für mehrere Gerichte» (`groupByDish` in `core.js`)
- [x] **Rezepte nach Beliebtheit**: Katalog sortiert nach Stimmen eurer Wochenwahlen (WG-intern, Worker `/popular`, Zählung pro Woche bleibt 52 Wochen), ♥ n am Rezept; «Beliebt bei euch» im Menü-Blatt nutzt dieselben Stimmen
- [x] **Menüs verschieben** (einfache Fassung): im Menü-Blatt «Tauschen mit Mo/Di/…» – Gericht wandert, Esser/Gäste/Zeit bleiben am Tag, «Rückgängig»
- [ ] **Wochenplan-Übersicht mit Verschieben** (ausbauen): ganze Woche auf einen Blick, Gerichte per Ziehen verschieben – erst als HTML-Entwurf zeigen, wenn «Tauschen mit» nicht reicht
- [ ] **Einkauf: Bring! nur noch an einer Stelle** – heute kann man an 3 Stellen auf Bring! laden plus einzeln (Zeile antippen). Vereinfachen: ein Bring!-Knopf (Vorschlag Joshua: schwebender Knopf, z.B. unten links)
- [ ] **«Prüfen» ohne eigenen Reiter/Fenster**: die drei Bereiche (Kaufen aus dem Plan, Vorrat knapp, schon auf Bring!) übersichtlich auf **einer** Seite zusammen, als Vergleich wie bei einem Merge (Git, Sublime Merge): links/rechts bzw. oben/unten, was dazukommt und was schon da ist – farbig markiert, **ohne +/−-Zeichen**. Zuerst als HTML-Entwurf zeigen
- [ ] **Bot vergisst eben gesetzte Artikel**, wenn Bring! kurz noch den alten Stand liefert → kann sie nicht mehr wegnehmen (Rückgängig, Live-Test-Reste). Lösung muss «gekauft» (Bring! «recently») von «noch alt gelesen» unterscheiden (erster Versuch zurückgenommen, brach «gekauft und von jemand anderem neu eingetragen»)
- [ ] Bring!-Batch: ob Mengen ändern im Batch allein wirkt, ist offen (Live-Test zeigt «mixed», Ergebnis stimmt dank Nachschicken)

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
- [ ] **Bug melden** in den Einstellungen: ein Knopf, der direkt ein GitHub-Issue eröffnet, mit Bildschirmfoto
  - Issue über den WG-Server anlegen (GitHub-Token mit nur «Issues: schreiben» als Secret im Worker, nie in der App); App schickt Titel, Text, Version, Handy-Stil, aktuelle Seite, WG-Name (kein PIN)
  - Bildschirmfoto: der Browser darf den Bildschirm nicht einfach fotografieren (iPhone gar nicht). Darum: Foto/Screenshot aus der Galerie auswählen (Datei-Feld), der Worker lädt es ins Issue
  - Einfachste Stufe ohne Server: Knopf öffnet `github.com/jodbaer/BringFresch/issues/new` mit vorausgefülltem Titel/Text (Version, Seite); Foto hängt man dort selbst an (braucht GitHub-Konto)
  - Schutz: nur verbundene Handys (WG-PIN), höchstens ein paar Meldungen pro Stunde
- [x] **Hell / Dunkel / Automatisch** zum Umschalten (pro Handy, Einstellungen → Stil); heute folgt der Dunkelmodus nur dem System. Die 10 `prefers-color-scheme`-Stellen im CSS und `applyTheme` müssen auf den Schalter hören
- [x] **Gäste im Plan sichtbar**: «+1 Gast» bei den Kreisen (heute nur unter Einstellungen → Wer isst wann; die Zahl rechts zählt sie mit, man sieht aber nicht warum)
- [x] **Lange Zutatenliste macht den Plan winzig** (Bug): Dichte wird jetzt nach einem normalen Menü gewählt, lange Listen scrollen im offenen Tag
  - Offen, nach Praxistest: Salz, Pfeffer, Öl, Wasser in der Tagesansicht ausblenden («+ 4 Gewürze & Vorrat» antippen = zeigen)
- [x] **«Home-test» = Spielwiese**: wählbar für jede WG, die noch keine eigene Liste mit dem Bot verknüpft hat; gehört nie einer WG; die Test-Version schreibt ebenfalls hinein
- [ ] **Rezept mit der Kamera einlesen** (wichtig)
  - Ablauf: Rezepte → «📷 Foto» → Kochbuchseite / Zettel / Screenshot fotografieren (oder aus Galerie) → Titel, Personen, Zutaten werden ins bestehende Formular «Rezept von Hand» gefüllt → prüfen → Speichern (wie heute, eigene Rezepte der WG)
  - App: `<input type="file" accept="image/*" capture="environment">` (geht auf iPhone und Android ohne Kamera-Berechtigung), Bild im Handy verkleinern (~1600 px, JPEG) → an den WG-Server
  - Erkennen: Worker schickt das Bild an ein Bild-Modell (z.B. Claude mit Vision) mit fester Anweisung: «nur Titel, Portionen, Zutaten als JSON: Menge, Einheit, Name»; Antwort wird geprüft (Schema), dann wie beim Link-Import in Zutaten-Text umgewandelt
    - Alternative ohne KI-Dienst: Texterkennung im Handy (iOS Live Text: Text im Foto markieren → kopieren → ins Zutatenfeld einfügen) – geht heute schon, nur Anleitung im Formular nötig
  - Braucht: API-Schlüssel als Worker-Secret (nie in der App), Kostendach (z.B. max. 20 Bilder pro WG und Monat), nur verbundene WGs (PIN), Bild wird nicht gespeichert
  - Danach wie heute: Mengen für `servings`, Bring!-Katalog-Abbildung, Fleisch-Erkennung (Hackfleisch → «Fleisch»), Saison optional
  - Tests: Worker mit nachgebauter Modell-Antwort (kein Netz), UI-Schritt «Foto wählen → Formular gefüllt»; Live-Test nur von Hand
  - Offen: welcher Dienst/Modell, Kosten pro Bild, Handschrift unterstützen?
- [ ] **Grundvorrat neu gestalten – zusammen mit Joshua, nach dem Umbau** (Rückmeldung Joshua 11.11.2026, v1.7.0)
  - **Erste Fassung von Variante C gebaut (12.11.2026)**, auf der Test-Version: Mengen pro Artikel, Einkauf mit «Aus dem Vorrat – wird knapp», Bereich «Vorrat» als Liste (antippen = leer, «Woche gekocht», «Alles da» aufklappbar), «Prüfen» = Gegenüberstellung Kaufen | Vorrat, Grundvorrat als Seite mit Kacheln, Blatt, lange drücken (− + ✕), Inventur. Joshua testet und merkt an; Annahmen und Offenes (automatisch abbuchen ab Montag, Standard-Vorrat, echte Bring!-Bilder) in `docs/uebergabe-umbau.md` Abschnitt 4
  - **Wer**: Joshua baut den Grundvorrat mit einem **lokalen Chat** (Entscheid 11.11.2026). Laut Joshua war das Ändern im Grundvorrat schon vor v1.7.0 defekt – zuerst den heutigen Fehler nachstellen, dann neu gestalten
  - **Entwurf als Startpunkt**: `docs/design/grundvorrat-varianten.html` – drei klickbare Varianten (A «Merken» = erst mit «Bring! füllen» senden, B «Knopf» pro Artikel, C «Sammeln» und einmal bestätigen), iPhone/Android, hell/dunkel. Von einem Agenten entworfen und vorzeitig gestoppt; einmal im Browser geöffnet (keine Fehler, Variante A sichtbar), Varianten B und C nicht durchgeklickt. Nur Vorschlag, nichts entschieden
  - **Rückmeldung Joshua zum Entwurf** (Kommentare auf der Entwurfsseite, 11.11.2026) – Anforderungen für den Neubau:
    - **Entscheid Joshua 11.11.2026 spät: «Wir nehmen C»** (Entscheid in `entscheide.md`). Er braucht «noch ein paar Gedanken» – Einzelheiten vor dem Bauen mit ihm klären, nichts davon als fix behandeln. Einkauf im Entwurf jetzt mit den drei gewohnten Bereichen Kaufen · Auf Bring! · Vorrat.
    - Stand davor: Variante C war vorne, entschieden wurde erst nach den Verbesserungen. Der Entwurf (Variante C) zeigt sie jetzt: Menge pro Kachel, **drei Kacheln pro Zeile** (Joshua: so sieht man schneller, was leer wird und was noch da ist), Knappes zuoberst und gesammelt für Bring!, «Woche kochen» bucht ab, Abhaken in Bring! füllt um eine Packung auf, Vermerk «Vorrat · Menge» am Bring!-Eintrag, Markierung «über ein Jahr»
    - Weitere Kommentare eingebaut (11.11. abends): Schalter «Woche gekocht» mit Rückgängig; Aufteilung umstellbar Dringend / Abteilung (wie Bring!); «Verwalten» mit denselben Kacheln plus − + ✕; Stück mit Grösse («2 × 1 l»); Übersicht in einer Zeile. Übergabe: `docs/uebergabe-umbau.md`
    - Aufbau nach Joshuas Kommentar (11.11. spät): Knappes, «Diese Woche aus dem Vorrat» und der Schalter «Woche gekocht» stehen **vorne beim Einkauf** (ab Montag wird die letzte Woche von selbst abgebucht); **Vorrat und Verwalten sind zusammengelegt**; Wegnehmen = lange drücken → Karte dreht sich → Knopf; ein Blatt pro Artikel mit Bring!-Bild und allen Infos
    - **Standard-Grundvorrat aus Bring!-Standardartikeln** (Joshua: für gängige Haushalte, nur Katalog-Artikel) – Vorschlag im Entwurf, 50 Artikel, jeder einmal, alle mit Bring!-Bild:
      Früchte & Gemüse: Zwiebeln, Knoblauch, Kartoffeln, Karotten, Zitrone, Ingwer ·
      Milch & Käse: Milch, Butter, Eier, Rahm, Joghurt, Reibkäse, Parmesan ·
      Zutaten & Gewürze: Salz, Pfeffer, Bouillon, Aromat, Paprikapulver, Oregano, Zimt, Olivenöl, Öl, Essig, Balsamico, Senf, Ketchup, Mayonnaise, Sojasauce, Tomatenmark, Pelati, Zucker, Backpulver, Hefe, Vanillezucker, Speisestärke, Kokosmilch, Linsen ·
      Getreideprodukte: Mehl, Reis, Risottoreis, Pasta, Spaghetti, Haferflocken, Couscous, Kichererbsen ·
      Snacks & Süsswaren: Honig, Konfitüre, Schokolade · Getränke: Kaffee, Tee.
      Heute (`pantry_staples` in `standalone_data.js`) heissen viele Einträge anders als in Bring! («Speisesalz / Jodsalz», «Thomy Senf») und zeigen deshalb doppelt auf denselben Artikel – beim Neubau durch diese Liste ersetzen (bestehende WGs: zusammenführen statt überschreiben)
    - «Alles da» ist **schon beim Einkauf aufklappbar** und zeigt jeden Artikel mit Menge
    - «Knapp» braucht eine Regel pro Artikel: 2 oder weniger, aber bei Artikeln mit nur 1–2 Packungen erst unter einer vollen Packung (sonst ist die halbe Liste dauernd knapp – im Entwurf so gelöst)
    - **Doppelte zusammenführen auch in Bring!?** (Frage Joshua) Standardartikel gibt es auf Bring! nur einmal, dort ist nichts doppelt. Stehen zwei verschiedene Namen auf der Liste (z.B. «Sojasauce» und eigener Artikel «Soja Sauce»), kann der Bot den einen wegnehmen und die Menge beim anderen ergänzen – aber nur, wenn er den Eintrag selbst gesetzt hat («Bot löscht nur Eigenes»). Fremde Einträge bleiben, die App kann nur darauf hinweisen
    - Kommentare 11.11. nachts, im Entwurf eingebaut: Bereich «Vorrat» beim Einkauf als **Liste** (antippen = leer, durchgestrichen) mit «Diese Woche gebraucht» und Vorschlägen «geht oft aus» (Vermerk am Artikel, später Muster nach ein paar Wochen erkennen); **Gegenüberstellung** Kaufen | Vorrat zum Antippen, bevor etwas auf Bring! geht; Karten-Rückseite mit − + und kleinem ✕, ohne Zurück-Knopf (lange drücken = direkt ändern)
    - **Inventur** statt «Bereinigen»: wie im Betrieb einmal im Jahr alles durchgehen; der Knopf darf versteckt sein: **ganz am Ende der Artikel im Grundvorrat** (so im Entwurf) oder in den Einstellungen; meldet sich, wenn fällig
    - Noch offen (Vorschlag im Entwurf, nicht entschieden): Einheiten nur Stück und «reicht für N Znacht» (keine Gramm / Milliliter); Knappes geht nie von selbst auf Bring!, sondern gesammelt nach «Prüfen»
    - Ursprünglicher Kommentar: eine Variante gefällt «fast am besten». Bedienung gefällt; die **Übersicht über alles** noch nicht: «jedes Element ist für sich geschlossen»
    - **Menge sichtbar**: die Verwaltung zeigt pro Artikel, wie viel noch da ist – in Znacht-Einheiten oder g / ml / Stück
    - Klar zeigen, **wie ein Artikel voll wird und wie er sich leert** (heute im Entwurf unklar, auch beim Bearbeiten)
    - **Bereinigungs-Modus**: alles einmal der Reihe nach durchgehen (Menge bestätigen / korrigieren)
    - **Drei Spalten** und sichtbar: was **knapp** wird, was **diese Woche gebraucht** und abgebucht wird
    - **Ab 2 Stück Rest**: wieder auf Bring! setzen. **In Bring! gekauft** → Vorrat mit der gekauften Anzahl auffüllen
    - Vorrat-Artikel sind auf Bring! **als solche erkennbar** (Vermerk am Bring!-Eintrag)
    - **Über 1 Jahr im Vorrat**: anmerken
    - Technisch zu klären: Bring! meldet nur «nicht mehr auf der Liste», nicht wie viel gekauft wurde → Menge aus der Mengenangabe des Eintrags nehmen oder kurz nachfragen. Vermerk am Bring!-Eintrag geht nur über die Mengenangabe (z.B. «Vorrat · 2 Stk»), ein eigenes Feld gibt es nicht. «Seit wann im Vorrat» wird heute nicht gespeichert → Datum ab Einführung mitführen
  - **Was nicht gefällt**: Die Verwaltung schreibt beim Antippen **direkt auf Bring!**; auch **Hinzufügen und Wegnehmen** sind so nicht gut
  - **Vorgehen**: nichts im Alleingang bauen. Zuerst 2–3 Varianten als HTML zum Antippen zeigen (Design-Fragen entscheidet Joshua selbst), dann bauen. Erst nach dem Umbau von `app.js` (Schritte 3 und 5 in `docs/refactoring-plan.md`), damit die Ansicht nur einmal angefasst wird
  - **Zu klären** (Fragen an Joshua, nicht vorentscheiden):
    - Soll «leer» zuerst nur in BringFrisch gemerkt werden und erst mit «Bring! füllen» auf die Liste kommen (mit Nachfragen und «Rückgängig» wie beim Plan)? Oder ein eigener, klar beschrifteter Knopf «auf Bring!» pro Artikel?
    - Verwalten (hinzufügen, wegnehmen, umbenennen) getrennt vom täglichen «ist leer» – eigener Bearbeiten-Modus?
    - Wie viel soll man auf einen Blick sehen: alle ~45 Pillen oder nur «bald leer / leer» und der Rest eingeklappt?
  - **Im Bild aufgefallen** (heutiger Stand, als Aufgabe für den Neubau): mehrere Vorrat-Einträge zeigen denselben Bring!-Namen und stehen darum doppelt da – Kartoffeln ×2, Zwiebeln ×2, Butter ×2, Pfeffer ×2, Reis ×2; dazu «Sojasauce» und «Soja Sauce» (eigener Artikel). Zusammenführen bzw. beim Hinzufügen verhindern
  - **Berührt**: Fachregel «Grundvorrat wie Bring!: Antippen = direkt auf Bring!» in `CLAUDE.md`, Entscheid 16 (Pillen klein, durchgestrichen) und die Punkte «Leer melden» / «Wegnehmen» im nächsten Eintrag – alle erst nach Joshuas Entscheid anpassen
- [ ] **Grundvorrat verwalten** (besser als heute) – grösstenteils mit Variante C gebaut (Hinzufügen mit Bring!-Vorschlag, «ist schon da», lange drücken = ✕ mit Rückgängig, Mengen); offen: Standard-Vorrat für neue WGs
  - **Hinzufügen**: Eingabe schlägt Bring!-Artikel vor (Autokorrektur auf den Bring!-Namen, z.B. «Olivenoel» → «Olivenöl», mit Bild); nicht doppelt (gleicher Bring!-Artikel schon im Vorrat → «Ist schon da»)
  - **Nicht gefunden**: Hinweis «Gibt es in Bring! nicht – bitte zuerst in Bring! als eigenen Artikel anlegen», dann erneut suchen
  - **Wegnehmen**: kein ✕ dauernd sichtbar (verklickt man sich). **Lange drücken** auf die Pille → ✕ erscheint (Pille wackelt) → ✕ antippen = weg, mit «Rückgängig»
  - **Leer melden**: wie heute antippen = auf Bring!; klar sichtbar, welcher Bring!-Artikel es ist (Bild + Bring!-Name)
  - **Standard-Vorrat für jede neue WG** mit Grundzählung («reicht für N Znacht», z.B. Olivenöl 15, Bouillon 10, Reis 6, Teigwaren 6, Tomatenpüree 4, Rahm 2, Joghurt 4)
  - **Zahl von Hand anpassen** beim Durchgehen des Vorrats (lange drücken → «noch für 3»), z.B. Joghurt passt in kein Rezept und zählt nur von Hand
  - **Ab 2 oder weniger**: Pille hervorgehoben («bald leer») oben im Grundvorrat, Vorschlag «auf Bring!?» (ein Tipp, nichts automatisch)
  - **Bald leer – wie es zählt**: siehe «Grundvorrat zählt mit» oben (jeder gekochte Tag, dessen Rezept den Artikel braucht, zählt 1 ab; Rest = N − gekochte Tage seit «zuletzt gekauft»)
- [ ] **Emoji als Namenkürzel**: lange auf den eigenen Kreis/Namen drücken → Emoji wählen (z.B. 🦊) statt «J»; gilt für die ganze WG (in den Einstellungen gespeichert)
- [ ] **«Wer bin ich» nur in den Einstellungen**: die Auswahl «Ich bin» in der Wochenwahl weg; die Wochenwahl nimmt «Du bist» aus den Einstellungen (fehlt es, einmal fragen). Ein Handy für mehrere Personen: dann dort wechseln
- [ ] **Sprache Deutsch / English** vorbereiten: alle Texte in `static/i18n.js` (Schlüssel → de/en), Auswahl pro Handy unter Einstellungen → Stil, Standard nach Handy-Sprache; Rezepte/Zutaten bleiben deutsch (Bring!-Namen)
- [x] **«Aktualisieren» bei der Version** unter «Über BringFrisch» statt ganz oben in den Einstellungen
- [x] **Wochenwahl mit Bildern**: Vorschaubild der Rezeptseite, einmal vom WG-Server geholt und abgelegt (nur mit PIN), auf dem Handy zwischengespeichert
- [ ] **Wochenwahl wie Memory**: Karte zeigt nur das Bild (+ kurzer Titel unten); antippen = Karte dreht sich (3D-Flip) → Rückseite: ganzer Titel, Vegi/Fleisch, Minuten, Wunschtag, «Wählen» / «Abwählen», 🌐 Rezept; nochmals antippen (oder ✓) = zurück aufs Bild, gewählte Karten mit Häkchen und Rahmen. Ohne Bild: Vorderseite mit Gemüse-Bild/Farbe. Zuerst als HTML-Vorschau zeigen (Joshua wählt)
- [x] **Gratis-Kontingent des WG-Servers schonen** (Cloudflare KV: 1000 Schreib-/Listen-Aufrufe pro Tag fürs ganze Konto): Wochenwahl listet keine Schlüssel mehr, fragt alle 30 s statt 15 s und nur bei offener App
  - Offen: Tests der Test-Version (Live-Test bei jedem Push) zählen mit – bei vielen Pushes am selben Tag knapp; notfalls Live-Test nur 1× pro Tag
- [ ] **Praxistest**: eine echte Woche mit Lukas, Leonie und Jo planen, einkaufen, Feedback sammeln
- [ ] Danach entscheiden: Mengen der Protein-Zusätze (150 g Fleisch / 100 g Käse pro Person), Rezeptauswahl, evtl. Koch-Zuteilung

## Später, nur wenn nötig

- Echte Kalender-Einladungen mit «Annehmen» (braucht E-Mail-Dienst)
- Weitere Rezepte einzeln über «Eigenes Rezept → Link» statt Massen-Import
- Bring!-Batch-Schnittstelle (`PUT bringlists/{uuid}/items`, ein Aufruf statt einer pro Artikel) → hebt das 45-Artikel-Limit auf
- Eigene Bilder für Artikel ohne Bring!-Bild (Bring!-API kann kein Hochladen; nur von Hand in der Bring!-App)
- Grundvorrat zusätzlich als eigene Bring!-Liste «Vorrat» im Bot-Konto (oben = haben wir, «Zuletzt verwendet» = fehlt), geteilt mit allen, auch ohne PWA. Bot gleicht per Cron (~10 Min.) ab: leer → Einkaufsliste, gekauft → wieder «da». Vorher eine Woche ohne Code testen (Liste von Hand anlegen und teilen). Siehe Entscheid #22
