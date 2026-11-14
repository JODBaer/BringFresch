# Obsonare v2.0.0 – Neuigkeiten und Release (Stand 15.11.2026)

Alles liegt auf `main`. **Der Tag ist noch nicht gesetzt:** Joshua testet zuerst auf der Test-Version, die sich bei jedem Push auf `main` neu baut.
Die Versionsnummer kommt beim Release aus dem Tag (`build_site.mjs`); von Hand ist nichts zu ändern.

## Neu seit v1.10.0 (Text für die WG)

**Obsonare** – BringFrisch heisst jetzt Obsonare. Eure Daten, die Verbindung zum WG-Server und das Kalender-Abo laufen einfach weiter.

**Rezepte**
- **Alle Rezepte**: In der Zeile «Meine Rezepte» öffnet ein Knopf alle Rezepte als kleine Kacheln zum Durchscrollen. Sie sind nach Herkunft geordnet (Swissmilk, Fooby, Betty Bossi, Migusto, Klassiker …), und was jetzt Saison hat, steht zuerst. Kachel antippen, dann einen Tag wählen = eingeplant. Den gewählten Tag nochmals antippen = wieder abwählen. Mit «Rückgängig» und Suche, ab Donnerstag auch für die nächste Woche.
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

## Offen / bekannt
- Speicher-Umzug `bringfrisch_*` → `obsonare_*` und neue Adressen: erst nach Entscheid (Chat «Obsonare»). Cache-Präfix `bringfrisch-cache-*` bleibt bis dahin.
- Der Schriftzug oben in der App zeigt noch «BringFrisch» (`static/index.html`, `.brand`). Ändern oder bewusst lassen? Joshua fragen.
- Die alten Zweige `ccr-c75d431f-nkpfcv` (Hofläden) und `ccr-315f8b43-5aq49r` (Obsonare) sind auf `main` und können gelöscht werden.
