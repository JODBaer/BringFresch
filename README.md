# 🥬 BringFrisch

WG-Menüplaner mit Schweizer Saisongemüse. Die WG wählt gemeinsam 7 Znacht für die Woche, die App rechnet die Mengen für alle Anwesenden (plus Reste fürs Zmittag) und schreibt die Einkaufsliste direkt in **Bring!**.

**App:** <https://jodbaer.github.io/BringFresch/> (auf dem Handy öffnen → «Zum Home-Bildschirm»)

## Bedienung (Plan)

- **Tag** (Kreis links) antippen = Menü auf-/zuklappen: Zutaten mit Mengen, «Zum Rezept ↗», «Wechseln».
- **Gericht** antippen = Menü wechseln (Suche, «Beliebt bei euch» oben, eigenes Menü eintippen, «Rückgängig»).
- **Kreise** = wer mitisst (antippen = an/ab, abwesend = grau mit Strich). **+N** daneben = Reste.
- **Zahl** rechts = Portionen (Personen + Reste): antippen = +1 (bis +6, dann wieder 0), **▾** = Auswahl.
- Oben: **Kalender-Symbol** = Wochenwahl (roter Punkt = noch offen), **🛒 Bring!-Chip** = füllen.
- **Ab Donnerstag** steht rechts über den Tagen **«KW 47 →»**: antippen (oder seitlich wischen) = nächste Woche planen. Tage sind zuerst «noch offen», Wochenwahl, Bring! und Kalender gelten für die angezeigte Woche. Am Montag wird sie automatisch zur laufenden.
- Unten: Plan · Einkauf · Rezepte & Saison · Einstellungen (⋮-Menü: WG-Einstellungen, Aktualisieren, Wochenwahl, iPhone-/Android-Stil).
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
| `tests/` | `cd tests && npm install && npm test` · Layout im Browser: `node tests/layout_check.mjs --shots` · echter Durchlauf mit Bring!: `powershell -ExecutionPolicy Bypass -File tests\e2e_live.ps1` |
| `docs/design/` | Design-Vorgabe der Plan-Ansicht (Spezifikation + lauffähiger Prototyp) |

Ohne Worker funktioniert alles auf einem Handy; Bring! dann über Teilen/Kopieren.

## Kosten

Nichts. GitHub Pages + Cloudflare Free Plan. Eine WG mit 4 Leuten braucht weit unter 1 % der Gratis-Limits (100 000 Aufrufe/Tag, 1 000 Speicher-Schreibvorgänge/Tag). Zahlen: Cloudflare-Dashboard → Workers & Pages → bringfrisch → Metrics.
