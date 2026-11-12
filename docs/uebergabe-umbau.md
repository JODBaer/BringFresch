# Übergabe: Umbau (Review-Chat) → nächster Chat

Stand 12.11.2026. `main` enthält alles unten Genannte. Für den Einstieg: Abschnitt 0 (Startprompt) am Ende von Abschnitt 4. **Live für die WG ist `v1.7.3`** (`a9192ab`, mit der Abgleich-Korrektur).
**Weiter im lokalen Chat** (Cloud-Chat kann keine Tags pushen). Mehrere Chats haben am 12.11. gleichzeitig am Grundvorrat-Entwurf gearbeitet → ab jetzt nur noch einer.
Arbeitsregeln stehen in `CLAUDE.md`; Einzelheiten zum Umbau in `docs/refactoring-plan.md`, Überblick mit Diagramm in `docs/architektur-review.html`.

## 1. `v1.7.3` – erledigt (12.11.2026)

Der Tag ist auf GitHub. Abschnitt bleibt als Anleitung für das nächste Release.

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
| 4 Abgleich mit Versionen | erledigt (+ Korrektur, siehe 1) | `app_sync.js`: `syncCase`, `merge3`, `push…Now`; `worker/src/speicher.js`: `putDoc` |
| 5 Ansichten / CSS | erledigt (12.11., klassische Skripte mit Namensraum `BF_APP`); **Variante 4 + ein Zustand offen** | `static/app.css`; `static/app.js` (Grundlage) + `app_plan`, `app_einkauf`, `app_vorrat`, `app_rezepte`, `app_wahl`, `app_sync`, `app_einstellungen`, `app_theme`, `app_start` (Einzelheiten: `docs/refactoring-plan.md`, Schritt 5) |
| 6 Worker | Anmeldung gemerkt, Datei aufgeteilt; Batch gebaut (Live-Beweis in `stage_live.mjs` ausstehend) | `worker/src/`: `index`, `auth`, `speicher`, `bring`, `kalender`, `rezept`, `http` |
| 7 Start | erledigt, **Schrift offen** | `sw.js`: höchstens 2.5 s aufs Netz warten; Cache-Name im Release = Version |
| 8 D1 | bewusst nicht | nur für geteilte Rezepte zwischen WGs nötig |

## 3. Was offen ist

1. ~~`app.js` in Ansichten aufteilen~~ – **erledigt 12.11.2026** als klassische Skripte mit gemeinsamem Namensraum `BF_APP` (kein Bündler, kein Bau-Schritt, Verhalten unverändert): `app.js` (Grundlage, ~340 Zeilen) + 9 Dateien `app_*.js`. Echte Module gingen nicht: jsdom (alle App-Tests) führt keine `<script type="module">` aus. Test-Lader: `tests/app_html.js`; `tests/assets.test.mjs` sichert die `sw.js`-Liste und die Reihenfolge ab.
   **Offen: «Variante 4» = ein Zustand** (`state` + `app.viewNext`, `app.curPlan`, `app.nextDoc`, `app.vote`, `app.sync`, `app.mySites` in einem Objekt mit `subscribe`) und ggf. echte Module – dafür müssten die jsdom-Tests die App anders laden (z.B. im echten Browser wie `ui_e2e.mjs`). Beim Laden dürfen die Dateien nur Eigenes und `app.js` aufrufen; was aus anderen `app_*.js` kommt, erst später (`app.name`).
2. **Bring! in einem Aufruf** (`PUT bringlists/{uuid}/items`): hebt das 45-Artikel-Limit auf. Braucht einen Live-Test gegen «Home-test» (`tests/stage_live.mjs`), darum nicht blind gebaut.
3. **Schrift kürzen**: Roboto Flex 196 KB, grösste Datei. Braucht `fonttools` und einen optischen Vergleich (`layout_check.mjs --shots`).
4. **Grundvorrat neu** (siehe 4).

## 4. Grundvorrat – Stand mit Joshua

**Entschieden (11.11.2026): Variante C.** Joshua: «Wir nehmen C, aber ich brauche noch ein paar Gedanken.» → Die Richtung steht, die Einzelheiten nicht. Vor dem Bauen mit ihm durchgehen; Änderungen zuerst im Entwurf zeigen (er kommentiert direkt auf der Seite).
Entwurf zum Antippen: `docs/design/grundvorrat-varianten.html` (Varianten A und B sind der alte Vergleich; massgebend ist C). In der App ist davon **nichts** gebaut.
Laut Joshua war das Ändern im heutigen Grundvorrat schon vor `v1.7.0` defekt → zuerst im echten Betrieb nachstellen (nicht reproduziert).

So sieht C heute aus:
- **Einkauf (vorne)** mit den drei gewohnten Bereichen:
  - «Kaufen»: aus dem Plan + «Aus dem Vorrat – wird knapp»; unten «Für Bring! (n) · Prüfen» (Liste mit Häkchen, dann senden; Bring!-Eintrag mit Vermerk «Vorrat · Menge»)
  - «Auf Bring!»: was auf der Liste steht
  - «Vorrat»: Schalter «Woche gekocht» (bucht ab, zurück = rückgängig; ab Montag wird die letzte Woche von selbst abgebucht), «Knapp», «Diese Woche aus dem Vorrat» (vorher → nachher), «Alles da» aufklappbar, Knopf «Grundvorrat verwalten»
  - Stand 12.11.: der Bereich «Vorrat» ist eine **Liste** wie «Kaufen» («Diese Woche gebraucht» mit noch da → danach, «Geht oft aus – noch da?» als Vorschläge, «Sonst knapp»); Zeile antippen = im Vorrat leer (durchgestrichen). «Geht jede Woche aus» ist ein Vermerk am Artikel, später Muster erkennen
  - Bring!-Knopf oben rechts / «Prüfen» öffnet eine **Gegenüberstellung** in zwei Spalten (links Kaufen aus dem Plan, rechts Vorrat); antippen = kommt auf Bring!, gesendet wird erst mit dem Knopf
  - Karte lange drücken = Rückseite: oben klein der Name, in der Mitte grosses rotes ✕, unten klein − Zahl + (Joshua 12.11.: «X gross, ± und Anzahl klein, in der Mitte»); kein Zurück-Knopf, daneben tippen oder Esc dreht zurück
  - Vorschläge «Geht oft aus»: vermerkt im Blatt oder von der App erkannt («erkannt: 3 von 4 Wochen leer», im Entwurf Butter). Für den Bau: dafür muss die App pro Artikel mitschreiben, wann er leer gemeldet wurde – gibt es heute nicht
  - Bring!-Knopf: antippen **oder** lange drücken öffnet die Gegenüberstellung
- **Grundvorrat (dahinter)**: eine Ansicht – hinzufügen (Vorschlag aus Bring!-Namen), Übersicht in einer Zeile, drei Kacheln pro Zeile, Aufteilung umstellbar Abteilung / Dringend, Inventur-Knopf am Ende
- **Kachel**: antippen = ein Blatt mit allem (Bring!-Bild – im Entwurf Platzhalter –, Menge − + und Leer / Fast leer / Halb / Voll, «1 Stück =», Infos, Name ändern, Doppelte zusammenführen, wegnehmen); lange drücken = Karte dreht sich, hinten «Wegnehmen» (mit Rückgängig)
- **Mengen**: Stück mit Grösse («2 × 1 l») oder «reicht für ~N Znacht»; in Bring! abgehakt = Vorrat + eine Packung
- **Knapp**: 2 oder weniger; bei Artikeln mit nur 1–2 Packungen erst unter einer vollen Packung
- **Inventur** einmal im Jahr (vier Knöpfe pro Artikel); Markierung «über ein Jahr im Vorrat»
- **Standard-Vorrat**: 50 Bring!-Standardartikel, Liste in `plan.md`

Von Joshua noch offen / nicht bestätigt:
- Nach dem ✕ auf der Karte kommt kurz «Rückgängig» – soll das auch weg? (gefragt 12.11.)
- «Alles da» beim Einkauf: ein Chat hat es entfernt (nur im Grundvorrat), Joshua hatte es am 11.11. beim Einkauf gewünscht – nachfragen
- Kommentar «Übersicht über allem geht so, jedes Element ist für sich geschlossen» – ob die Übersichtszeile und die neue Einkauf-Seite das lösen
- − + direkt auf der Kachel (war im Reiter «Verwalten», der weggefallen ist) – ja oder nein
- drei Bereiche als Reiter (so im Entwurf) oder wirklich als drei Spalten nebeneinander (auf dem Handy zu schmal für Name + Menge – meine Einschätzung)
- Einheiten ohne Gramm / Milliliter (mein Vorschlag); Knappes nie von selbst auf Bring! (mein Vorschlag, im Entwurf so)
- Doppelte auch in Bring! zusammenführen: nur für Einträge möglich, die der Bot selbst gesetzt hat
- Auswahl des Standard-Vorrats (meine Einschätzung, keine Kaufdaten)
Technische Grenzen: Bring! meldet nicht, wie viel gekauft wurde; Vermerk nur über die Mengenangabe; «seit wann im Vorrat» wird heute nicht gespeichert; echte Bring!-Bilder gibt es nur für Katalogartikel.
Betroffene Regeln beim Bau: `CLAUDE.md` «Grundvorrat wie Bring!: Antippen = direkt auf Bring!», Entscheide 16 und 22, `plan.md` «Grundvorrat verwalten» und «Grundvorrat zählt mit». Neue Daten pro Artikel (Menge, Einheit, Packung, Grösse, seit wann) gehören in `/vorrat` und laufen über den bestehenden Abgleich (`merge3` pro Artikel).

## 0. Startprompt für den neuen Chat

```
Lies zuerst CLAUDE.md, dann docs/uebergabe-umbau.md, plan.md (Eintrag «Grundvorrat neu gestalten») und entscheide.md.
Stand: main enthält den Umbau; live ist v1.7.3.
Weiter: Grundvorrat nach Variante C (docs/design/grundvorrat-varianten.html). Joshua hat C gewählt, will die
Einzelheiten aber noch besprechen – nichts in der App bauen, bevor er die offenen Punkte (Abschnitt 4) geklärt hat.
Änderungen am Entwurf zuerst zeigen (Entwurf-Seite: https://claude.ai/artifact/AcdnCScLyJd1kkfy1J6b8i,
Joshua kommentiert dort; Datei im Repo und Seite immer gleich halten). Vor jedem Abschluss: cd tests && npm run ci.
```

## 5. Stolpersteine

- `sw.js`: bei jedem Merge kollidiert `CACHE_NAME` → höhere Zahl + 1.
- CSS gehört nach `app.css`, Regeln nach `core.js`, Schlüssel nach `store.js` (nicht mehr `index.html` / `app.js`). Ansicht-Code in die passende `app_*.js`; neue Datei = in `index.html` (vor `app_start.js`) und in `STATIC_ASSETS` von `sw.js` eintragen, sonst wird `tests/assets.test.mjs` rot.
- `APP_VERSION` und `DEFAULT_SYNC_URL` bleiben in `app.js`: Build-Skripte ersetzen sie dort, «Aktualisieren» liest die Version aus `app.js`.
- Neue Dokumente, die mehrere Handys ändern: im Worker über `putDoc` speichern, in der App über `syncCase` / `merge3` abgleichen.
- Rezepte oder Zutaten geändert → `einkauf_snapshot.test.js` schlägt an; gewollt = `node einkauf_snapshot.test.js --update`.
- UI-Test «Grundvorrat verbunden» (Android dunkel) wackelt gelegentlich beim ersten Versuch (war schon vor dem Umbau so).
- Jeder Push auf `main` startet die Test-Version neu und bricht den laufenden Lauf ab → vor einem Release nichts pushen.
