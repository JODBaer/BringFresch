# 🥬 BringFrisch

WG-Menüplaner mit Schweizer Saisongemüse. Die WG wählt gemeinsam 7 Znacht für die Woche, die App rechnet die Mengen für alle Anwesenden (plus Reste fürs Zmittag) und schreibt die Einkaufsliste direkt in **Bring!**.

**App:** <https://jodbaer.github.io/BringFresch/> (auf dem Handy öffnen → «Zum Home-Bildschirm»)

## Erster Start

Neues Handy: **WG-Name + PIN** eingeben → **«Wer bist du?»** antippen (leere WG: sich selbst eintragen). Fertig.
Mit «Verbinden» gelten die [Nutzungsbedingungen, Datenschutz und Cookies](https://jodbaer.github.io/BringFresch/static/rechtliches.html) (auch klein unten in den Einstellungen). «Ohne WG ausprobieren» = nur auf diesem Handy.
Unsere WG: Name **`Allmen`** + bisheriger PIN (`wg1` geht auch; schon verbundene Handys merken nichts).

## Bedienung (Plan)

- **Tag** (Kreis links) antippen = Menü auf-/zuklappen: Zutaten mit Mengen, «Zum Rezept ↗», «Wechseln».
- **Gericht** antippen = Menü wechseln (Suche, «Beliebt bei euch» oben, eigenes Menü eintippen, «Rückgängig»).
- **Kreise** = wer mitisst (antippen = an/ab, abwesend = grau mit Strich). **+N** daneben = Reste.
- **Zahl** rechts = Portionen (Personen + Reste): antippen = +1 (bis +6, dann wieder 0), **▾** = Auswahl.
- Oben: **Kalender-Symbol** = Wochenwahl (roter Punkt = noch offen), **🛒 Bring!-Chip** = füllen.
- **Ab Donnerstag** steht rechts über den Tagen **«KW 47 →»**: antippen (oder seitlich wischen) = nächste Woche planen. Tage sind zuerst «noch offen», Wochenwahl, Bring! und Kalender gelten für die angezeigte Woche. Am Montag wird sie automatisch zur laufenden.
- Unten: Plan · Einkauf · Rezepte & Saison · Einstellungen (jede direkt als Seite; Einstellungen: Bring!-Liste und Mitbewohner oben, der Rest unter «Mehr»).
- **WG-Einstellungen für alle**: Mitbewohner, Znacht-Zeit, Rezept-Webseiten und eigene Rezepte gelten auf allen Handys (Einstellungen → «Speichern & an alle senden», sonst automatisch beim Ändern/Herunterziehen).
- **Saison**: Gemüse mit Bild, einfache Namen; antippen = «Spinat Rezept» kopiert und ins Suchfeld, ergänzen (z.B. Risotto) → «Suchen».
- **Rezepte**: Webseiten zum Stöbern (eigene hinzufügbar), Link einfügen → Zutaten werden geholt (jede Rezeptseite, auch geteilter Text), Personenzahl gleich angeben; eigene Rezepte bearbeiten, Katalog-Rezepte «Anpassen» (eigene Kopie, z.B. andere Personenzahl).
- iPhone bekommt den Glas-Stil, Android Material 3 – automatisch. Design-Vorgabe: [docs/design/](docs/design/).

## So funktioniert's

1. **🃏 Wochenwahl**: 14 Gerichte – 12 saisonale (halb vegi, halb Fleisch) + 2 schnelle/Reste (⚡ Pizza, Nuggets, Gnocchi … · ♻️ Resteessen). Alle tippen auf dem eigenen Handy ihre Favoriten an, optional mit Wunschtag. «Neu mischeln» tauscht Gerichte ohne Stimme aus.
2. **📅 Plan**: Die Top 7 landen an Tagen, an denen ihre Fans zuhause sind. Pro Tag: wer isst mit (`J L Le Jo`), Reste-Puffer +0 … +6, Menü antippen zum Wechseln.
3. **🛒 Bring! füllen**: Gemeinsame Basis + Protein pro Person (Fleisch / Vegi, z.B. Vegi-Nuggets für Jo) + Salat.
   - Fehlendes kommt direkt auf Bring!, mit Bring!-Bild (z.B. «Kürbis · 1 kg, Butternuss-Kürbis»).
   - Steht etwas schon drauf, fragt die App pro Artikel nach (z.B. zweites Rezept braucht mehr Rahm). Danach «Rückgängig».
   - Jede Zeile in «Einkauf» antippen = auf Bring! / wieder weg – auch nach dem Füllen.
4. **Grundvorrat** (Einkauf → «Grundvorrat verwalten»): gleiche Abteilungen und Artikel wie Bring!. Antippen = auf Bring! (durchgestrichen), nochmals = weg. Gekauftes gilt wieder als «da». Gilt für die ganze WG.
5. **Herunterziehen** = sofort synchronisieren (eigene Änderungen hoch, Stand der anderen holen).
6. **📅 Kalender**: Alle Znacht als Abo im iPhone-, Google- oder Outlook-Kalender.

**Wer hat recht?** Bring! für «was steht auf der Liste» (BringFrisch fragt immer neu nach). BringFrisch (WG-Server) für Plan, Stimmen und Grundvorrat. Der Bot nimmt nur weg, was er selbst gesetzt hat.

Rezepte: 10 Klassiker + 6 schnelle/Reste + 82 Saisonrezepte von Betty Bossi, Migusto, Fooby und Swissmilk (verlinkt aufs Original) + eigene Rezepte mit Link.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `static/` | Die App (HTML/JS, läuft offline) – wird auf GitHub Pages veröffentlicht |
| `worker/` | Cloudflare Worker: Bring!-Sync über Bot-Konto, gemeinsamer Plan/Vorrat/Wochenwahl, Kalender-Abo. Einrichtung: [worker/README.md](worker/README.md) |
| `tools/` | Rezept-Import (einmalig), Bring!-Katalog (`update_bring_catalog.mjs`), App-Icons (`make_icons.py`), Live-Check (`check_live.ps1`) |
| `tests/` | Automatische Tests, siehe [Tests](#tests) |
| `docs/design/` | Design-Vorgabe der Plan-Ansicht (Spezifikation + lauffähiger Prototyp) |

Ohne Worker funktioniert alles auf einem Handy; Bring! dann über Teilen/Kopieren.

## Mehrere WGs

Ein WG-Server für alle WGs, jede WG sieht nur ihre eigenen Daten (Plan, Stimmen, Vorrat, Mitbewohner, Rezepte, Kalender).

| | Erste WG (unsere) | Weitere WGs |
|---|---|---|
| Name in der App | `Allmen` (oder `wg1`; `MAIN_WG` in `worker/wrangler.toml`) | z.B. `sonnenhof` (gross/klein, Umlaute egal) |
| PIN | Secret `WG_PIN` (wie bisher) | nur als Hash in KV (`wgs:<name>`) |
| Daten in KV | ohne Präfix (wie bisher) | `w:<name>:…` |
| Bring! | gleicher Bot, eigene Liste | gleicher Bot, eigene Liste – **muss selbst gewählt werden** |

Schutz vor der falschen Liste: Eine weitere WG schreibt nirgends hin, bis sie ihre Liste gewählt hat. Listen, die eine andere WG benutzt (auch unsere), sind gar nicht wählbar.
10 falsche PINs = WG 15 Minuten gesperrt.

### Neue WG einrichten (Anleitung)

1. **WG anlegen** (einmal, am PC, mit `npx wrangler login`):
   ```bash
   node tools/new_wg.mjs "Sonnenhof"          # WG-Server
   node tools/new_wg.mjs "Sonnenhof" --stage  # zum Ausprobieren auf der Test-Version
   ```
   Fragt den PIN verdeckt (mind. 4 Zeichen, zweimal). Gibt WG-Name und Kalender-Link aus.
2. **Bring!-Liste teilen**: Die neue WG lädt in ihrer Bring!-App **allmenbot@gmail.com** in ihre Einkaufsliste ein. Im Bot-Konto (Bring!-App/Web mit dem Bot anmelden) die Einladung annehmen.
3. **Handys verbinden**: Jede Person öffnet <https://jodbaer.github.io/BringFresch/>, «Zum Home-Bildschirm», gibt WG-Name + PIN ein und tippt sich unter «Wer bist du?» an. Die erste Person trägt sich selbst ein, die anderen Mitbewohner kommen beim Verbinden dazu (oder unter Einstellungen → Mitbewohner).
4. **Liste wählen**: Einstellungen → «Bring!-Liste der WG» → die eigene Liste wählen. Erst danach geht «Bring! füllen».
5. Optional: Einstellungen → Mehr → «Kalender abonnieren».

**WG löschen**: im Cloudflare-Dashboard → KV → Namespace `WG` alle Schlüssel `w:<name>:…`, `wgs:<name>`, `cal:<token>` und `listowner:<uuid>` der WG löschen (Backups laufen nach 30 Tagen ab).
**PIN ändern**: WG löschen (nur `wgs:<name>` und `cal:<token>`) und mit `new_wg.mjs` gleich neu anlegen – die Daten unter `w:<name>:` bleiben.
Später eigener Bot pro WG: noch nicht eingebaut (heute ein Bot für alle; wird er gesperrt, trifft es alle WGs).

## Tests

Ein Befehl, ohne Internet, jedes Mal gleich (feste Uhr Di 10.11.2026, fester Zufall, Bring! und WG-Server nachgebaut). Braucht Node 22 und Edge oder Chrome:

```bash
cd tests && npm ci && npm run ci        # Syntax, App, 2 Handys + Worker, Worker, Layout + UI im Browser
npm run ci -- --shots                    # dazu Bildschirmfotos in tests/shots/ (UI: tests/shots/ui/)
npm run ci -- --no-layout --no-ui        # ohne Browser
npm run ui                               # nur der UI-Test
```

Am Schluss steht `PASS: alles grün` oder `FAIL: …` (dann Exit-Code 1). Läuft gleich unter Windows, Linux und in GitHub Actions.
Browser: Edge oder Chrome wird automatisch gefunden, sonst `BROWSER=/pfad/zu/chrome`. Kein Browser installiert (z.B. Linux-Server)? Einmal `npm run chrome` – lädt Chrome nach `tests/.chrome/`, der Test findet ihn dort.

**UI-Test** (`tests/ui_e2e.mjs`): bedient die App wie ein Mensch in einem echten Chrome (Handy 390×844 mit Touch): tippt, schreibt, wählt aus, wischt, zieht herunter – durch Plan, Wochenwahl, Bring! füllen, Einkauf, Grundvorrat, Rezepte & Saison, Einstellungen und als iPhone und Android, hell und dunkel, an einem Dienstag, Donnerstag (nächste Woche) und Montag (Wochenwechsel). Der WG-Server ist der echte Worker-Code, im Test-Prozess mit nachgebautem Bring! (Listen «WG», «Ferien» und die reservierte «Home-test») – kein Internet, keine Zugangsdaten. Jeder Schritt meldet `PASS`/`FAIL`, bei Fehlern liegt ein Foto `FEHLER-….png` in `tests/shots/ui/`. Nicht headless bedienbar und darum nachgestellt: Teilen-Blatt (die App kopiert stattdessen), Zwischenablage (wird mitgeschrieben), Farb-/Zeitwähler (Wert wird gesetzt), Öffnen von `bring://`/`webcal://` (geprüft werden Hinweis und Link).

### Neuen Test hinzufügen

Neue Abläufe gehören in `tests/ui_e2e.mjs` in einen der Abläufe A (iPhone, ohne/mit WG-Server), B (Android, verbunden, Bring!) oder C (Donnerstag/Montag). Ein Schritt:

```js
await step(A, "Gäste am Montag: +1", async () => {
  await goTab(A, "wg");                                   // plan | shop | season | wg
  await tap(A, '#attendance [data-guests="0"]');           // antippen wie mit dem Finger (muss sichtbar sein)
  await until(A, () => document.querySelector('#attendance [data-guests="0"]').textContent === "1", "Gäste zählen nicht");
});
```

Hilfsfunktionen: `tap` (antippen), `typeInto` (Feld antippen + tippen), `choose` (Auswahlliste), `pickNative` (Farb-/Zeitwähler), `swipe`/`pullDown` (wischen/herunterziehen), `until` (warten, bis etwas im Browser stimmt), `toastIs` (Hinweis abwarten), `expect` (prüfen), `text`/`count`/`titles`/`dayTitle`/`ctaCount` (lesen), `shot` (Foto bei `--shots`), `noHScroll` (kein seitliches Scrollen). Auf Seite des WG-Servers: `kvJson("plan")` (Speicher), `wg()` (Artikel in Bring! «WG»), `workerCall("/plan", …)` (ein anderes Handy spielen). Danach `cd tests && npm run ui`.

| Wo | Was |
|---|---|
| lokal (Windows, Linux) | `npm run ci` (einzeln: `npm test`, `npm run layout`, `npm run ui`) |
| GitHub Actions, Push auf `main` | dieselben Tests → **Test-Version** aktualisieren → Live-Test gegen echtes Bring! (Liste «Home-test» des Bots, räumt auf) – `stage.yml` |
| GitHub Actions, Release-Tag `v*` | dieselben Tests → WG-Version auf GitHub Pages, nur wenn alles grün ist – `deploy-pages.yml` |
| nur von Hand | Live-Test «Home-test»: `tests\stage_live.ps1` (fragt den Test-PIN) · WG-Server: `tests\e2e_live.ps1`, `tools\check_live.ps1` |

**Test-Version** (zum Ausprobieren, ohne die WG zu stören): <https://bringfrisch-test.bringfrisch-worker.workers.dev>
– orange «TEST»-Band, eigener Test-Server mit eigenem Speicher und eigenem Test-PIN, schreibt **nur** in die Bring!-Liste «Home-test» des Bots (kann technisch nicht auf die WG-Liste).
Seite und Server sind **ein** Worker (`bringfrisch-test`). Von Hand aktualisieren: `node tools/build_stage.mjs`, dann `cd worker && npx wrangler deploy --env stage`.
Einmalig nach der Zusammenlegung (v1.6.0): Secrets für den neuen Test-Worker setzen (`powershell -ExecutionPolicy Bypass -File worker\setup-stage.ps1`), danach den alten Test-Server löschen: `cd worker && npx wrangler delete --name bringfrisch-stage`.
Einmalig einrichten (alle Zugangsdaten, Schritt für Schritt, nichts wird angezeigt): `powershell -ExecutionPolicy Bypass -File tools\setup-secrets.ps1` – GitHub-Anmeldung, Cloudflare Account-ID (automatisch) und API-Token, Test-Server mit Bot-Zugang und Test-PIN.

**Release** (neue App-Version veröffentlichen) – ein normaler Push auf `main` veröffentlicht nichts:

```bash
git tag v0.3.0 && git push origin v0.3.0
```

Fortschritt unter GitHub → Actions. Rote Tests = keine neue Version; die Bildschirmfotos (Layout + UI) liegen dann als Artefakt «test-shots» beim Lauf.

## Kosten

Nichts. GitHub Pages + Cloudflare Free Plan. Eine WG mit 4 Leuten braucht weit unter 1 % der Gratis-Limits (zwei WGs ebenso; Engpass zuerst: 1 000 KV-«list»/Tag, v.a. offene Wochenwahl) (100 000 Aufrufe/Tag, 1 000 Speicher-Schreibvorgänge/Tag). Zahlen: Cloudflare-Dashboard → Workers & Pages → bringfrisch → Metrics.
