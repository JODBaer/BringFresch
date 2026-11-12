# Refactoring-Plan (Arbeitsfassung für Claude)

Stand 10.11.2026, App 1.5.2, abgeglichen mit `main` bis `c2e3b74`. Überblick mit Diagramm: `docs/architektur-review.html`.
**Gebaut: Schritte 0, 1, 4, 7 und von Schritt 6 die gemerkte Bring!-Anmeldung.**
**Offen: 2, 3, 5, Rest von 6, 8.** (Stand 12.11.: 2 + Speicher aus 3 erledigt, `app.js` in Dateien aufgeteilt – siehe Schritt 5; offen bleiben Zustand, Variante 4, Rest von 6, 8.) Die Schritte 2, 3 und 5 schneiden `app.js` gross um. Sie warten, bis der laufende Umbau der Rezeptauswahl (anderer Chat) auf `main` ist – sonst kollidieren beide – und bis Joshua den Bündler entschieden hat (Schritt 2). Reihenfolge einhalten; jeder Schritt ist einzeln releasbar und endet mit `cd tests && npm run ci` grün.
Regeln aus `CLAUDE.md` gelten (eigener Worktree, nur eigene Pfade committen, neue Funktion = neuer Schritt in `tests/ui_e2e.mjs`).

## Ausgangslage (gemessen)

| Datei | Zeilen | Inhalt |
|---|---|---|
| `static/app.js` | 3025 (143 KB, 42 KB gzip) | eine IIFE, ~150 Funktionen: Regeln, Ansicht, Sync, Theme (seit 12.11.: 10 Dateien, siehe Schritt 5) |
| `static/index.html` | 1049 (77 KB) | ~600 Zeilen CSS, 4 Tabs, 7 Dialoge |
| `worker/src/index.js` | ~730 | Routen, PIN, Bring!, Kalender, Rezept-Import, Rezeptbilder (`/img`), Sicherung |
| `tests/ui_e2e.mjs` | 1486 | UI-Test, das wichtigste Sicherheitsnetz |

Zustand der App liegt verteilt in `state`, in losen Variablen (`viewNext`, `curPlan`, `nextDoc`, `sync`, Timer) und in ~15 localStorage-Schlüsseln.
Tests laden die App, indem sie `<script src>` in `index.html` durch den Dateiinhalt ersetzen (jsdom, `runScripts`). ES-Module direkt im Browser würden diese Tests brechen.

## Schritt 0 – Fehler flicken (kein Umbau) – erledigt

Gebaut (Test zuerst rot gesehen, dann grün):
- `hasWord` / `inStaples` in `app.js`: ganze Wörter; gleiche Ware in anderer Form zählt (Knoblauchzehen, Zimtpulver, Lorbeerblätter); Bindestrich-Wörter mit Grundwort hinten (Madras-Curry = Curry); nach «mit/aus/in …» zählt nichts; «A und B» braucht beides.
- «Schon auf Bring!» (Einkauf-Tab, Teilen/Kopieren): gleicher Name oder gleicher Bring!-Artikel. «Bring! füllen» war nicht betroffen (`bringDiff` vergleicht schon genau).
- `tests/zutaten.test.js` + `tests/snapshots/vorrat_treffer.json` (58 Treffer aus 449 Zutaten), in `npm test` und `npm run ci`.
- Worker: Sperre pro WG **und Absender (IP)**, auch erste WG; ein Zähler `fail:<wg>:<ip>` statt `fail:` + `lock:`; unbekannte WG-Namen schreiben nichts (schont das KV-Kontingent).
- Worker: `safeFetch` prüft jede Weiterleitung (Rezept-Link und beide Abrufe von `/img`).

Bewusst geänderte Wirkung: Was nur als Teilwort passte, steht jetzt auf der Einkaufsliste, z.B. Hühner-/Fleisch-/Pilzbouillon, Rohrzucker, Weisswein-/Rotweinessig, Kräutersenf, Paniermehl. Wer das als Vorrat will, ergänzt das Stichwort beim Vorrat-Artikel.
Bekannt offen: «Chili Crunch» und «Schnittlauch / Frische Kräuter» gelten weiter als Vorrat (Wort passt).

Ursprünglicher Befund:

1. **Vorrat-Abgleich** (`computeShopping`, `isStaple: stapleKeywords.some(k => lower.includes(k))`): Teilwort-Treffer.
   Betroffen laut Rezeptdaten u.a.: «Mehlig kochende Kartoffeln» (→ Mehl), «Pfefferminze» (→ Pfeffer), «Rote/Gelbe/Massaman-Currypaste» (→ Currypulver), «Kleine Essiggurke» (→ Essig), «Chilischote», «Chili Crunch» (→ Chiliflocken), «Kräuterquark», «Kräuterkäse», «Frischkäse mit Kräutern» (→ Kräuter), «Ungesalzene Cashewkerne» (→ Salz), «Paniermehl», «Buchweizenmehl» (→ Weissmehl; hier fachlich klären, ob gewollt).
   Fix: Abgleich auf ganze Wörter bzw. auf den Bring!-Artikel (`bringItemId`) statt auf Teilzeichenketten. Synonym «mehlig kochende kartoffeln» ergänzen.
2. **Bring!-Abgleich** (`isOnBring: b.includes(lower) || lower.includes(b)`): gleiche Ursache. «Butter» auf Bring! deckt Butternuss-Kürbis/Butterblätterteig ab, «Rahm» deckt Doppelrahm/Rahmquark, «Milch» die Kokosmilch. Fix: gleicher Name oder gleicher Bring!-Artikel.
3. **Test dazu**: alle Zutaten aller Rezepte durch den Abgleich; Liste der erlaubten Vorrat-Treffer als feste Erwartung in `tests/`.
   Erst den Test schreiben und rot sehen (die Befunde sind aus Code + Daten hergeleitet, nicht in der App nachgestellt).
4. **PIN-Sperre für die erste WG** (`requireWg`): der Zweig für `MAIN_WG` zählt keine Fehlversuche. Gleiche Zählung (`fail:`/`lock:`) wie bei weiteren WGs; Test in `worker/test.mjs`.
5. Klein: `importRecipe` mit `redirect: "manual"` und Host-Prüfung pro Weiterleitung (max. 3).

## Schritt 1 – Sicherheitsnetz vor dem Verschieben – erledigt

Gebaut: `tests/einkauf_snapshot.test.js` + `tests/snapshots/einkauf.json` (98 Rezepte in 14 Wochen, 863 Zeilen, 2 s). Liest die Einkaufsliste aus der Ansicht; `bringPayload` ist noch nicht abgedeckt.

Schnappschuss-Test: für jedes Rezept (98) mit fester WG und festem Puffer `computeShopping` + `bringPayload` → JSON in `tests/snapshots/`. Jede spätere Abweichung muss bewusst bestätigt werden.

## Schritt 2 – `core/` herauslösen – erster Teil erledigt (Variante 3, ohne Bündler)

Entscheid Joshua 11.11.2026: zuerst **Variante 3** (eine Regel-Datei als gewöhnliches Script, die App und Worker laden), **später Variante 4** (echte Browser-Module, dann Tests umbauen). Kein esbuild.
Gebaut: `static/core.js` (`BF_CORE`): Woche (`isoWeek`, `weekKey`, `plusWeek`, `mondayOf`, `weekAfter`), `portionsFor`, Zutaten (`cleanIngredient`, `formatAmount`, `hasWord`, `inStaples`, `bringLookup`, `bringItemId`, `bringPayload`), `shoppingList(state)`. Der Worker importiert dieselbe Datei (Wrangler-Bündel geprüft). `tests/core.test.mjs` läuft ohne Browser.
Wochenwahl-Regeln sind seit 11.11.2026 ebenfalls in `core.js` (`pickCandidates`, `ranking`, `assignDays`, `pickRecipe`, `backupRecipe`, `effectiveDiet`, `inSeason`).

Ursprüngliche Skizze (mit Bündler):

Reine Funktionen, kein `window`, kein `document`, kein `localStorage`, Eingaben als Parameter:

| Modul | Aus `app.js` | Auch im Worker |
|---|---|---|
| `core/woche.js` | `isoWeek`, `weekKey`, `plusWeek`, `nextWeekKey`, `todayIndex` | ersetzt `mondayOf`, `weekAfter` |
| `core/portionen.js` | `portionsFor`, `effectiveDiet`, `fitsDiet` | – |
| `core/zutaten.js` | `cleanIngredient`, `formatAmount`, `bringLookup`, `bringItemId`, `SYNONYMS`, `BRING_SYNONYMS`, `BRING_PREFIX` | später für Rezept-Import |
| `core/einkauf.js` | `computeShopping(plan, members, staples, bringItems)` → Liste, `bringPayload`, `bringDiff` | – |
| `core/wochenwahl.js` | `pickCandidates`, `ranking`, `assignDays`, `inSeason`, `pickRecipe`, `generateWeek` | – |

**Offener Entscheid (Joshua):** Bündler. Empfehlung esbuild als einzige neue Dev-Abhängigkeit: Quellen in `src/`, gebaut wird `static/app.js` (eine Datei wie heute, Tests unverändert), der Worker importiert `core/` direkt (Wrangler bündelt selbst). Alternative ohne Bündler: mehrere klassische `<script>`-Dateien mit Namensraum `BF.*`; dann kann der Worker `core/` nicht teilen.
Mit esbuild anzupassen: `tools/build_site.mjs`, `tools/build_stage.mjs`, `tests/run_ci.mjs` (Syntaxcheck), `sw.js`-Assetliste, README «lokal ansehen».
Unit-Tests für `core/` direkt in Node (ohne jsdom) – schnell.

## Schritt 3 – `store` – Speicher erledigt, Zustand offen

Gebaut (11.11.2026): `static/store.js` (`BF_STORE`) mit allen Schlüsseln (gemeinsam / Abgleich / nur dieses Handy), `load`, `save`, `remove`, `loadText`, `saveText`, `allKeys`; `app.js` greift nicht mehr direkt auf `localStorage` zu.
Offen: der Zustand selbst (`state` plus `viewNext`, `curPlan`, `nextDoc`, `sync`, `vote`) in einem Objekt mit `subscribe`. Das gehört zum Aufteilen der Ansichten (Schritt 5 / Variante 4), weil erst dann klar ist, welche Ansicht was braucht.

Ein Objekt für den ganzen Zustand inkl. angezeigter Woche; alle localStorage-Schlüssel und ihre Migrationen (`LEGACY_KEYS`, alte Wochenwahl) an einer Stelle; `subscribe` statt verstreuter `refresh()`-Aufrufe. Keine Änderung am gespeicherten Format.

## Schritt 4 – Sync mit Versionsnummern – erledigt

Gebaut, einfacher als unten skizziert: als Version dient der Server-Stempel `updated` selbst (kein neues Feld, alte Dokumente passen).
- Worker `putDoc`: `base` ≠ gespeicherter Stempel → `409` mit aktuellem Dokument; Stempel steigen immer. Ohne `base` wie früher.
- App: `bringfrisch_base_<plan|next|vorrat|settings>` = Stempel + Inhalt beim letzten Abgleich. `syncCase` (take / push / merge) vergleicht nur auf Gleichheit, nie zwei Uhren. `merge3` pro Tag (`dayView`: was ein Mensch ändert), pro Vorrat-Artikel, pro Einstellung.
- Handys ohne gemerkten Stand (direkt nach dem Update) verhalten sich einmal wie früher.
- Tests: `tests/sync_merge.test.mjs` (rot mit altem Code), `worker/test.mjs`.
- Bekannte Grenze: KV kann nicht «prüfen und schreiben» in einem Schritt; zwei Speicherungen in derselben Sekunde können sich noch überholen. Für eine WG vernachlässigbar, mit D1 ganz lösbar.

Ursprüngliche Skizze:

Heute viermal von Hand «neuerer gewinnt» (Plan, nächste Woche, Vorrat, Einstellungen), Vergleich Handy-Uhr gegen Server-Uhr, PUT ohne Vorbedingung.

- Worker: jedes Dokument bekommt `rev` (Zähler). `PUT` nimmt `base` (die `rev`, auf der die Änderung aufbaut). `base` veraltet → `409` mit aktuellem Dokument. Ohne `base` (alte App) Verhalten wie heute.
- App: ein `syncDoc(name, merge)` für alle vier. Bei `409` zusammenführen und erneut senden:
  Plan pro Tag (geänderte Tage gewinnen, Rest vom Server), Vorrat pro Artikel, Einstellungen pro Feld.
- Zeitstempel nur noch vom Server.
- Tests: `tests/integration.test.mjs` (2 Handys) um «beide ändern verschiedene Tage» und «Handy-Uhr geht falsch» erweitern.

## Schritt 5 – Ansichten und CSS – CSS erledigt, Ansichten offen

Gebaut (11.11.2026): `static/app.css` (650 Zeilen, vorher `<style>` in `index.html`); `index.html` hat noch 439 Zeilen (27 KB statt 78 KB).
Gebaut (12.11.2026): `app.js` in Dateien aufgeteilt – **klassische Skripte mit gemeinsamem Namensraum `BF_APP`** (wie `BF_CORE` / `BF_STORE`), kein Bündler, kein Bau-Schritt, Verhalten unverändert. Echte Module (`<script type="module">`) gingen nicht: jsdom (alle App-Tests) führt keine Module aus, und ein Bündelschritt nur für Tests hätte geprüft, was nicht ausgeliefert wird.

| Datei | Zeilen | Inhalt |
|---|---|---|
| `app.js` | ~340 | Grundlage: Konstanten (`APP_VERSION`, `DEFAULT_SYNC_URL` – Build-Skripte ersetzen sie hier), Zustand (`state`, Woche), Speichern, Hilfsfunktionen, `refresh()`; legt `BF_APP` an |
| `app_plan.js` | ~520 | Plan-Ansicht: Tage, Menü-Blatt, Dichte, Bring!-Chip, Woche wechseln, Plan teilen |
| `app_einkauf.js` | ~110 | Einkauf, Bring! füllen per Teilen/Kopieren |
| `app_vorrat.js` | ~125 | Grundvorrat |
| `app_rezepte.js` | ~395 | Rezepte & Saison, Katalog, eigenes Rezept, Link-Import |
| `app_wahl.js` | ~390 | Wochenwahl (Memory), Bilder, Pop-up |
| `app_sync.js` | ~530 | Abgleich mit dem WG-Server (`syncCase`, `merge3`, `push…Now`, `pullShared`), Bring! über den Bot |
| `app_einstellungen.js` | ~365 | Einstellungen + Willkommen, Bring!-Liste, Kalender, «Aktualisieren» |
| `app_theme.js` | ~170 | Formen, Stil iPhone/Android, Farben, Hell/Dunkel |
| `app_start.js` | ~95 | Navigation, Plan laden, erstes Zeichnen |

Regeln: Was `app.js` anbietet, holt jede Datei oben mit `const { … } = app;`. Was aus einer anderen `app_*.js` kommt, heisst `app.name` (steht erst bereit, wenn alle Dateien geladen sind – beim Laden selbst nur Eigenes und `app.js` aufrufen). Veränderliche Werte, die mehrere Dateien sehen (`app.viewNext`, `app.curPlan`, `app.nextDoc`, `app.vote`, `app.sync`, `app.mySites`, Push-Timer), stehen nur unter `app`. Tests: gemeinsamer Lader `tests/app_html.js`; `tests/assets.test.mjs` prüft, dass alles aus `index.html` in `STATIC_ASSETS` von `sw.js` steht, und die Reihenfolge der Skripte.

Offen (Variante 4, später): echte Module und **ein Zustand** (`state` + die `app.*`-Werte oben in einem Objekt mit `subscribe`). CSS aus `app.css` in Dateien pro Bereich – zusammen mit dem Redesign der drei alten Seiten (plan.md), nicht vorher separat.

Danach, nicht vorher: **Grundvorrat neu gestalten zusammen mit Joshua** (siehe `plan.md`, Rückmeldung 11.11.2026: direktes Schreiben auf Bring!, Hinzufügen und Wegnehmen gefallen so nicht). Varianten zuerst als HTML zeigen.

## Schritt 6 – Worker – teilweise erledigt

Gebaut: `bringAuth` merkt die Anmeldung (Instanz + KV `bringtoken`, nicht in der Sicherung), `bringFetch` meldet bei 401 einmal frisch an.
Datei aufgeteilt (11.11.2026): `index.js` (Endpunkte), `auth.js`, `speicher.js`, `bring.js`, `kalender.js`, `rezept.js`, `http.js`; Wrangler-Bündel geprüft.
Offen: Batch-Schnittstelle (braucht einen Live-Test gegen «Home-test», geht nicht ohne Zugangsdaten).

- Aufteilen: `router`, `auth`, `bring`, `speicher`, `kalender`, `rezept-import`, `sicherung`.
- `bringLogin`: Access-Token im Speicher des Workers und in KV halten (Ablaufzeit aus der Bring!-Antwort), bei 401 neu anmelden. Spart einen Aufruf pro Anfrage.
- Batch-Schnittstelle `PUT bringlists/{uuid}/items` (plan.md «Später») → ein Aufruf statt einer pro Artikel, 45er-Limit fällt weg. Zuerst gegen «Home-test» live prüfen (`tests/stage_live.mjs`).

## Schritt 7 – Start und Cache – erledigt (ohne Schrift)

Gebaut: `sw.js` bleibt Network-First, wartet aber höchstens 2.5 s und liefert dann aus dem Cache (danach 30 s direkt aus dem Cache). Gemessen mit 15 s langsamem Netz: 2.6 s statt über 15 s. `build_site.mjs` setzt im Release die Version als Cache-Namen ein.
Bewusst nicht «zuerst Cache»: das hätte geändert, wann eine neue Version ankommt.
Offen: Schrift kürzen (braucht `fonttools`, optischer Vergleich nötig).

- `sw.js`: App-Dateien zuerst aus dem Cache, im Hintergrund aktualisieren; die bestehende Versionsprüfung (`checkUpdate`) meldet Neues.
- `CACHE_NAME` und Assetliste beim Bauen aus der Version erzeugen (heute von Hand hochzählen).
- Schrift: Roboto Flex (196 KB) auf benutzte Achsen/Zeichen kürzen; vorher/nachher mit `layout_check.mjs --shots` vergleichen.

## Schritt 8 – D1 (nur bei Bedarf)

`docs/plan-d1.md` bleibt gültig, aber erst für geteilte Rezepte zwischen WGs. `speicher` aus Schritt 6 ist die Naht dafür.

## Nicht machen

- Flutter oder ein UI-Framework (Entscheid 23; Zeichnen ist kein Engpass).
- Hosting wechseln. Seite + Server in einem Worker (wie die Test-Version) wäre einfacher, ändert aber die Adresse der installierten App → nur bei anderem Anlass.
