# Plan: Hofläden & Märkte – Übersicht

> **Stand 16.11.2026: gebaut mit Entscheid Joshua** – Ansicht nach Wochentagen, keine Karte, Daten per Workflow, KML-Export. Die Abschnitte unten zur OSM-Karte, zum Blockieren und zum Design-Entwurf sind überholt. Aktuell und zum Neuholen der Daten: `docs/uebergabe-v2.md` (Abschnitt «Hofläden & Märkte»).

Stand 15.11.2026. Wunsch von Joshua: Beim Einkaufen ein Knopf zu Hofläden und Märkten in der Nähe (bis Zürich und Rapperswil), mit Öffnungszeiten, als OpenStreetMap-Übersicht. Reihenfolge laut Joshua: **zuerst dieser Plan, dann ein Design-Entwurf (live als HTML zeigen), erst danach fertig bauen.**

## 1. Was es schon gibt

**Auf `main`** (Test-Seite):
- Chip **«🧺 Markt»** oben links in der Kopfzeile des Einkaufs (neben Rezept/Kategorie), nur bei «Kaufen» und «Auf Bring!», nicht im Vorrat (`#hofBtn`, `static/app_einkauf.js` blendet ihn aus).
- Blatt `#hofDialog` mit einfachen Links: Wochenmarkt Robenhausen (Infos-Link + Karte), Google-Maps-Suche «Hofladen» / «Wochenmarkt» für «In der Nähe», Rapperswil-Jona und Zürich.
- UI-Test-Schritt «Einkauf: Chip «Markt» …» in `tests/ui_e2e.mjs`.

**Nur auf Branch `ccr-c75d431f-nkpfcv`** (nicht auf `main`, weil die Daten noch fehlen):
- `static/core.js`: `parseHours`, `openState`, `hoursText`, `distKm`, `farmList`. Sie lesen das OSM-Format `opening_hours` (Monate, Wochentage, mehrere Zeiten, `off`, `PH` wird übergangen, «24/7»). Ergebnis z.B. «offen bis 12:00», «öffnet morgen 8:00», «öffnet Sa 7:00» oder «Saisonpause». Unbekanntes ergibt `null`, dann wird der Text roh gezeigt. Getestet in `tests/core.test.mjs`.
- `tools/update_hoflaeden.mjs`: holt alle Orte aus OpenStreetMap (Overpass): `shop=farm`, Bio-Gemüseläden, `amenity=marketplace` (nur mit Namen), Hofautomaten. Gebiet: Bbox `47.15,8.45,47.45,9.0` (Zürich – Rapperswil-Jona – Zürcher Oberland). Ergebnis nach `static/hoflaeden.js` (`window.BF_HOF = { stand, items: [{ n, k: hof|markt|automat, lat, lon, oh?, ort?, adr?, web?, bio? }] }`). `EXTRA` = von Hand ergänzt, mit Quelle. Drin: **Wochenmarkt Robenhausen**, Dorfstrasse 15, Wetzikon, `Mar-Nov Sa 08:00-11:00` (von Joshua abgelesen). Koordinaten kommen vom OSM-Ort «Robenhausen» und sind nie geraten.
- `static/hoflaeden.js`: noch **leer** (Platzhalter).
- `static/app_hof.js` (neu, in `index.html` + `sw.js` eingetragen): Blatt mit
  - Karte aus OSM-Kartenbildern (`tile.openstreetmap.org`, erst beim Öffnen geladen), ohne Bibliothek. Punkte nach Art (Akzent / `--warn` / `--fg`), geschlossene blass. Verschieben mit dem Finger, `+`/`−`, «© OpenStreetMap».
  - Filter Alle / Hofläden / Märkte / Automaten, «Jetzt offen», «📍 Mein Standort» (nur auf Knopfdruck, nie gespeichert; sonst misst die App ab Rapperswil).
  - Liste nach Entfernung: Name (Link zu openstreetmap.org), Zustand rechts, darunter Art · Adresse · km und Wochenzeiten · Webseite. «Mehr zeigen» lädt je 30 weitere.
  - Punkt antippen = Ort in der Liste markieren; Ort antippen = Karte dorthin.
  - Zustand in `state.hof` (`app.js`).
- `static/rechtliches.html`: Absatz zu Kartenbildern von OSM (IP-Adresse) und Standort.
- `tests/ui_e2e.mjs`: Kartenbilder werden im Test mit einem 1×1-PNG beantwortet (`TILE_PNG`). Der Schritt prüft Karte, Sortierung, Zeiten, Filter und Auswahl. **Er braucht echte Daten, sonst rot.**
- CSS in `static/app.css` (`.hofmap`, `.hofpin`, `.hofit` …): nur Tokens, keine festen Grüntöne.

## 2. Was blockiert (Erfahrungen aus dem letzten Chat)

- **Overpass (overpass-api.de)** bricht im Cloud-Container jede Verbindung ab, auch mit Netzfreigabe. Vermutlich sperrt der Dienst Rechenzentrums-Adressen. → Daten anders holen (siehe 3.1).
- **rapperswil-zuerichsee.ch** antwortet Automaten mit «403 Bot not allowed», sogar auf `robots.txt`. **Nicht umgehen** (kein falscher Browser-Kennzeichner). Zeiten liest Joshua von Hand ab.
- **discover.swiss** (offizielle Tourismus-Daten, ganze Schweiz): Joshua möchte das vorbereiten. Die Doku ist im Container nicht erreichbar, und die Netzfreigabe dafür hat Joshua im letzten Chat abgelehnt. → Nicht wieder ungefragt vorschlagen. Nichts aus dem Gedächtnis bauen (Endpunkte, Feldnamen, Schlüssel-Header unbestätigt). Erst mit Doku-Ausschnitt oder Freigabe von Joshua.
- Ein GitHub-Workflow, der **selbst auf `main` committet**, wurde von der Sicherheitsprüfung gestoppt. Kosten wären null (öffentliches Repo). Variante «committet nur auf den Arbeits-Branch» oder «nur von Hand starten» mit Joshua klären.
- Eigene Umgebung «BringFresch» existiert (Hosts: overpass-api.de, www.rapperswil-zuerichsee.ch, tile.openstreetmap.org).

## 3. Schritte

### 3.1 Daten holen (Entscheid Joshua)
- **A:** Joshua führt am PC `node tools/update_hoflaeden.mjs` aus (Node 22) und pusht `static/hoflaeden.js`.
- **B:** Workflow `.github/workflows/hoflaeden.yml` (`workflow_dispatch`, optional monatlich). Er führt das Skript aus und committet auf einen Branch, nicht direkt auf `main`.
- Danach prüfen: Anzahl Orte, wie viele mit Zeiten, Märkte ohne Wochenmarkt-Charakter (Plätze namens «Marktplatz» ohne Zeiten) eventuell aussortieren, Robenhausen vorhanden.

### 3.2 Design-Entwurf (vor dem Fertigbauen, Joshua entscheidet)
Als HTML unter `docs/design/hoflaeden-entwurf.html`, mit iPhone-Glas- und Android-M3-Stil, hell und dunkel, mit echten Beispieldaten. Varianten zeigen:
- **Einstieg:** Chip «🧺 Markt» oben links (jetzt) vs. eigener Eintrag in der Navigation vs. Karte als ganze Seite.
- **Karte oben + Liste** (jetzt) vs. **Liste zuerst, Karte aufklappbar** vs. **Karte gross, Blatt mit Liste darunter ziehbar** (wie Karten-Apps).
- **Zeile:** Zustand «offen bis …» als farbiges Etikett vs. Text; Wochenzeiten immer vs. nur beim Antippen; Knöpfe «Route» (Karten-App) und «Webseite».
- **Filter:** Segmente vs. Chips; «Jetzt offen» / «Heute offen» / «Samstag» (Markttag).
- Hinweis «Saisonpause» und Datenstand, Quelle © OSM klein unten.
- Der Plan hat feste Regeln (alle 7 Tage sichtbar usw.), dieses Blatt ist frei, aber **kein seitliches Scrollen** und **Breite 375–390 px**.

### 3.3 Fertig bauen (nach dem Design-Entscheid)
- Den gewählten Entwurf in `app_hof.js` / `app.css` / `index.html` umsetzen. Regeln bleiben in `core.js`.
- Wahrscheinlich nötig: Knopf «Route» (`https://www.openstreetmap.org/directions?to=lat,lon` oder `geo:`-Link), Filter «Heute offen».
- Tests: `tests/core.test.mjs` (neue Regeln), UI-Schritt in `tests/ui_e2e.mjs` anpassen, `npm run ci` grün → `CACHE_NAME` in `sw.js` hochzählen → auf `main`.
- Die alten Google-Maps-Links im Blatt entfallen. Unten bleibt nur der Hinweis «Fehlt etwas? In Google Maps suchen».

### 3.4 Später (nach Praxistest der WG)
- Ganze Schweiz: nur die Bbox im Skript ändern. Die Datei wird dann gross (geschätzt mehrere hundert KB). Eventuell erst beim Öffnen des Blatts laden statt per `<script>`.
- discover.swiss als zweite Quelle, sobald Doku oder Freigabe da ist: eigener Abschnitt im Import-Skript, Schlüssel nur als Umgebungsvariable beim Ausführen, nie im Repo; Duplikate mit OSM über Name + Nähe zusammenführen.
- Weitere Märkte, die Joshua kennt, in `EXTRA` (immer mit Quelle).

## 4. Für den frischen Chat
1. `git fetch origin && git checkout ccr-c75d431f-nkpfcv` (oder davon einen neuen Branch), `git rebase origin/main`. Auf `main` arbeiten parallel andere Chats, Konflikte in `app.css` und `sw.js` (`CACHE_NAME`) sind üblich: beide Seiten behalten, Cache-Nummer eins über `main`.
2. Diesen Plan lesen, dann mit Joshua 3.1 klären und 3.2 als HTML zeigen.
3. Erst nach dem Entscheid 3.3 bauen.
