# BringFrisch – Kontext für Claude

WG-Menüplaner (Schweizer Saisongemüse) mit Bring!-Anbindung. **Nur für die eigene WG**, kein Produkt.
Leitsatz: *einfach zu benutzen, einfach zu bekommen.* Neue Features erst nach dem Praxistest mit der WG.

WG: Joshua, Lukas, Leonie = Fleisch · Jo = Vegi (keine Veganer).

**Mehrere Chats gleichzeitig:** Vor der ersten Änderung an Code (`static/app.js`, `index.html`, `worker/`, `tests/`) einen eigenen Worktree anlegen (`EnterWorktree`), nie zu zweit im Hauptordner arbeiten. Nur eigene Pfade committen (`git add <pfade>`, nie `-A`), nicht stashen, keine fremden Dateien zurücksetzen, `tests/node_modules` nicht für andere umbauen. Fertig = `npm run ci` grün im Worktree → auf `main` → Worktree entfernen.

## Architektur

- **`static/`** – PWA, Vanilla JS, keine Abhängigkeiten/CDNs, läuft offline. GitHub Pages (`https://jodbaer.github.io/BringFresch/`, Root-`index.html` leitet auf `static/` weiter).
  - `core.js` – reine Regeln ohne Bildschirm/Speicher/Netz (Woche, Portionen, Zutaten-Namen, Bring!-Katalog-Abbildung, Einkaufsliste, Wochenwahl-Regeln), abgelegt unter `BF_CORE`. Dieselbe Datei lädt die App per `<script>` und der Worker per `import "../../static/core.js"`; direkt in Node testbar (`tests/core.test.mjs`). Neue Regeln hierhin, nicht nach `app.js`
  - `app.js` – Ansicht, Zustand, Wochenwahl, Worker-Anbindung
  - `standalone_data.js` – Grundvorrat, VSGP-Saisondaten (`season_items`), Monatsnews, 10 Klassiker-Rezepte
  - `recipes_imported.js` – generiert von `tools/import_recipes.py merge`, nicht von Hand ändern
  - `recipe_importer.js` – eigene Rezepte (localStorage)
  - `sw.js` – Network-First, nach 2.5 s ohne Antwort aus dem Cache (schwacher Empfang); bei Asset-Änderungen `CACHE_NAME` hochzählen (im Release setzt `build_site.mjs` die Version ein)
- **`worker/`** – Cloudflare Worker (Free): Bring!-Sync über ein Bot-Konto (Secrets), Wochenwahl + Plan in KV, iCal-Abo `/cal/:token.ics`, Rezept-Link-Import. PIN-geschützt (`X-WG-PIN`). Setup: `worker/README.md`. Dateien in `worker/src/`: `index.js` (Endpunkte), `auth.js` (WG, PIN, Sperre), `speicher.js` (Speichern mit Abgleich, Sicherung), `bring.js`, `kalender.js`, `rezept.js` (Link-Import, Bilder), `http.js` (Antworten, CORS, sicheres Abrufen).
- **`tools/import_recipes.py`** – einmaliger, höflicher Import (schema.org) von Betty Bossi, Migusto, Fooby, Swissmilk. Nur Fakten, keine Texte. Nicht für weiteres Massen-Scraping verwenden. Bilder: nur das Vorschaubild (og:image) holt der Worker einzeln beim ersten Anzeigen in der Wochenwahl (`/img`, KV `img:<sha1>`, nur mit PIN, nicht in der Sicherung) – nie ins öffentliche Repo.

Ohne Worker: alles lokal, Bring! via Teilen/Kopieren.

**Mehrere WGs** (ein Worker): Header `X-WG` (Name) + `X-WG-PIN`. Erste WG = `MAIN_WG` (`wrangler.toml`, «allmen,wg1»: erster Name gilt, weitere = Aliasse, Secret `WG_PIN`, Daten ohne Präfix); weitere WGs `wgs:<name>` in KV (PIN-Hash, `node tools/new_wg.mjs "Name"`), Daten unter `w:<name>:…`. Gleicher Bring!-Bot; jede weitere WG muss ihre Liste selbst wählen, Listen anderer WGs sind nicht wählbar (`listowner:<uuid>`). 10 falsche PINs = 15 Min. Sperre pro WG und Absender (IP), auch für die erste WG; unbekannte WG-Namen schreiben nichts in KV.
**Erster Start** (nicht verbunden): Willkommen mit WG-Name + PIN (= Zustimmung zu `static/rechtliches.html`, gespeichert in `bringfrisch_terms`), dann «Wer bist du?» (leere WG: sich selbst eintragen). «Ohne WG ausprobieren» = lokal.

## Fachregeln

- **Nächste Woche** (ab Donnerstag): Chip «KW 47 →» in der Abschnittszeile bzw. Wischen; eigener Plan pro KW (`bringfrisch_next_plan`, Worker `/plan/:week`), `state.plan` ist immer die angezeigte Woche. Offene Tage (`empty: true`) kaufen nichts und stehen nicht im Kalender. Wochenwahl pro Woche gespeichert. Montag: geplante Woche wird zur laufenden.
- **Ablauf**: Wochenwahl (14 Saison-Gerichte, ½ vegi / ½ Fleisch, Top 7 → Tage mit anwesenden Fans, Wunschtag zählt) → Plan (Esser pro Tag, Puffer) → Bring! füllen.
- **Portionen** = Esser + Gäste + Reste-Puffer (Standard +2, wählbar +0…+6). Niemand zuhause → kein Kochen.
- **Rezeptmengen** gelten für `recipe.servings` (Standard 4).
- **Alles für alle**: gemeinsame Basis + 150 g Fleisch pro Fleisch-Esser (nicht bei Fleischrezepten) + 100 g Grillkäse pro Vegi + 50 g Salat pro Portion.
- **Grundvorrat** wie Bring!: gleiche Abteilungen und Artikel (kleine Pillen mit Bring!-Bild). Antippen = direkt auf Bring! (durchgestrichen), nochmals = wieder weg. Was in Bring! gekauft/abgehakt wurde, gilt wieder als «da».
- **Wahrheit**: Bring! = was auf der Liste steht (BringFrisch baut nur drumherum). Grundvorrat = BringFrisch, gemeinsam für die WG im Worker (`/vorrat`).
- **Abgleich** (Plan, nächste Woche, Vorrat, Einstellungen): kein Uhrenvergleich. Das Handy merkt sich pro Dokument den Stand des Servers beim letzten Abgleich (`bringfrisch_base_*`: Stempel + Inhalt) und schickt den Stempel als `base` mit; hat inzwischen jemand gespeichert, antwortet der Worker 409 und die App führt zusammen (pro Tag / Artikel / Einstellung gewinnt, wer seit dem gemeinsamen Stand geändert hat). Test: `tests/sync_merge.test.mjs`.
- **WG-Einstellungen** gemeinsam im Worker (`/settings`): Mitbewohner, Znacht-Zeit, Rezept-Webseiten, eigene Rezepte. «Speichern & an alle senden» schickt sofort. Pro Handy bleiben: PIN, «Ich bin», Stil, Farben. Ab 5 Personen im Plan zwei Reihen (5 = 3 + 2).
- **Bot löscht nur Eigenes**: der Worker merkt sich in KV (`bot:<liste>`), was er neu gesetzt hat; nur das nimmt er weg, und nur wenn es noch drauf ist.
- **Herunterziehen** (oben auf der Seite) = sofort synchronisieren: eigene Änderungen (Plan, Vorrat) hoch, dann Stand der anderen holen.
- **Schon drauf?** Fehlendes wird einfach eingefügt. Steht etwas schon auf Bring!, fragt «Bring! füllen» pro Artikel nach: Bot-Artikel mit neuer Menge (z.B. zweites Rezept mit Rahm) vorausgewählt, fremde Einträge nicht (Menge wird ergänzt). Danach «Rückgängig»: neue Artikel weg, alte Mengen zurück.
- **Schnelles & Reste** (`quick: true` in `standalone_data.js`): Fertigpizza, Nuggets, Maultaschen, Gnocchi, Dumplings, Resteessen. 2 davon pro Woche im Memory. `vegi_swap` ersetzt den Grillkäse (z.B. Vegi-Nuggets), `no_addons` lässt Extra-Fleisch/-Käse weg, `is_leftovers` = nichts einkaufen.
- **Bring!-Bilder**: Namen werden auf den Bring!-Katalog (`static/bring_catalog.js`, erzeugt von `tools/update_bring_catalog.mjs`) abgebildet, z.B. Butternuss-Kürbis → Kürbis; die genaue Sorte steht in der Mengenangabe. Unbekanntes (v.a. Gewürze) bleibt eigener Artikel. Eigene Bilder hochladen kann die Bring!-API nicht.
- **Einkaufsnamen**: «Schweizer», Klammern, «à ca. 400 g» stehen in der Mengenangabe, nicht im Namen. Leitungswasser kommt nie auf die Liste.
- **Design**: Plan-Ansicht + Navigation nach `docs/design/BringFrisch-Plan-Redesign.md` (massgeblich) und dem Prototyp `docs/design/bringfrisch-prototyp.html` (`?os=ios` / `?os=android`). iPhone = Glas-Stil (`html.glass`), Android = Material 3 Expressive (`html.m3`), automatisch erkannt, umschaltbar unter Einstellungen → «Mehr» (kein ⋮-Menü mehr; Einstellungen ist direkt eine Seite). Farben Hellgrün #90EE90 + Pistazie #93C572 (Standard; Akzent und Hintergrund pro Handy wählbar: je 3 Vorgaben + eigene Farbe, Tokens werden in `applyTheme` berechnet – im CSS keine festen Grüntöne, nur Tokens), Schrift Roboto Flex (lokal in `static/fonts/`, kein CDN), Hell/Dunkel folgt dem System, pro Handy umschaltbar unter Einstellungen → Stil (Automatisch / Hell / Dunkel, `bf-mode`; CSS nur über `html.dark`, nie `prefers-color-scheme`). Mit einem offenen Tag müssen alle 7 Tage sichtbar bleiben (Dichte d1–d3 einmal beim Start/Drehen, Zutaten notfalls mit Höchsthöhe); beim Aufklappen bewegt sich nur der offene Tag. Prüfen: `node tests/layout_check.mjs --shots` (Edge/Chrome). Einkauf, Rezepte & Saison, Einstellungen sind noch im alten Stil. Joshua entscheidet Design-Fragen gern selbst – live als HTML zeigen.

## Befehle

```bash
cd tests && npm ci && npm run ci        # ALLES vor dem Abschluss: Syntax, App, Integration, Worker, Layout → «PASS: alles grün»
npm run ci -- --no-layout                # ohne Browser (falls gesperrt); --shots = Fotos in tests/shots/
npm test                                 # nur App (jsdom), Zutaten-Abgleich, 2-Handy-Integration, Worker
node zutaten.test.js --update            # nach bewusster Änderung am Grundvorrat-Abgleich: tests/snapshots/vorrat_treffer.json neu schreiben
node tests/layout_check.mjs --shots      # Plan-Layout im echten Browser (390×844, 375×667, 390×600)
cd tests && node links_live.mjs          # Rezept-Links im Browser öffnen (Internet, nur von Hand); falsche Links ersetzen oder entfernen → App zeigt «Rezept suchen» (Fooby)
cd tests && npm run ui                  # UI-Test: klickt sich wie ein Mensch durch alle Seiten/Funktionen (echter Chrome, Worker-Code + Bring!-Attrappe im Prozess)
cd tests && npm run ci                  # alles (auch Layout + UI); --no-ui / --no-layout; ohne Browser: npm run chrome
npx serve static                        # lokal ansehen
git tag v0.3.0 && git push origin v0.3.0 # Release: Tests in CI, nur bei grün GitHub Pages (WG-Version)
node tools/build_stage.mjs               # Test-Version bauen (dist-stage/, Test-Server, «TEST»-Band)
cd worker && npx wrangler deploy        # Worker von Hand (normal: per Release-Tag)
```

Test-Version: `stage.yml` bei jedem Push auf main → Tests → **ein** Worker `bringfrisch-test` = Test-Seite (Assets aus `dist-stage/`) + Test-Server (`wrangler deploy --env stage`, `ONLY_LIST_NAME=Home-test`, `MAIN_WG=test`) → Live-Test `tests/stage_live.mjs` gegen Bring! «Home-test» (Secret `STAGE_PIN`). Der Test-Server darf nie in die WG-Liste schreiben. Auf dem WG-Server ist «Home-test» eine Spielwiese: wählbar nur für WGs ohne eigene Liste, gehört nie einer WG (kein `listowner`).
CI: `.github/workflows/deploy-pages.yml` läuft nur bei Tags `v*` (oder von Hand): Job `test` (`npm run ci -- --shots`, Fotos als Artefakt bei Fehler), danach `worker` (WG-Server per Wrangler, braucht Secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, sonst Warnung) und dann `deploy` (Pages: `index.html` + `static/`, damit `/static/` gleich bleibt). Push auf main veröffentlicht nichts. Worker sichert täglich alle KV-Daten (`backup:<Tag>`, 30 Tage, `worker/README.md`).
Tests sind deterministisch: `tests/determinism.js` (feste Uhr Di 10.11.2026, fester Zufall), kein Netz (fetch, Bring!, KV nachgebaut). Neue Tests genauso; neue Funktion in der App = neuer Schritt in `tests/ui_e2e.mjs` (Anleitung: README «Neuen Test hinzufügen»). Live-Tests (`tests/e2e_live.*`, `tools/check_live.*`) brauchen Zugangsdaten → nur von Hand, nie in CI.
