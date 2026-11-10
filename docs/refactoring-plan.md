# Refactoring-Plan (Arbeitsfassung für Claude)

Stand 10.11.2026, App 1.5.2. Überblick mit Diagramm: `docs/architektur-review.html`.
**Noch nichts gebaut.** Reihenfolge einhalten; jeder Schritt ist einzeln releasbar und endet mit `cd tests && npm run ci` grün.
Regeln aus `CLAUDE.md` gelten (eigener Worktree, nur eigene Pfade committen, neue Funktion = neuer Schritt in `tests/ui_e2e.mjs`).

## Ausgangslage (gemessen)

| Datei | Zeilen | Inhalt |
|---|---|---|
| `static/app.js` | 2985 (141 KB, 42 KB gzip) | eine IIFE, ~150 Funktionen: Regeln, Ansicht, Sync, Theme |
| `static/index.html` | 1049 (77 KB) | ~600 Zeilen CSS, 4 Tabs, 7 Dialoge |
| `worker/src/index.js` | 647 | Routen, PIN, Bring!, Kalender, Rezept-Import, Sicherung |
| `tests/ui_e2e.mjs` | 1475 | UI-Test, das wichtigste Sicherheitsnetz |

Zustand der App liegt verteilt in `state`, in losen Variablen (`viewNext`, `curPlan`, `nextDoc`, `sync`, Timer) und in ~15 localStorage-Schlüsseln.
Tests laden die App, indem sie `<script src>` in `index.html` durch den Dateiinhalt ersetzen (jsdom, `runScripts`). ES-Module direkt im Browser würden diese Tests brechen.

## Schritt 0 – Fehler flicken (kein Umbau)

1. **Vorrat-Abgleich** (`computeShopping`, `isStaple: stapleKeywords.some(k => lower.includes(k))`): Teilwort-Treffer.
   Betroffen laut Rezeptdaten u.a.: «Mehlig kochende Kartoffeln» (→ Mehl), «Pfefferminze» (→ Pfeffer), «Rote/Gelbe/Massaman-Currypaste» (→ Currypulver), «Kleine Essiggurke» (→ Essig), «Chilischote», «Chili Crunch» (→ Chiliflocken), «Kräuterquark», «Kräuterkäse», «Frischkäse mit Kräutern» (→ Kräuter), «Ungesalzene Cashewkerne» (→ Salz), «Paniermehl», «Buchweizenmehl» (→ Weissmehl; hier fachlich klären, ob gewollt).
   Fix: Abgleich auf ganze Wörter bzw. auf den Bring!-Artikel (`bringItemId`) statt auf Teilzeichenketten. Synonym «mehlig kochende kartoffeln» ergänzen.
2. **Bring!-Abgleich** (`isOnBring: b.includes(lower) || lower.includes(b)`): gleiche Ursache. «Butter» auf Bring! deckt Butternuss-Kürbis/Butterblätterteig ab, «Rahm» deckt Doppelrahm/Rahmquark, «Milch» die Kokosmilch. Fix: gleicher Name oder gleicher Bring!-Artikel.
3. **Test dazu**: alle Zutaten aller Rezepte durch den Abgleich; Liste der erlaubten Vorrat-Treffer als feste Erwartung in `tests/`.
   Erst den Test schreiben und rot sehen (die Befunde sind aus Code + Daten hergeleitet, nicht in der App nachgestellt).
4. **PIN-Sperre für die erste WG** (`requireWg`): der Zweig für `MAIN_WG` zählt keine Fehlversuche. Gleiche Zählung (`fail:`/`lock:`) wie bei weiteren WGs; Test in `worker/test.mjs`.
5. Klein: `importRecipe` mit `redirect: "manual"` und Host-Prüfung pro Weiterleitung (max. 3).

## Schritt 1 – Sicherheitsnetz vor dem Verschieben

Schnappschuss-Test: für jedes Rezept (98) mit fester WG und festem Puffer `computeShopping` + `bringPayload` → JSON in `tests/snapshots/`. Jede spätere Abweichung muss bewusst bestätigt werden.

## Schritt 2 – `core/` herauslösen

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

## Schritt 3 – `store`

Ein Objekt für den ganzen Zustand inkl. angezeigter Woche; alle localStorage-Schlüssel und ihre Migrationen (`LEGACY_KEYS`, alte Wochenwahl) an einer Stelle; `subscribe` statt verstreuter `refresh()`-Aufrufe. Keine Änderung am gespeicherten Format.

## Schritt 4 – Sync mit Versionsnummern

Heute viermal von Hand «neuerer gewinnt» (Plan, nächste Woche, Vorrat, Einstellungen), Vergleich Handy-Uhr gegen Server-Uhr, PUT ohne Vorbedingung.

- Worker: jedes Dokument bekommt `rev` (Zähler). `PUT` nimmt `base` (die `rev`, auf der die Änderung aufbaut). `base` veraltet → `409` mit aktuellem Dokument. Ohne `base` (alte App) Verhalten wie heute.
- App: ein `syncDoc(name, merge)` für alle vier. Bei `409` zusammenführen und erneut senden:
  Plan pro Tag (geänderte Tage gewinnen, Rest vom Server), Vorrat pro Artikel, Einstellungen pro Feld.
- Zeitstempel nur noch vom Server.
- Tests: `tests/integration.test.mjs` (2 Handys) um «beide ändern verschiedene Tage» und «Handy-Uhr geht falsch» erweitern.

## Schritt 5 – Ansichten und CSS

`views/plan`, `einkauf`, `saison`, `einstellungen`, `wochenwahl`, `willkommen`, `theme`. CSS aus `index.html` in Dateien pro Bereich. Zusammen mit dem geplanten Redesign der drei alten Seiten erledigen (plan.md), nicht vorher separat.

## Schritt 6 – Worker

- Aufteilen: `router`, `auth`, `bring`, `speicher`, `kalender`, `rezept-import`, `sicherung`.
- `bringLogin`: Access-Token im Speicher des Workers und in KV halten (Ablaufzeit aus der Bring!-Antwort), bei 401 neu anmelden. Spart einen Aufruf pro Anfrage.
- Batch-Schnittstelle `PUT bringlists/{uuid}/items` (plan.md «Später») → ein Aufruf statt einer pro Artikel, 45er-Limit fällt weg. Zuerst gegen «Home-test» live prüfen (`tests/stage_live.mjs`).

## Schritt 7 – Start und Cache

- `sw.js`: App-Dateien zuerst aus dem Cache, im Hintergrund aktualisieren; die bestehende Versionsprüfung (`checkUpdate`) meldet Neues.
- `CACHE_NAME` und Assetliste beim Bauen aus der Version erzeugen (heute von Hand hochzählen).
- Schrift: Roboto Flex (196 KB) auf benutzte Achsen/Zeichen kürzen; vorher/nachher mit `layout_check.mjs --shots` vergleichen.

## Schritt 8 – D1 (nur bei Bedarf)

`docs/plan-d1.md` bleibt gültig, aber erst für geteilte Rezepte zwischen WGs. `speicher` aus Schritt 6 ist die Naht dafür.

## Nicht machen

- Flutter oder ein UI-Framework (Entscheid 23; Zeichnen ist kein Engpass).
- Hosting wechseln. Seite + Server in einem Worker (wie die Test-Version) wäre einfacher, ändert aber die Adresse der installierten App → nur bei anderem Anlass.
