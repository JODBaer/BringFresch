# Obsonare v2.0.0 – Neuigkeiten und Release (Stand 15.11.2026, letzter Commit 9a56156)

Alles liegt auf `main`. **Der Tag ist noch nicht gesetzt:** Joshua testet zuerst auf der Test-Version, die sich bei jedem Push auf `main` neu baut.
Die Versionsnummer kommt beim Release aus dem Tag (`build_site.mjs`); von Hand ist nichts zu ändern.

## Entscheide Joshua (16.11.2026) – gehen allem unten vor
- **Zuerst v1.11.0** mit dem heutigen Stand von `main` (alles unter «Neu seit v1.10.0»), damit v2.0.0 nicht zu viel auf einmal ändert. Der Text für die WG unten gilt für v1.11.0.
- **v2.0.0 erst danach**, mit: Hofläden-Karte (Zweig `ccr-c75d431f-nkpfcv`) und Speicher-Umzug `obsonare_*` (Zweig `ccr-315f8b43-5aq49r`).
- **Hofläden-Daten: Weg B (Workflow)**: `.github/workflows/hoflaeden.yml` mit `workflow_dispatch` (optional monatlich), führt `tools/update_hoflaeden.mjs` aus und committet auf einen Zweig, nie direkt auf `main`. Siehe `docs/plan/hoflaeden-uebersicht.md` auf dem Zweig.
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
- **🧺 Markt**: Chip oben links mit Hofläden und Märkten in der Nähe, in Rapperswil-Jona, Zürich und am Wochenmarkt Robenhausen (Wetzikon).

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
