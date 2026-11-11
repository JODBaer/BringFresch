# Übergabe: Umbau (Review-Chat) → nächster Chat

Stand 11.11.2026 abends. `main` enthält alles unten Genannte. **Live für die WG ist `v1.7.2`** (`eab7427`).
Arbeitsregeln stehen in `CLAUDE.md`; Einzelheiten zum Umbau in `docs/refactoring-plan.md`, Überblick mit Diagramm in `docs/architektur-review.html`.

## 1. Zuerst: `v1.7.3` veröffentlichen

Auf `main` liegt eine **Korrektur am Abgleich, die noch nicht live ist** (Commit `f8d0519`):
In `v1.7.0`–`v1.7.2` können eigene Änderungen an Plan oder Grundvorrat zurückspringen, wenn der Speicher des WG-Servers (Cloudflare KV)
kurz nach dem Speichern noch den alten Stand liefert. Nachgestellt in `tests/sync_merge.test.mjs` (Abschnitt 6), in der echten WG nicht beobachtet.

```
git fetch origin --tags
git log --oneline -1 origin/main      # auf GitHub prüfen: Lauf «Test-Version» für diesen Commit ist grün
git tag v1.7.3 origin/main
git push origin v1.7.3
```
Befehle einzeln ausführen (PowerShell kennt kein `&&`). Der Cloud-Chat kann keine Tags pushen («remote end hung up»), nur Branches.

## 2. Was vom Umbau erledigt ist

| Schritt | Stand | Wo |
|---|---|---|
| 0 Fehler | erledigt | Vorrat- und Bring!-Abgleich auf ganze Wörter (`core.js`: `hasWord`, `inStaples`); PIN-Sperre pro WG und Absender, auch erste WG (`worker/src/auth.js`); Weiterleitungen geprüft (`http.js`: `safeFetch`) |
| 1 Sicherheitsnetz | erledigt | `tests/einkauf_snapshot.test.js`, `tests/zutaten.test.js`, `tests/snapshots/` |
| 2 Regeln herauslösen | erledigt (Variante 3, ohne Bündler) | `static/core.js` (`BF_CORE`): Woche, Portionen, Zutaten, Einkaufsliste, Wochenwahl-Regeln. Worker importiert dieselbe Datei. `tests/core.test.mjs` |
| 3 Speicher / Zustand | Speicher erledigt, **Zustand offen** | `static/store.js` (`BF_STORE`): alle localStorage-Schlüssel |
| 4 Abgleich mit Versionen | erledigt (+ Korrektur, siehe 1) | `app.js`: `syncCase`, `merge3`, `push…Now`; `worker/src/speicher.js`: `putDoc` |
| 5 Ansichten / CSS | CSS erledigt, **Ansichten offen** | `static/app.css` |
| 6 Worker | Anmeldung gemerkt, Datei aufgeteilt; **Batch offen** | `worker/src/`: `index`, `auth`, `speicher`, `bring`, `kalender`, `rezept`, `http` |
| 7 Start | erledigt, **Schrift offen** | `sw.js`: höchstens 2.5 s aufs Netz warten; Cache-Name im Release = Version |
| 8 D1 | bewusst nicht | nur für geteilte Rezepte zwischen WGs nötig |

## 3. Was offen ist

1. **`app.js` in Ansichten aufteilen + ein Zustand = «Variante 4»** (Joshua: «zuerst 3, später 4»). `app.js` (~2900 Zeilen) ist eine einzige Funktion; ~150 Funktionen teilen sich Variablen (`state`, `viewNext`, `curPlan`, `nextDoc`, `sync`, `vote`).
   Aufteilen heisst echte Module (`<script type="module">`) **und** die Tests umbauen: alle jsdom-Tests laden die App, indem sie `<script src>` in `index.html` durch den Dateiinhalt ersetzen – mit Modulen geht das so nicht.
   Vorgehen: zuerst die Test-Lader umstellen (z.B. Module per `import` in jsdom oder ein kleiner Bündelschritt nur für Tests), dann Ansicht für Ansicht herauslösen, nach jedem Schritt `npm run ci`. Nur in einem Zeitfenster, in dem kein anderer Chat an `app.js` arbeitet. `sw.js`-Liste per Test gegen die geladenen Dateien absichern.
2. **Bring! in einem Aufruf** (`PUT bringlists/{uuid}/items`): hebt das 45-Artikel-Limit auf. Braucht einen Live-Test gegen «Home-test» (`tests/stage_live.mjs`), darum nicht blind gebaut.
3. **Schrift kürzen**: Roboto Flex 196 KB, grösste Datei. Braucht `fonttools` und einen optischen Vergleich (`layout_check.mjs --shots`).
4. **Grundvorrat neu** (siehe 4).

## 4. Grundvorrat – Stand der Diskussion mit Joshua

Entwurf zum Antippen: `docs/design/grundvorrat-varianten.html` (auch als Artifact veröffentlicht). **Variante C ist vorne, entschieden ist noch nichts.**
Laut Joshua war das Ändern im heutigen Grundvorrat schon vor `v1.7.0` defekt → zuerst nachstellen.
Was Variante C nach seinen Kommentaren zeigt (alles nur im Entwurf, nichts in der App):
- Menge pro Artikel: Stück mit Grösse («2 × 1 l», «1 Stück =» änderbar) oder «reicht für ~N Znacht»
- drei Kacheln pro Zeile; Aufteilung umstellbar «Dringend» (Knapp · Diese Woche gebraucht · Alles da) / «Abteilung» (wie Bring!); Übersicht in einer Zeile
- Schalter «Woche gekocht» bucht ab, zurückschieben = rückgängig
- Knappes (≤ 2) wird gesammelt und nach «Prüfen» gesendet, nie von selbst; Bring!-Eintrag mit Vermerk «Vorrat · Menge»; in Bring! abgehakt = Vorrat + eine Packung
- «Verwalten»: gleiche Kacheln mit − + ✕
- **ein** Blatt pro Artikel, überall gleich (aus «Vorrat» und «Verwalten»): Bring!-Bild (im Entwurf Platzhalter), Menge, Infos, Name ändern, Doppelte zusammenführen, wegnehmen
- Inventur (einmal im Jahr, vier Knöpfe pro Artikel), Knopf unauffällig am Ende der Liste; Markierung «über ein Jahr im Vorrat»
Offen / von Joshua noch nicht bestätigt: Einheiten ohne Gramm / Milliliter; Knappes nie automatisch auf Bring!.
Technische Grenzen: Bring! meldet nicht, wie viel gekauft wurde; Vermerk nur über die Mengenangabe; «seit wann im Vorrat» wird heute nicht gespeichert. Anforderungen ausführlich in `plan.md` («Grundvorrat neu gestalten»).

## 5. Stolpersteine

- `sw.js`: bei jedem Merge kollidiert `CACHE_NAME` → höhere Zahl + 1.
- CSS gehört nach `app.css`, Regeln nach `core.js`, Schlüssel nach `store.js` (nicht mehr `index.html` / `app.js`).
- Neue Dokumente, die mehrere Handys ändern: im Worker über `putDoc` speichern, in der App über `syncCase` / `merge3` abgleichen.
- Rezepte oder Zutaten geändert → `einkauf_snapshot.test.js` schlägt an; gewollt = `node einkauf_snapshot.test.js --update`.
- UI-Test «Grundvorrat verbunden» (Android dunkel) wackelt gelegentlich beim ersten Versuch (war schon vor dem Umbau so).
- Jeder Push auf `main` startet die Test-Version neu und bricht den laufenden Lauf ab → vor einem Release nichts pushen.
