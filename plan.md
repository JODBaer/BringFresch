# Obsonare – Plan

Ziel: Tool für **unsere WG**, einfach zu benutzen. Erst mit der WG testen, dann erweitern.
Grundsatz: **Bring! ist die Wahrheit** für die Einkaufsliste – Obsonare baut nur drumherum. **Grundvorrat, Plan und Wochenwahl** sind die Wahrheit von Obsonare (gemeinsam im WG-Server).

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
- [ ] **Einkauf-Entwurf, Entscheide Joshua 13.11.**: Bring!-Knopf **unten rechts**; fremde Einträge mit Menge ergänzen **vorgewählt**; Knopf = die drei Reiter laufen als Spalten zusammen und **verschmelzen** (Animation) zur Übersicht «Prüfen»; Übersicht **kompakt** (eine Zeile pro Artikel); in allen drei Reitern bleibt jede Zeile **einzeln antippbar**, aber nur vormerken (Kaufen = haben wir schon, Auf Bring! = Bot-Eintrag kommt weg, Vorrat = für Bring! vormerken) – gesendet wird nur über den Knopf. Abstände/Listenstil wie in der App v1.10 (eine Karte, nur Trennlinien – Joshua mag die kleineren Abstände), nicht wie im ersten Entwurf. «Prüfen» = drei Spalten wie die Konfliktansicht in Sublime Merge (Joshua 13.11., Screenshot): links Plan braucht, Mitte Bring! (umschaltbar «Bring! jetzt» / «nachher» wie Base/Merged), rechts Vorrat; jede Zeile eine Zutat, keine Zeilennummern; ▶ / ◀ = kommt in die Mitte; oben «Abbrechen» · «Senden». Offen: Mitte zuerst «nachher» oder «jetzt»; ob jedes Handy Rezept/Kategorie merkt. **Neuer Entwurf 13.11. (massgebend): `docs/design/einkauf-sublime.html`** (Reiter bleiben wie v1.10, bei «Auf Bring!» geht nur der Aktiv-Balken über alle drei und darunter stehen alle Zutaten in drei Spalten; Rückgängig neben Senden; Vorrat-Reiter und Grundvorrat wie Variante C in `docs/design/grundvorrat-varianten.html` – gefällt Joshua) – neu ab der Einkauf-Seite v1.10; die drei Reiter werden beim Prüfen selbst zu drei echten Spalten (Kaufen | Auf Bring! | Vorrat), Farben vom alten Entwurf
- [x] **Kaufen + Vorrat nach Entwurf `docs/design/einkauf-sublime.html` gebaut** (13.11.): Liste ohne Kasten, Reiter mit Trennstrichen/runder Pille, Umschalter Rezept/Kategorie, Wischen, Vorrat mit gleichen Abschnitten, «Woche gekocht» oben, Zeile antippen = Blatt. Offen: «Auf Bring!» (Farbvariante wählen), ein Bring!-Knopf mit 10 s Rückgängig, Titel weg
- [ ] **Einkauf: Umschalter «nach Rezept / nach Kategorie»** (Kategorie = wie in Bring!: Früchte & Gemüse, Milch & Käse …), gilt für Einkauf und Prüfen (Kommentar Joshua 13.11. im Entwurf). Ein Artikel, den mehrere Rezepte brauchen (Rahm aus 3 Rezepten), bleibt **ein** Bring!-Eintrag mit der Gesamtmenge; «nach Rezept» steht er bei jedem Gericht mit seinem Anteil («zusammen 6 dl · Di, Do, Fr»), einen Anteil abwählen zieht nur diesen ab. Heute (v1.10.0) steht er nur unter «Für mehrere Gerichte». Entwurf: `docs/design/einkauf-pruefen.html`
- [ ] **Wochenplan-Übersicht mit Verschieben** (ausbauen): ganze Woche auf einen Blick, Gerichte per Ziehen verschieben – erst als HTML-Entwurf zeigen, wenn «Tauschen mit» nicht reicht
- [ ] **Einkauf: Bring! nur noch an einer Stelle** – heute kann man an 3 Stellen auf Bring! laden plus einzeln (Zeile antippen). Vereinfachen: ein Bring!-Knopf (Vorschlag Joshua: schwebender Knopf, z.B. unten links)
- [ ] **«Prüfen» = eine Seite mit allem**: die drei Reiter (Kaufen · Auf Bring! · Vorrat) bleiben wie sie sind (Joshua: «ganz gut»). Erst beim Tippen auf «Prüfen» kommen die drei Bereiche (Kaufen aus dem Plan, Vorrat knapp, schon auf Bring!) übersichtlich auf **eine** Seite zusammen, als Vergleich wie bei einem Merge (Git, Sublime Merge): links/rechts bzw. oben/unten, was dazukommt und was schon da ist – farbig markiert, **ohne +/−-Zeichen**. Zuerst als HTML-Entwurf zeigen
- [ ] **Bot vergisst eben gesetzte Artikel**, wenn Bring! kurz noch den alten Stand liefert → kann sie nicht mehr wegnehmen (Rückgängig, Live-Test-Reste). Lösung muss «gekauft» (Bring! «recently») von «noch alt gelesen» unterscheiden (erster Versuch zurückgenommen, brach «gekauft und von jemand anderem neu eingetragen»)
- [ ] Bring!-Batch: ob Mengen ändern im Batch allein wirkt, ist offen (Live-Test zeigt «mixed», Ergebnis stimmt dank Nachschicken). Live-Beweis in `stage_live.mjs` eingebaut (16.11.): 60 Artikel in einem Durchgang + Zeile «INFO Batch-Mengen: wirkt allein / braucht Nachschicken» im Log von `stage.yml`. Ergebnis Live-Lauf 16.11. (stage.yml, grün): 60 Artikel in einem Batch gesetzt (ok, Modus batch); Mengen per Batch ändern braucht Nachschicken (mixed, Endergebnis stimmt); Wegnehmen von 60: erster Aufruf nur 45, Rest im zweiten Aufruf

## Rückmeldungen Joshua 27.11.2026 (Test-App)

- [x] Ordnen/Filter im Reiter Rezepte unübersichtlich → eine umbrechende Chip-Reihe, «✕ Filter aus» (#27)
- [x] Rezepte anderer WGs fehlen in der Test-App → Test-Server liest die geteilten Rezepte des WG-Servers mit, nur lesend (#28)
- [x] «Holen» bei gemuese.ch → Worker liest Zutaten, Personen und Zeit aus dem HTML (wie der Import)
- [x] Zurück von der Rezeptseite: kopierter Link steht schon im Feld, nur noch «Holen» (iPhone: ein Knopf «Kopierten Link einfügen & holen»)
- [ ] **«KI-App öffnen» und «Bring! öffnen» gehen noch nicht** – im Plan platzieren (Joshua 27.11.): Lieblings-KI ist wählbar, aber noch nichts öffnet sie (kommt mit Schritt 5 «Foto mit KI» / Reste-Rezept); «Bring! öffnen» führt auf die Webseite statt in die App. Beides als Knopf im Plan, am ehesten in der «Nächster Schritt»-Karte (Schritt 2): nach «Bring! füllen» → «Bring! öffnen», am Kochtag / bei Resten → «Mit KI kochen». Vorher prüfen, ob Bring! eine App-Adresse hat, die auf iPhone und Android die App öffnet.
- [x] Plan (#29): Gericht antippen = aufklappen, wechseln nur aufgeklappt («Wechseln» / nach links wischen), Verschieben löst kein Aktualisieren aus · Rezepte ohne Link = Google-Suche · Vormerken pro Zeile (Käse) · Farben (#32)
- [ ] **Eigene Rezepte müssen anpassbar sein** (Joshua 27.11.): überall, wo ein eigenes Rezept erscheint (Karte im Reiter Rezepte, Menü-Blatt, Plan-Tag aufgeklappt, Wochenwahl-Rückseite), ein Knopf «✏️ Anpassen» → Formular mit allem (Titel, Personen, Zutaten, Zeit, Zubereitung, Ernährung, «Mit allen WGs teilen»). Änderungen gelten sofort im Plan und in der Einkaufsliste (wie heute unter «Meine Rezepte → Bearbeiten», das ganz unten versteckt ist). Rezepte anderer WGs und aus dem Katalog: «Anpassen» = eigene Kopie (gibt es schon im Katalog). Teil von Schritt 3 «Rezept-Seite»; vorher als HTML-Entwurf zeigen.

## UX: einfach von Anfang an (Plan 25.11.2026, Joshua)

**Auf einen Blick** (kurz, Bild: `docs/design/obsonare-einfach-ueberblick.html`) – 8 Änderungen, eine nach der anderen:

| # | Was | Heute | Neu | Wann |
|---|---|---|---|---|
| 0 | Einfache Rezepte | Kochbuch-Rezepte, 9–15 Zutaten | 8 Alltags-Gerichte, Gemüse vom Monat kommt von selbst | **jetzt** |
| 1 | Erster Start | WG-Name + PIN abtippen, Bring! versteckt | Link aus WhatsApp → Namen antippen → fertig | vor WG-Test |
| 2 | Was jetzt? | Pop-up, Punkte, Hinweise überall | eine Karte oben im Plan | vor WG-Test |
| 3 | Rezepte wie ein Buch | Liste | blättern, je Rezept: Einplanen · Senden · Kochen | nach WG-Test |
| 4 | Rezept senden | geht nicht | an Mitbewohner: Meldung oder WhatsApp | nach WG-Test |
| 5 | Einlesen | nur Link, versteckt | ein «+»: Link, Text, Foto, Reste – mit Lieblings-KI | nach WG-Test |
| 6 | Kochen | Link öffnen, selber rechnen | Zutaten für heute, abhaken, Timer, Tablet | nach WG-Test |
| 7 | Einstellungen | eine lange Seite | oben Du · WG · Bring!, Rest unter «Mehr» | nach WG-Test |

Jeder Schritt: Entwurf → Joshua sagt ja → bauen → jemand testet.

Ziel: Wer Obsonare zum ersten Mal öffnet, muss **nichts suchen und nichts erklären lassen**. Der Weg der WG ist immer derselbe – **stöbern → wählen → planen → einkaufen → kochen** – und die App zeigt jederzeit genau den nächsten Schritt. Vorbild: ein schönes Kochbuch, aus dem die Einkaufsliste von selbst fällt (siehe «Von Paprika lernen»).

### Leitsätze (gelten für jeden neuen Bildschirm)
1. **Ein nächster Schritt.** Jede Seite hat genau einen Hauptknopf; alles andere ist kleiner oder unter «Mehr».
2. **Nichts suchen.** Jede häufige Aufgabe ist vom Start aus mit höchstens 2 Tipps erreichbar (Rezept einplanen, Bring! füllen, heute kochen, Rezept senden).
3. **Vorschlagen statt fragen.** Die App füllt aus, was sie weiss (Tag, Portionen, Esser, Liste); man korrigiert nur.
4. **Sprache der WG.** «Znacht», «Wer isst mit?», «Auf Bring!» – keine Technik («Server», «Sync», «PIN» nur wo nötig).
5. **Ein Ding pro Bildschirm.** Blätter (unten) für kurze Entscheide, ganze Seiten für Lesen/Kochen.
6. **Küche mitgedacht.** Grosse Schrift und Ziele, Bildschirm bleibt an, Tablet quer = zwei Spalten.

### Momente der WG (für wen wir gestalten)
- **Neu dabei** (Leonie bekommt einen Link): in 1 Minute drin, ohne PIN abtippen.
- **Planer am Sonntag** (Joshua): Wochenwahl anstossen, Plan übernehmen, Bring! füllen – 3 Tipps.
- **Stöbern auf dem Sofa**: im Buch blättern, «das will ich», an jemanden senden.
- **Im Laden**: Bring! ist die Liste (Obsonare nicht nötig).
- **In der Küche** (Handy oder Tablet): Zutaten für heute, abhaken, Timer, Rezept daneben.

### Schritte (je zuerst HTML-Entwurf → Joshua entscheidet → bauen → eine Person testet ohne Hilfe)

- [ ] **0. Einfach & saisonal – Grundrezepte × Saisongemüse** (zuerst, Joshua 25.11.: «es hat mir keine simplen Rezepte, es ist halt schon sehr saisonal – was auch das Ziel sein soll»)
  - Befund (Katalog 25.11.): 225 Rezepte, im November 159 in Saison, davon nur 48 «einfach» (≤ 8 Zutaten ohne Salz/Pfeffer/Öl/Wasser, ≤ 30 Min.), und die 13 Schnellen darunter sind kaum saisonal. Die importierten Rezepte haben meist 9–15 Zutaten und klingen nach Kochbuch. Joshuas Alltagsgerichte gibt es nur einzeln (Ghackets mit Hörnli) oder gar nicht (Poulet-Rahmsauce mit Reis, Gemüsepfanne mit Reis, schlichtes Ofengemüse).
  - **Joshuas Alltag** (seine Liste 25.11.) = die ersten 8 **Grundrezepte**, je von Hand geschrieben (kein Scraping), für 4 Personen, ≤ 8 Zutaten, ≤ 30 Min. Arbeit; das **Saisongemüse setzt die App ein** (Gemüse des Monats aus `season_items`, pro Grundrezept nur passende Sorten):
    1. **Hörnli & Ghacktes** mit Saisongemüse (Nov: Lauch · Sommer: Zucchetti · Frühling: Erbsen/Spinat), Apfelmus; vegi: Linsen oder Planted-Hack
    2. **Maultaschen oder Gnocchi aus der Pfanne** mit Saisongemüse (Nov: Rosenkohl/Kürbis · Frühling: Spargel · Sommer: Tomaten/Zucchetti), Butter-Salbei oder Tomatensauce; vegi = Gemüse-Maultaschen/Gnocchi
    3. **Ofengemüse vom Blech** mit 2–3 Saisongemüsen + Kartoffeln, Kräuterquark; Fleisch: Pouletschenkel oder Würste mit aufs Blech; vegi: Halloumi/Feta
    4. **Reis mit Curry oder Rahmsauce** – eine Pfanne, zwei Saucen (Kokos-Curry / Champignon-Rahm), Saisongemüse hinein; Poulet, vegi: Kichererbsen/Tofu
    5. **Gemüsepfanne mit Reis** (Wok): 2 Saisongemüse, Sojasauce, Ei; Fleisch: Poulet- oder Rindsstreifen, vegi: Tofu/Ei
    6. **Café complet** (Joshua 25.11.; gibt es schon als «Schnelles», wird Grundrezept): Brot, Butter, Käse, Konfi, Milchkaffee + **Saisonfrüchte** (Nov: Äpfel/Birnen · Sommer: Beeren/Aprikosen); Fleisch: Trockenfleisch/Schinken dazu; kein Salat (`no_salad`)
    7. **Arme Ritter** (Joshua 25.11.) mit Saison-Kompott (Nov: Apfel/Birne · Sommer: Beeren/Zwetschgen); vegi, kein Extra-Fleisch (`no_addons`), kein Salat
    8. **Käseschnitte** (Joshua 25.11.; Toast Hawaii gibt es schon als «Schnelles», wird Grundrezept): klassisch mit Schinken + Ananas, saisonal mit Lauch, Pilzen oder Tomate; vegi ohne Schinken, Salat dazu
  - **Mix in der WG läuft schon**: Grundrezepte sind vegi, «Alles für alle» legt pro Fleisch-Esser 150 g Fleisch dazu (bei Hörnli/Curry/Pfanne als eigenes Fleisch statt Grillkäse: Feld `meat_addon` pro Grundrezept, z.B. Ghacktes, Poulet).
  - **Technik**: Grundrezepte in `standalone_data.js` (`bases`: Titel-Vorlage «Hörnli & Ghacktes mit {Gemüse}», Grundzutaten, Platz für 1–3 Gemüse mit Menge, passende Sorten, `meat_addon`). `CORE.expandBases(bases, month)` macht daraus gewöhnliche Rezepte (Ids `b-<grundrezept>-<gemüse>`, `simple: true`, `season_months`) – Wochenwahl, Plan, Einkauf und Bring! arbeiten unverändert. Tests: jedes Monat ergibt pro Grundrezept ≥ 1 Variante, keine Zutat doppelt, Mengen für 4.
  - **Wochenwahl**: mindestens **5 der 14** Karten «einfach» (Joshua 25.11.: «5 oder 4») (`simple` oder ≤ 8 Zutaten und ≤ 30 Min. **aktiv** – Ofen-/Kochzeit daneben zählt nicht, Joshua 25.11.; überall «15 Min. aktiv · 55 Min. total», neues Feld `active_min` neben `prep_time_min` = total; Import liest `prepTime` aus schema.org, ohne Angabe gilt total), die Aufwändigen mit ihrer Zeit markiert: «> 1 h», «> 1,5 h», «> 2 h» (Joshua 25.11., statt «Wochenende»); «Schnelles» bleibt, 2 pro Woche (Joshua 25.11.). **Rezepte**: Filter «Einfach» ganz vorne, Karten zeigen «6 Zutaten · 25 Min.».
  - Danach: weitere Grundrezepte aus der Praxis (Suppe, Wähe, Risotto, Frittata, Gratin, Rösti), je nur wenn die WG sie wirklich kocht.
  - Entwurf: `docs/design/einfach-saisonal-entwurf.html` (Rezepte «Einfach im November» mit 8 Karten, Gemüse pro Karte wählbar; Wochenwahl mit «einfach» und Zeit-Abzeichen).
- [x] **Review Joshua 25.11. (Test-App nach Schritt 0)** (erledigt 27.11.: Mitbewohner kompakt, Lieblings-KI, Plan verschieben per lange drücken + ziehen) – Entwurf `docs/design/review-2511-entwurf.html`
  - **Rezepte = «Alle Rezepte»**: der Reiter sieht genau aus wie «Alle Rezepte» – Karten **3 pro Zeile**, Abschnitte **ausklappbar** (Einfach im November offen, Eigene, Swissmilk, Fooby, Betty Bossi, Migusto, Schnelles …), Karte antippen = umdrehen, Tag = einplanen. «Einfach im November» ist der erste Abschnitt (statt eigener 2er-Kacheln).
  - **«+ Einfügen» immer sichtbar** oben neben dem Titel → Blatt Link · Text · Foto mit KI · Von Hand (Foto mit KI = Schritt 5, bis dahin sichtbar mit Hinweis). «Rezept suchen», «Rezepte holen» und Saison-Liste nach unten bzw. ins «+».
  - **Einstellungen → Mitbewohner kompakt**: alle in einer Liste, pro Zeile Bubbles mit Piktogrammen 🥩 🥦 🌱 · 💪 🪶 (antippen = an/aus), Namen antippen = umbenennen/entfernen, «+ Mitbewohner» unten. Allgemein mehr Piktogramme, kompakt.
  - **Rezepte bleiben Rezepte** (Joshua 25.11., ersetzt die Varianten-Karten aus Schritt 0): alle Rezepte haben denselben Aufbau; «Hörnli & Ghacktes» ist **ein** Rezept, nicht fünf. Saisonal wird es durch ein **Add-on «Saison»** (🥬 + Lauch im November): pro Rezept eine Liste passender Gemüse/Früchte mit Monaten, die App wählt jeden Monat selbst, im Plan änderbar (gespeichert am Tag, Einkauf nimmt die Zutaten des gewählten Add-ons). Die anderen Zusätze (Extra-Fleisch, Vegi-Ersatz, Salat) werden genauso Add-ons. Umbau: `bases` → normale Rezepte mit `addons`, Ids `b-<grundrezept>` (alte `b-<grundrezept>-<variante>` im Plan weiter lesbar), «Einfach im November» = erster Abschnitt in Rezepte, keine eigene Kachel-Ansicht.
  - **Lieblings-KI** in den Einstellungen unter «Du» (Joshua 25.11.): ChatGPT · Claude · Gemini · andere, pro Handy.
  - **Plan**: Rezept antippen = Tag klappt auf (wie der Tag); **lange drücken = heben und wackeln, auf anderen Tag ziehen = tauschen** (wie Apps auf dem iPhone-Homescreen; `swapDishes`, Esser/Gäste bleiben am Tag), danach «Rückgängig». **Nur diese Funktion ändern** (Joshua): das Gericht wandert unverändert (Link, Zutaten, Add-on), sonst bleibt der Plan wie er ist.
- [x] **1. Erster Start in 3 Schritten** (vor dem Praxistest) – gebaut 27.11.: Einladungslink (PIN nur verschlüsselt beim WG-Server, 7 Tage), «Wer bist du?» als Kacheln, «Bring! verbinden» nur ohne Liste (Weg A), «Hoi …» mit der ersten Woche. **Noch offen**: QR-Code, «Neue WG gründen» in der App (heute `tools/new_wg.mjs`), ob der Bot Einladungen selbst annehmen kann.
  - **Einladungslink** statt WG-Name + PIN abtippen: in den Einstellungen «Mitbewohner einladen» → Link/QR (`…/#join=<wg>.<code>`, Code = PIN-Hash-Ticket, läuft nach 7 Tagen ab) → per WhatsApp senden. Wer ihn öffnet, landet direkt bei «Wer bist du?». Abtippen bleibt als Weg «Ich habe WG-Name und PIN».
  - **Wer bist du?** = Kacheln mit den Namen der WG (ein Tipp), «Ich bin neu» = Name + Vegi/Fleisch.
  - **Bring! verbinden** nur, solange die WG noch keine Liste hat (sonst «Bring! ist verbunden ✓ Liste «WG»»): Bildschirm mit 3 nummerierten Schritten und Knopf «Adresse kopieren» (`allmenbot@gmail.com`), «Bring! öffnen»; die App fragt alle paar Sekunden nach und wählt die Liste selbst, sobald der Bot sie sieht. **Abklären vor dem Entwurf:** kann der Worker eine Einladung im Bot-Konto selbst annehmen (Bring!-API)? Wenn nicht: Bot legt die Liste selbst an und lädt die Mitbewohner ein (sie nehmen in ihrer eigenen Bring!-App an), oder die erste Person nimmt einmalig im Bot-Konto an (heute). Ziel: **niemand muss sich ins Bot-Konto einloggen.**
  - Fortschritt oben als 3 Punkte, jeder Schritt überspringbar («Später»), nichts davon wieder fragen.
- [ ] **2. «Nächster Schritt»-Karte im Plan**: oben eine Karte, die je nach Stand wechselt – «Wochenwahl starten» → «2 von 4 haben gewählt · anstupsen» → «Plan übernehmen» → «Bring! füllen (12 Sachen)» → am Kochtag «Heute: Kürbis-Risotto · Kochen». Ersetzt verstreute Hinweise (Pop-up, roter Punkt, Chips). Erste Woche zusätzlich ein kurzer Satz, was als Nächstes passiert.
- [ ] **3. Rezepte = ein Buch** (Reiter «Rezepte» neu ordnen)
  - Oben drei Einstiege: **Stöbern** (Buch, Saison zuerst) · **Meine** (eigene + geteilte) · **Saison** (Gemüse des Monats). Suche immer oben («Lauch», «schnell», «vegi»).
  - **Buchansicht**: eine Doppelseite pro Rezept (Handy: eine Seite), Wischen = blättern, grosses Bild, Titel, Zeit, Vegi/Fleisch, Saison. Tablet quer = links Bild, rechts Zutaten.
  - **Rezept-Seite** (aus Buch, Wochenwahl, Plan, Katalog – überall dieselbe): Zutaten schon für eure Portionen, darunter drei Knöpfe: **Einplanen** (Tag Mo–So, angezeigte Woche) · **Senden** · **Kochen**; klein «Rezept auf fooby.ch ↗».
- [ ] **4. Senden an Mitbewohner**: auf der Rezept-Seite «Senden» → Blatt mit den Mitbewohnern (Kacheln) + «Als Link teilen (WhatsApp …)». An Mitbewohner = Meldung in Obsonare («Joshua schlägt vor: Kürbis-Risotto»), antippen öffnet die Rezept-Seite; im Hintergrund kommt es in die Wochenwahl der Woche (als Vorschlag mit Name). Link = Web-Share mit Titel, Bild, Obsonare-Link (öffnet die Rezept-Seite, ohne WG nur lesen).
- [ ] **5. Rezepte einlesen – ein Knopf «+»** (in Rezepte, im Menü-Blatt, in der Wochenwahl): Blatt mit **Link einfügen** (erkennt einen kopierten Link selbst) · **Text einfügen** (Instagram, WhatsApp, Notiz; ohne KI) · **Foto mit KI** · **Von Hand**. Danach immer dieselbe Vorschau zum Korrigieren → «Speichern & einplanen».
  - **Foto mit KI über eine fremde App** (Entscheid Joshua 25.11.: ja, so einfach wie möglich – kein API-Schlüssel, keine Kosten, kein Bild über unseren Server): Knopf «Foto mit KI» → Obsonare **kopiert einen fertigen Prompt** und öffnet **deine Lieblings-KI** (Joshua 25.11.: Wahl pro Handy unter Einstellungen → Du: **ChatGPT · Claude · Gemini · andere**; mit Vorbefüllung, wo die App das kann, z.B. `chatgpt.com/?q=…`, `claude.ai/new?q=…` – beim Bauen prüfen; «andere» = eigene Adresse oder nur kopieren; sonst nur öffnen + «Prompt ist kopiert, einfügen»). Beim ersten Mal fragt das «+»-Blatt einmal «Welche KI nutzt du?». Dort Foto machen (Kochbuch, Zettel, Screenshot) → die KI antwortet im festen Format → Antwort **kopieren** → zurück in Obsonare: Knopf «Einfügen» (bzw. Hinweis «Rezept in der Zwischenablage gefunden» beim Zurückkehren, ohne ungefragt zu lesen) → Vorschau → Speichern.
  - **Festes Format** (lesbar, robuster als JSON): Kopfzeile `OBSONARE-REZEPT`, dann `Titel:`, `Portionen:`, `Zeit:`, `Vegi: ja/nein`, `Zutaten:` (eine Zeile pro Zutat «200 g Lauch»), `Schritte:` (nummeriert). Der Prompt verlangt nur das, ohne Einleitung; Mengen so wie im Original, Portionen angeben. Parser in `core.js` (`parseRecipeText`), nimmt auch freien Text (dann wie «Text einfügen»). Tests mit Beispiel-Antworten von ChatGPT, Claude und Gemini.
  - Dieselbe Vorschau dient für «Text einfügen» – ein Weg, zwei Quellen.
  - **Reste-Rezept mit KI** (Joshua 25.11.): Knopf «Was koche ich mit …?» (im «+»-Blatt und im Vorrat) → Zutaten antippen (Vorrat-Liste, später «Im Kühlschrank», plus freies Feld «2 Rüebli, ½ Lauch, Reis») → Obsonare baut den Prompt mit allem, was es weiss: Anzahl Esser heute, wer vegi ist, **einfach** (≤ 8 Zutaten, ≤ 30 Min.), was im Grundvorrat sicher da ist (Salz, Öl, Bouillon …), «möglichst nur diese Zutaten», Antwort im Format `OBSONARE-REZEPT` → kopieren + Lieblings-KI öffnen → Antwort kopieren → «Einfügen» → Vorschau → **für heute einplanen** (Einkauf zeigt nur, was noch fehlt). Als eigenes Rezept speichern nur auf Wunsch («War gut → behalten»), sonst einmalig. Prompt-Bau in `core.js` (`leftoverPrompt`), getestet.
  - **Instagram / TikTok** (Joshua 25.11.): **kein Bot-Konto** – Instagram verbietet automatisches Auslesen (Nutzungsbedingungen), sperrt solche Konten schnell, und ohne Anmeldung liefert ein Link kaum Inhalt; die offizielle Schnittstelle (oEmbed) braucht eine Meta-App mit Schlüssel und gibt das Rezept nicht zuverlässig her. Stattdessen derselbe Weg wie «Foto mit KI»: im Beitrag **Link kopieren** + **1–3 Screenshots** (Beschreibung mit Zutaten, ggf. Bild aus dem Video) → «Foto mit KI» (die Lieblings-KI liest die Screenshots) → zurück einfügen. Obsonare erkennt den kopierten Instagram-Link und speichert ihn als **«Original ↗»** am Rezept – beim Kochen öffnet er das Video. Android zusätzlich: «Teilen → Obsonare» (`share_target`) legt den Link gleich an.
- [ ] **6. Kochansicht «Kochen»** (aus Plan-Karte «Heute» oder Rezept-Seite): ganze Seite, Zutaten auf heute umgerechnet, antippen = abgehakt, Bildschirm bleibt an, Zeiten im Text = Timer; Schritte bei eigenen Rezepten, sonst «Rezept öffnen ↗» (Link) – Tablet quer: Zutaten links, Schritte/Webseite-Hinweis rechts. Wahl «Buch» (Obsonare-Seite) oder «Link» (Original) merkt sich pro Handy.
- [ ] **7. Einstellungen aufräumen**: oben nur **Du** (Name, Vegi/Fleisch, Benachrichtigungen) · **WG** (Mitbewohner, einladen, Znacht-Zeit) · **Bring!** (verbunden ✓ / verbinden); Stil, Farben, Standort, Kalender, Über unter «Mehr».

### Erfolg messen (beim Praxistest)
- Jemand Neues ist ohne Hilfe in **unter 2 Minuten** drin und hat gewählt.
- Planer braucht für «Wahl → Plan → Bring!» **unter 1 Minute**.
- Niemand fragt «wo finde ich …?» – jede solche Frage = Punkt für die nächste Runde.

### Offene Entscheide (Joshua)
- ~~Bot~~ → entschieden 27.11.: Weg A (Liste in Bring! mit dem Bot teilen); ob der Bot selbst annehmen kann, noch prüfen.
- Senden: Meldung in Obsonare, WhatsApp-Link oder beides (Vorschlag: beides, Meldung zuerst)?
- ~~Foto mit KI~~ → entschieden 25.11.: ja, über die Lieblings-KI (ChatGPT, Claude, Gemini …) mit kopiertem Prompt (Schritt 5)
- Reihenfolge: 0 (Einfach & saisonal), dann 1 + 2 vor dem Praxistest, 3–7 danach (Vorschlag).

## Als Nächstes

- [x] **Markt-Ansicht übersichtlicher** (erledigt 18.11., v1.13.0) (Joshua 17.11., nach v1.12.0): nach **Art** gruppieren (Hofläden, Bio-Läden, Wochenmärkte, Spezialmärkte, Automaten), pro Ort Link + «Route»; **Radius vergrössern**; Öffnungszeiten **klein pro Ort** (Mo–So in einer Zeile) statt Liste pro Wochentag – heute steht z.B. ein 24-h-Hofladen 7× da, das ist unübersichtlich.
- [x] **Neues Rezept direkt aus der Rezept-Auswahl** (erledigt 27.11.: «＋ Neues Rezept» zuoberst im Menü-Blatt und in der Wochenwahl; in Rezepte = «+ Einfügen») (Joshua 18.11.): heute umständlich – Tag antippen → Menü-Blatt → «Alle Rezepte, Filter & eigenes Rezept …» → Katalog «Menü wählen» → «+ Eigenes Rezept». Neu: im Menü-Blatt (`app_plan.js`, Liste `#mlist`) ganz oben ein Eintrag «+ Neues Rezept (Link oder von Hand)», der sofort das Formular «Eigenes Rezept» öffnet; nach dem Speichern ist das Rezept gleich für diesen Tag gewählt. Dasselbe in der Wochenwahl und in «Alle Rezepte». UI-Schritt in `tests/ui_e2e.mjs`.
- [x] **Markt: kleiner Knopf «Google-Suche»** (erledigt 18.11., v1.13.0) (Joshua 17.11.): wie im ersten Hofläden-Entwurf eine Google-Maps-Suche «Hofladen» / «Wochenmarkt» in der Nähe, als kleiner Knopf zusätzlich zur eigenen Liste (Suchergebnisse können kurios sein, darum nur als Zusatz).

- [ ] **Redesign Plan-Ansicht – prüfen**: `node tests/layout_check.mjs --shots` (390×844, 375×667, 390×600; iPhone/Android, hell/dunkel) und auf dem echten iPhone/Android ansehen
- [ ] Redesign für Einkauf, Rezepte & Saison, Einstellungen (folgt separat, gleiche Vorgabe)
- [x] **Ab Donnerstag die nächste Woche planen**: Chip «KW 47 →» in der Abschnittszeile (oder seitlich wischen), Tage zuerst «noch offen», Wochenwahl/Bring!/Kalender für die angezeigte Woche, am Montag wird sie zur laufenden

- [ ] **Joshua**: WG-Liste in Bring! mit `allmenbot@gmail.com` teilen, in der App unter Einstellungen → «Bring!-Liste der WG» wählen
- [x] **Design-Entscheid**: eigene Spezifikation (`docs/design/`) – iPhone Glas, Android Material 3 Expressive, Hellgrün + Pistazie; Plan-Ansicht + Navigation umgesetzt
- [x] **Gezielter Rezept-Import von 6 Schweizer Seiten** (erledigt 18.11., v1.13.0: gemuese.ch 13, kartoffel.ch 12, schweizerfleisch.ch 12, Joël & Muriel 14 über `tools/import_recipes.py add`; noahbachofen.ch und 5liber-manufaktur.ch haben keine Rezepte auf der Website) (Joshua 16.11., gestoppt wegen Limit; übergeben an Chat «Bauernhof-Verkauf und Märkte» 18.11.): gemuese.ch, kartoffel.ch, schweizerfleisch.ch, noahbachofen.ch, joelundmuriel.ch, 5liber-manufaktur.ch. Regeln: pro Seite zuerst robots.txt + Nutzungsbedingungen prüfen (private Blogs besonders genau, im Zweifel weglassen, Bot-Sperren nie umgehen); höchstens ~15 von Hand gewählte Znacht-Rezepte pro Seite (4 Pers., ≤ 60 Min., saisonal verteilt, ~½ vegi); nur Fakten aus JSON-LD über `tools/extra_urls.txt` + `tools/import_recipes.py`, keine Texte/Bilder; eigene Gruppe pro Seite in `CORE.groupBySource`; `zutaten.test.js` prüfen. 5liber: nur Rezepte, die ohne deren Produkte gehen. Kein Massen-Scraping.
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
    - Soll «leer» zuerst nur in Obsonare gemerkt werden und erst mit «Bring! füllen» auf die Liste kommen (mit Nachfragen und «Rückgängig» wie beim Plan)? Oder ein eigener, klar beschrifteter Knopf «auf Bring!» pro Artikel?
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
- [x] **«Aktualisieren» bei der Version** unter «Über Obsonare» statt ganz oben in den Einstellungen
- [x] **Wochenwahl mit Bildern**: Vorschaubild der Rezeptseite, einmal vom WG-Server geholt und abgelegt (nur mit PIN), auf dem Handy zwischengespeichert
- [ ] **Wochenwahl wie Memory**: Karte zeigt nur das Bild (+ kurzer Titel unten); antippen = Karte dreht sich (3D-Flip) → Rückseite: ganzer Titel, Vegi/Fleisch, Minuten, Wunschtag, «Wählen» / «Abwählen», 🌐 Rezept; nochmals antippen (oder ✓) = zurück aufs Bild, gewählte Karten mit Häkchen und Rahmen. Ohne Bild: Vorderseite mit Gemüse-Bild/Farbe. Zuerst als HTML-Vorschau zeigen (Joshua wählt)
- [x] **Gratis-Kontingent des WG-Servers schonen** (Cloudflare KV: 1000 Schreib-/Listen-Aufrufe pro Tag fürs ganze Konto): Wochenwahl listet keine Schlüssel mehr, fragt alle 30 s statt 15 s und nur bei offener App
  - Offen: Tests der Test-Version (Live-Test bei jedem Push) zählen mit – bei vielen Pushes am selben Tag knapp; notfalls Live-Test nur 1× pro Tag
- [ ] **Einkäufe festhalten – «Im Kühlschrank»** (Idee Joshua 18.11., erst Plan, noch nicht bauen). Ziel: so wenig Tippen wie möglich, Reste werden nicht doppelt gekauft.
  - **Stufe 1 – ohne Zutun über Bring!**: Was der Bot für ein Gericht auf Bring! gesetzt hat und dann in Bring! abgehakt wird (der Bot sieht das heute schon, Vorrat macht es gleich: «gekauft = eine Packung dazu»), kommt mit der Menge aus der Mengenangabe in einen **Zwischenvorrat «Im Kühlschrank»** (pro WG im Worker, gemerkt mit Gericht + Tag). Eingekauft wird immer aufgerundet (ganze Zwiebel, ganzer Becher Rahm)
  - **Verkochen rechnet sich selbst**: Ist ein Tag vorbei (oder «gekocht»), zieht er seine Kochmenge ab (½ Zwiebel, 1 dl von 2.5 dl Rahm). Was übrig bleibt, bleibt im Kühlschrank und wird bei der nächsten Einkaufsliste abgezogen («½ Zwiebel noch da»). Wie beim Grundvorrat: nicht speichern, sondern rechnen (gekauft − gekochte Tage) → keine Konflikte zwischen Handys
  - **Haltbarkeit grob**: frisches Gemüse/Milchprodukte nach ~5–7 Tagen still aus dem Kühlschrank nehmen (sonst glaubt die App an eine Zwiebel von vor 3 Wochen); Trockenes (Reis, Teigwaren) geht stattdessen in den Grundvorrat
  - **Von Hand korrigieren**: im Einkauf ein Reiter/Abschnitt «Im Kühlschrank», Zeile antippen = «weg / aufgebraucht»
  - **Stufe 2 – Kassenzettel** (nur für Ungeplantes, falls Stufe 1 nicht reicht): einfacher als ein Foto lesen sind die **digitalen Kassenzettel** von Migros (Cumulus-App) und Coop (Supercard-App) als PDF teilen → Worker liest den Text, ordnet Zeilen dem Bring!-Katalog zu, zeigt eine Liste zum Bestätigen («ins Vorrat» / «in den Kühlschrank» / ignorieren). Foto mit Texterkennung erst, wenn das nicht reicht (Kassenzettel-Abkürzungen wie «M-CL RAHM 2.5DL» brauchen eine Zuordnungstabelle)
  - Offen: Bring! meldet nur «abgehakt», nicht wie viel gekauft wurde → Menge aus der Mengenangabe annehmen; wer etwas anderes gekauft hat, korrigiert im Kühlschrank
- [ ] **Praxistest**: eine echte Woche mit Lukas, Leonie und Jo planen, einkaufen, Feedback sammeln
- [ ] Danach entscheiden: Mengen der Protein-Zusätze (150 g Fleisch / 100 g Käse pro Person), Rezeptauswahl, evtl. Koch-Zuteilung

## Von Paprika lernen (Analyse 23.11.2026) – erst nach dem Praxistest, je einzeln

Paprika (Rezept-App, einmal kaufen, kein Abo) ist kein Konkurrent von Bring!, sondern das Gegenstück: Bring! ist eine **Liste**, Paprika ist ein **Kochbuch, aus dem die Liste fällt**. Was es grossartig macht, sind sechs Prinzipien:
1. **Ein Weg ohne Brüche**: Rezept → Plan → Einkaufsliste → Vorrat → Kochen. Jeder Schritt nimmt das Ergebnis des vorigen mit, nichts wird zweimal eingetippt.
2. **Einfangen ohne Mühe**: eingebauter Browser, «Speichern» holt Titel, Zutaten, Schritte, Bild; geht das nicht, markiert man Text und weist ihn einem Feld zu.
3. **Die Küche mitgedacht** (Kochansicht): Bildschirm bleibt an, Zutaten antippen = abgehakt, Schritt antippen = hervorgehoben, Zeiten im Text («10 Minuten») antippen = Timer, mehrere Timer gleichzeitig.
4. **Merkt sich Entscheide**: einmal einer Abteilung zugeordnet, immer dort; Mengen gleicher Zutaten werden zusammengezählt; beim «Auf die Liste» ist abgewählt, was im Vorrat steht.
5. **Wiederverwenden statt neu planen**: «Menüs» = gespeicherte Sätze von Gerichten (z.B. Lieblingswoche), mit einem Tipp in den Kalender.
6. **Daten gehören dir**: alles offline auf dem Gerät, Sync nur als Abgleich, Export jederzeit. Keine Werbung, keine Abo-Falle.
Schwächen (warum es die WG nicht ersetzt): für eine Person gebaut (Teilen nur über dasselbe Konto), keine Abstimmung, kein Vegi/Fleisch-Mix, keine Portionen pro Esser, Liste nicht live geteilt wie Bring!.

**Haben wir schon** (Paprika-Prinzip ✓): 1 Rezept → Plan → Bring! → Vorrat · Portionen skaliert (Esser + Puffer) · Mengen zusammengezählt («Für mehrere Gerichte») · Vorrat wird beim Einkauf abgezogen · Link-Import im Worker (schema.org) · offline (PWA) + tägliche Sicherung.

**Übernehmen**, in dieser Reihenfolge:
- [ ] **Kochansicht «Heute kochen»** (Prinzip 3, grösster Gewinn): im Plan beim heutigen Tag ein Knopf → ganze Seite mit den Zutaten **schon umgerechnet auf heute** (z.B. 7 Portionen statt 4 auf der Webseite), Zeile antippen = abgehakt, Bildschirm bleibt an (Wake Lock, ohne Unterstützung einfach weglassen), Link «Rezept öffnen» für die Schritte. Eigene Rezepte zeigen auch die Schritte (`instructions`); Zeiten darin («10 Min.», «½ Std.») werden antippbar = Timer mit Ton + Vibration. Regeln (Zeit im Text finden) in `core.js`. Importierte Rezepte haben keine Schritte (nur Fakten) → nur Zutaten + Link
- [ ] **«War gut?» nach dem Kochen** (Prinzip 4): am Tag danach im Plan kurz 👍 / 👎 pro Person, gemeinsam im Worker. 👍 hebt das Gericht in der Wochenwahl, zweimal 👎 = kommt nicht mehr in die 14. Ergänzt die Beliebtheit aus den Stimmen um das, was nach dem Essen zählt
- [ ] **WG-Notiz pro Rezept** (Prinzip 4): ein Satz, für alle sichtbar in Wochenwahl, Plan und Kochansicht («doppelt Knoblauch», «Jo: Tofu statt Speck»). In den WG-Einstellungen gespeichert (nur Id → Text), auch für Katalog-Rezepte
- [ ] **Zuletzt gekocht** (Prinzip 4): Plan-Verlauf behalten (nur Datum + Id pro WG) → auf der Karte «vor 2 Wochen»; die Wochenwahl nimmt nichts, was in den letzten 3 Wochen gekocht wurde
- [ ] **Lieblingswoche speichern** (Prinzip 5, wie Paprika-«Menüs»): im Plan «Als Vorlage merken» → später «Vorlage laden» füllt die Tage (Esser bleiben, wie bei `swapDishes`). Für Wochen ohne Lust auf Wochenwahl
- [ ] **Was geht mit dem, was da ist?** (Prinzip 4): in «Alle Rezepte» ein Filter «passt zum Vorrat / Kühlschrank» = sortiert nach Anteil der Zutaten, die schon da sind (gleicher Abgleich wie der Grundvorrat), plus Suche nach Zutat («Lauch»). Nützlich mit «Im Kühlschrank» oben
- [ ] **Einfangen ohne Mühe** (Prinzip 2; ein eigener Browser in der App geht als PWA nicht): (a) im Formular «Eigenes Rezept» ein Feld **«Text einfügen»** (Instagram, WhatsApp, Notiz) → erste Zeile = Titel, Zeilen mit Menge = Zutaten (`parseIngredients`), Rest = Schritte, Vorschau zum Korrigieren, ohne KI und ohne Netz; (b) **Teilen an Obsonare** (`share_target` im Manifest, nur Android; iPhone: kopieren + «Text einfügen»)

Bewusst nicht von Paprika: Ablaufdaten pro Artikel (zu viel Pflege; «Im Kühlschrank» rechnet grob), eigene Einkaufsliste mit Abteilungen (Bring! bleibt die Wahrheit und sortiert selbst), Nährwert-Rechner (Nährwerte kommen schon aus den Rezepten), Kalender-Ansicht über Monate (WG plant Woche für Woche), Kauf-Modell (gratis für die WG).

## Später, nur wenn nötig

- Echte Kalender-Einladungen mit «Annehmen» (braucht E-Mail-Dienst)
- Weitere Rezepte einzeln über «Eigenes Rezept → Link» statt Massen-Import
- Bring!-Batch-Schnittstelle (`PUT bringlists/{uuid}/items`, ein Aufruf statt einer pro Artikel) → hebt das 45-Artikel-Limit auf
- Eigene Bilder für Artikel ohne Bring!-Bild (Bring!-API kann kein Hochladen; nur von Hand in der Bring!-App)
- Grundvorrat zusätzlich als eigene Bring!-Liste «Vorrat» im Bot-Konto (oben = haben wir, «Zuletzt verwendet» = fehlt), geteilt mit allen, auch ohne PWA. Bot gleicht per Cron (~10 Min.) ab: leer → Einkaufsliste, gekauft → wieder «da». Vorher eine Woche ohne Code testen (Liste von Hand anlegen und teilen). Siehe Entscheid #22
