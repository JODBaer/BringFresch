# Obsonare v2.0.0 – Neuigkeiten und Release (Stand 15.11.2026, letzter Commit 9a56156)

Alles liegt auf `main`. **Der Tag ist noch nicht gesetzt:** Joshua testet zuerst auf der Test-Version, die sich bei jedem Push auf `main` neu baut.
Die Versionsnummer kommt beim Release aus dem Tag (`build_site.mjs`); von Hand ist nichts zu ändern.

## Entscheide Joshua (16.11.2026) – gehen allem unten vor
- **Zuerst v1.11.0** mit dem heutigen Stand von `main` (alles unter «Neu seit v1.10.0»), damit v2.0.0 nicht zu viel auf einmal ändert. Der Text für die WG unten gilt für v1.11.0.
- **v2.0.0 erst danach**, mit: Hofläden-Karte (Zweig `ccr-c75d431f-nkpfcv`) und Speicher-Umzug `obsonare_*` (Zweig `ccr-315f8b43-5aq49r`).
- **Hofläden & Märkte** (Stand 18.11., v1.13.0): **nach Art** statt nach Wochentagen (Wochenmärkte, Hofläden, Bio-Läden, Hofautomaten; `CORE.farmGroups`), pro Ort Zustand + Wochenzeiten in einer Zeile, Umkreis 15/30/60/100 km (Standard 60), je 6 Orte, «Alle zeigen»; kleiner Zusatz-Knopf Google-Suche (Hofladen/Wochenmarkt ab Standort bzw. Rapperswil). Vorher (16.11.): Ansicht nach Wochentagen, **keine Karte** (`static/app_hof.js`): oben «Am nächsten» und «Lieblings» (Stern pro Ort, WG-weit in `/settings` als `favMarkets`), dann besondere Märkte der nächsten 6 Wochen (`static/maerkte_spezial.js`, von Hand, Quelle je Eintrag; «Datum prüfen» wo nicht offiziell bestätigt), dann pro Tag was offen ist. «Route» = Koordinaten-Link (iPhone Apple Karten, sonst Google Maps); freie Textsuche nur im kleinen Knopf «Mehr in Google Maps». Standort nur auf Knopfdruck, nie gespeichert/gesendet (nur ja/nein pro Handy).
  - **Alle in Google Maps**: «Für Google Maps exportieren» erzeugt eine KML (`CORE.kmlExport`); einmal in Google «Meine Karten» importieren, Link in Einstellungen → «Karte Märkte» (`marketsMapUrl`, WG-weit). Ändern sich die Daten stark: KML neu exportieren und in «Meine Karten» die Ebene ersetzen (von Hand, selten). Daten bleiben in der App (offline, schnell); auf dem Server speichern ist nicht nötig.
  - **Daten holen**: Workflow `.github/workflows/hoflaeden.yml` («Run workflow» oder am 1. des Monats) holt OSM (Overpass, mehrere Server, Wiederholung) und committet `static/hoflaeden.js` **nur auf den Zweig `ccr-c75d431f-nkpfcv`** (nicht löschen). Danach von dort nach `main` mergen (`git merge origin/ccr-c75d431f-nkpfcv`). Overpass ist oft ausgelastet: Lauf wiederholen.
  - **Quellen**: OSM/Overpass (Hofläden, Märkte, Hofautomaten; ODbL, «© OpenStreetMap-Mitwirkende» im Blatt und in `rechtliches.html`), von Hand: Wochenmarkt Robenhausen (Skript `EXTRA`) und Spezialmärkte (Stadt Bern, Verein Rüeblimärt, Gemeinde Richterswil; Weihnachtsmärkte nur Reiseportale → «Datum prüfen»). opendata.swiss: nicht abrufbar (403 für Bots), nicht geprüft. rapperswil-zuerichsee.ch sperrt Bots, nicht abgerufen.
  - **discover.swiss** (Schlüssel `DISCOVER_SWISS_KEY` als GitHub-Secret, nur im Workflow; Stand 18.11.): Der OpenData-Schlüssel hat **kein Partner-Projekt** → `/search` antwortet 401 «Project wasn't supplied». Die Listen-Endpunkte gehen ohne Projekt, aber die Filter `additionalType`/`source` wirken dort nicht und Ort-Filter ist «coming soon» → `discoverItems` holt `civicstructures`, `localbusinesses`, `places` ganz (~35 Abrufe, ~1/s) und wählt selbst: Typ `Market` (ohne Floh-/Weihnachts-/Saisonmärkte, die stehen in `maerkte_spezial.js`), Typ `Farm`/`FarmShop`, «Hofladen» im Namen, dazu Kategorien `sui_0506`/`sui_0507`. **Zürich Tourismus (`zht`) liefert die Wochenmärkte dort offiziell** (Bürkliplatz, Helvetiaplatz, Oerlikon, Stadthausquai, Altstetten, Rosenhof, Viadukt, Rapperswil, Robenhausen, Uster, Stäfa, Meilen, Wädenswil, Fällanden, Wollerau, Lachen, Zug) – darum zuerich.com/rapperswil-zuerichsee.ch nie abrufen (sperren Bots). Ergebnis: 21 Orte im Gebiet. Zusammenführen (`mergeDiscover`): < 250 m + gemeinsames Ortswort, Märkte mit gleichen Zeiten < 500 m, gleicher Name < 3 km; offizieller Name/Adresse gewinnen, **Zeiten von Hand (`EXTRA`, amtlich) bleiben**. Saison aus `validFrom/validThrough`. Fällt Overpass aus, nimmt das Skript die bisherigen Orte aus `static/hoflaeden.js` und aktualisiert trotzdem. Workflow-Schalter «explore» = nur Log (Erkundung). **Ganze Schweiz (Erkundung 18.11.)**: der OpenData-Schlüssel liefert nur Daten einiger Ostschweizer Partner (zht, rzst, sgt, vgl, tt, alar, tht, ltm): 43 Märkte, aber **nur 16 Anlässe schweizweit** – kein Sechseläuten/Böögg, kein Fulehung Thun, nichts aus Bern/Basel/Luzern/Westschweiz/Tessin. Für Brauchtum/Weihnachtsmärkte CH-weit also andere Quelle oder von Hand (`maerkte_spezial.js`). Lizenz CC BY-SA (Share-Alike neben ODbL im selben File: bei Bedarf prüfen); Klassifikation: docs.discover.swiss → Data Classification (xlsx).
  - **Zürcher Märkte**: einmal von Hand (16.11.) von zuercher-maerkte.ch (6 amtliche Märkte mit Zeiten, überschreibt die OSM-Zeiten) und zuerich.com (Rapperswiler Freitagsmarkt, Markthalle im Viadukt, mit Koordinaten der Seite); beide Seiten erreichbar, robots.txt erlaubt Seiten. Kein Scraping im Workflow, **etwa einmal im Jahr von Hand nachprüfen** (`EXTRA` im Skript). Röschibachplatz und Brupbacherplatz (nur Namen auf zuerich.com, keine Daten) fehlen noch.
  - **Google Maps** ist keine Datenquelle (Places-API: Schlüssel, Kosten, Speichern der Daten verboten). Nur Ziel der Links (Koordinaten) und Export für «Meine Karten».
  - **Saisongemüse**: Zeile «Jetzt Saison» oben im Blatt aus `season_items` (VSGP, gleiche Daten wie «Rezepte & Saison»), Quelle gemuese.ch verlinkt; nichts neu importiert.
- **«Memory-Kachel-Bug»** meinte nur «Alle Rezepte» (behoben). Die Wochenwahl bleibt, wie sie ist.
- **Schriftzug oben**: Das Design von «BringFrisch» gefällt Joshua, aber das Wort «Obsonare» muss hinein. Die genaue Gestaltung entscheidet er später (als HTML-Entwurf zeigen).

## Neu seit v1.10.0 (Text für die WG)

**Obsonare** – BringFrisch heisst jetzt Obsonare. Eure Daten, die Verbindung zum WG-Server und das Kalender-Abo laufen einfach weiter.

**Rezepte**
- **Alle Rezepte**: In der Zeile «Meine Rezepte» öffnet ein Knopf alle Rezepte als kleine Kacheln zum Durchscrollen. Sie sind nach Herkunft geordnet (Swissmilk, Fooby, Betty Bossi, Migusto, Klassiker …), und was jetzt Saison hat, steht zuerst. Kachel antippen, dann einen Tag wählen = eingeplant. Die Karte bleibt offen: weitere Tage wählen oder den gewählten Tag nochmals antippen = wieder abwählen. Mit «Rückgängig» und Suche, ab Donnerstag auch für die nächste Woche.
- 29 neue Klassiker mit Swissmilk-Links. «Rezept suchen auf» Swissmilk, Fooby oder Google. In der Wochenwahl kommt nie dasselbe Gericht zweimal vor.

**Einkauf**
- Neuer Aufbau: Reiter Kaufen · Auf Bring! · Vorrat, Umschalter **Rezept / Kategorie**, Wischen wechselt den Reiter.
- **Ein Bring!-Knopf** unten rechts: öffnet die Gegenüberstellung Kaufen | Vorrat. Nach dem Senden steht 10 s «Rückgängig» im Knopf.
- **Vormerken**: In «Kaufen» eine Zeile antippen = vormerken (durchgestrichen). Gesendet wird erst mit dem Knopf. Das gilt auch für knappen Vorrat. «Alle auswählen» steht unten in der Gegenüberstellung.
- **Vorrat**: Den Namen antippen = für Bring! vormerken. Sonst die Zeile antippen oder lange auf den Namen drücken = Blatt (Leer · Fast leer · Halb · Voll). «Woche gekocht» steht oben.
- **🧺 Markt**: Chip oben links, Blatt nach Wochentagen mit Hofläden und Märkten (siehe «Hofläden & Märkte» oben).

**Grundvorrat verwalten**
- Kachel antippen = Karte dreht sich (✕ links, «leer» rechts, − +). Lange drücken = Blatt.

**Sonst**
- Die App lädt schneller, weil die Schrift kleiner ist (196 → 125 KB).

## Release machen (wenn Joshua «jetzt» sagt)
1. `cd tests && npm ci && npm run ci` → «PASS: alles grün»
2. `git tag v2.0.0 && git push origin v2.0.0`. Nummer 2.0.0 ist entschieden, damit die Handys mit 1.10.0 «Neue Version verfügbar» sehen.
3. Lauf von `deploy-pages.yml` prüfen (test → worker → deploy). Danach den Text oben an die WG schicken.

## Für den nächsten Chat
- Zuerst lesen: `CLAUDE.md` und diese Datei. Code: «Alle Rezepte» = `static/app_alle.js` + `CORE.groupBySource` (`static/core.js`); Vorrat antippen/lange drücken = `static/app_vorrat.js` (`markVorrat`, `data-vname`).
- Stand: `npm run ci` grün auf 9a56156. SW-Cache `bringfrisch-cache-v74` (bei Asset-Änderungen hochzählen).
- Joshua testet auf der Test-Version und will **vor v2.0.0 noch weitere Features**. Erst taggen, wenn er «Release» sagt.
- Nachfragen bei Joshua: Meinte er mit dem «Memory-Kachel-Bug» (14./15.11.) nur «Alle Rezepte» (behoben: Karte bleibt offen, nochmals antippen = abwählen) oder auch die **Wochenwahl**? Dort nimmt das nochmalige Antippen eines Tages nur den Wunschtag weg; das Gericht selbst wählt man mit «Doch nicht» ab.
- Neue Funktionen = neuer Schritt in `tests/ui_e2e.mjs`. Joshua und andere Chats schreiben parallel auf `main`: vor dem Push `git fetch` + merge und danach nochmals testen.

## Offen / bekannt
- Speicher-Umzug `bringfrisch_*` → `obsonare_*` und neue Adressen: liegt auf dem Zweig `ccr-315f8b43-5aq49r` (siehe unten), noch nicht auf main.
- Der Schriftzug oben in der App zeigt noch «BringFrisch» (`static/index.html`, `.brand`). Entschieden 16.11.: «Obsonare» kommt hinein, Gestaltung später (siehe oben).
- Zweige `ccr-7c4789c0-pz6wnw` (Swissmilk) und `ccr-eb9048a0-ea245d` (dieser Chat) sind auf `main` und können auf GitHub gelöscht werden.
- **Noch NICHT auf main, Arbeit anderer Chats (Stand 15.11.):**
  - `ccr-315f8b43-5aq49r` (Chat «Obsonare»): 2d250a0 «Speicher und Cache umbenannt, Umzug der Adressen vorbereitet», 55 Dateien. Das ist der offene Speicher-Umzug. Vor v2.0.0 mit Joshua klären, ob er mit hinein soll. Danach zusammenführen und `npm run ci`.
  - `ccr-c75d431f-nkpfcv` (Chat «Hofläden»): OSM-Karte, Liste mit Öffnungszeiten (`core.js`), Import-Skript `tools/update_hoflaeden.mjs`. Der erste Commit ist als «WIP» markiert. Erst übernehmen, wenn jener Chat sagt, dass er fertig und getestet ist.
