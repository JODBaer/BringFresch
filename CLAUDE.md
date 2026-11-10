# BringFrisch – Kontext für Claude

WG-Menüplaner (Schweizer Saisongemüse) mit Bring!-Anbindung. **Nur für die eigene WG**, kein Produkt.
Leitsatz: *einfach zu benutzen, einfach zu bekommen.* Neue Features erst nach dem Praxistest mit der WG.

WG: Joshua, Lukas, Leonie = Fleisch · Jo = Vegi (keine Veganer).

## Architektur

- **`static/`** – PWA, Vanilla JS, keine Abhängigkeiten/CDNs, läuft offline. GitHub Pages (`https://jodbaer.github.io/BringFresch/`, Root-`index.html` leitet auf `static/` weiter).
  - `app.js` – gesamte Logik (Plan, Wochenwahl, Einkaufsliste, Worker-Anbindung)
  - `standalone_data.js` – Grundvorrat, VSGP-Saisondaten (`season_items`), Monatsnews, 10 Klassiker-Rezepte
  - `recipes_imported.js` – generiert von `tools/import_recipes.py merge`, nicht von Hand ändern
  - `recipe_importer.js` – eigene Rezepte (localStorage)
  - `sw.js` – Network-First; bei Asset-Änderungen `CACHE_NAME` hochzählen
- **`worker/`** – Cloudflare Worker (Free): Bring!-Sync über ein Bot-Konto (Secrets), Wochenwahl + Plan in KV, iCal-Abo `/cal/:token.ics`, Rezept-Link-Import. PIN-geschützt (`X-WG-PIN`). Setup: `worker/README.md`.
- **`tools/import_recipes.py`** – einmaliger, höflicher Import (schema.org) von Betty Bossi, Migusto, Fooby, Swissmilk. Nur Fakten, keine Texte/Bilder. Nicht für weiteres Massen-Scraping verwenden.

Ohne Worker: alles lokal, Bring! via Teilen/Kopieren.

## Fachregeln

- **Nächste Woche** (ab Donnerstag): Chip «KW 47 →» in der Abschnittszeile bzw. Wischen; eigener Plan pro KW (`bringfrisch_next_plan`, Worker `/plan/:week`), `state.plan` ist immer die angezeigte Woche. Offene Tage (`empty: true`) kaufen nichts und stehen nicht im Kalender. Wochenwahl pro Woche gespeichert. Montag: geplante Woche wird zur laufenden.
- **Ablauf**: Wochenwahl (14 Saison-Gerichte, ½ vegi / ½ Fleisch, Top 7 → Tage mit anwesenden Fans, Wunschtag zählt) → Plan (Esser pro Tag, Puffer) → Bring! füllen.
- **Portionen** = Esser + Gäste + Reste-Puffer (Standard +2, wählbar +0…+6). Niemand zuhause → kein Kochen.
- **Rezeptmengen** gelten für `recipe.servings` (Standard 4).
- **Alles für alle**: gemeinsame Basis + 150 g Fleisch pro Fleisch-Esser (nicht bei Fleischrezepten) + 100 g Grillkäse pro Vegi + 50 g Salat pro Portion.
- **Grundvorrat** wie Bring!: gleiche Abteilungen und Artikel (kleine Pillen mit Bring!-Bild). Antippen = direkt auf Bring! (durchgestrichen), nochmals = wieder weg. Was in Bring! gekauft/abgehakt wurde, gilt wieder als «da».
- **Wahrheit**: Bring! = was auf der Liste steht (BringFrisch baut nur drumherum). Grundvorrat = BringFrisch, gemeinsam für die WG im Worker (`/vorrat`, neuerer Stand gewinnt).
- **Bot löscht nur Eigenes**: der Worker merkt sich in KV (`bot:<liste>`), was er neu gesetzt hat; nur das nimmt er weg, und nur wenn es noch drauf ist.
- **Herunterziehen** (oben auf der Seite) = sofort synchronisieren: eigene Änderungen (Plan, Vorrat) hoch, dann Stand der anderen holen.
- **Schon drauf?** Fehlendes wird einfach eingefügt. Steht etwas schon auf Bring!, fragt «Bring! füllen» pro Artikel nach: Bot-Artikel mit neuer Menge (z.B. zweites Rezept mit Rahm) vorausgewählt, fremde Einträge nicht (Menge wird ergänzt). Danach «Rückgängig»: neue Artikel weg, alte Mengen zurück.
- **Schnelles & Reste** (`quick: true` in `standalone_data.js`): Fertigpizza, Nuggets, Maultaschen, Gnocchi, Dumplings, Resteessen. 2 davon pro Woche im Memory. `vegi_swap` ersetzt den Grillkäse (z.B. Vegi-Nuggets), `no_addons` lässt Extra-Fleisch/-Käse weg, `is_leftovers` = nichts einkaufen.
- **Bring!-Bilder**: Namen werden auf den Bring!-Katalog (`static/bring_catalog.js`, erzeugt von `tools/update_bring_catalog.mjs`) abgebildet, z.B. Butternuss-Kürbis → Kürbis; die genaue Sorte steht in der Mengenangabe. Unbekanntes (v.a. Gewürze) bleibt eigener Artikel. Eigene Bilder hochladen kann die Bring!-API nicht.
- **Einkaufsnamen**: «Schweizer», Klammern, «à ca. 400 g» stehen in der Mengenangabe, nicht im Namen. Leitungswasser kommt nie auf die Liste.
- **Design**: Plan-Ansicht + Navigation nach `docs/design/BringFrisch-Plan-Redesign.md` (massgeblich) und dem Prototyp `docs/design/bringfrisch-prototyp.html` (`?os=ios` / `?os=android`). iPhone = Glas-Stil (`html.glass`), Android = Material 3 Expressive (`html.m3`), automatisch erkannt, umschaltbar im ⋮-Menü über «Einstellungen». Farben Hellgrün #90EE90 + Pistazie #93C572, Schrift Roboto Flex (lokal in `static/fonts/`, kein CDN), Dunkelmodus folgt dem System. Mit einem offenen Tag müssen alle 7 Tage sichtbar bleiben (Dichte d1–d3 einmal beim Start/Drehen, Zutaten notfalls mit Höchsthöhe); beim Aufklappen bewegt sich nur der offene Tag. Prüfen: `node tests/layout_check.mjs --shots` (Edge/Chrome). Einkauf, Rezepte & Saison, Einstellungen sind noch im alten Stil. Joshua entscheidet Design-Fragen gern selbst – live als HTML zeigen.

## Befehle

```bash
cd tests && npm ci && npm run ci        # ALLES vor dem Abschluss: Syntax, App, Integration, Worker, Layout → «PASS: alles grün»
npm run ci -- --no-layout                # ohne Browser (falls gesperrt); --shots = Fotos in tests/shots/
npm test                                 # nur App (jsdom), 2-Handy-Integration, Worker
node tests/layout_check.mjs --shots      # Plan-Layout im echten Browser (390×844, 375×667, 390×600)
npx serve static                        # lokal ansehen
git tag v1.2.0 && git push origin v1.2.0 # Release: Tests in CI, nur bei grün GitHub Pages
cd worker && npx wrangler deploy        # Worker veröffentlichen
```

CI: `.github/workflows/deploy-pages.yml` läuft nur bei Tags `v*` (oder von Hand): Job `test` (`npm run ci -- --shots`, Fotos als Artefakt bei Fehler), danach `deploy` (Pages). Push auf main veröffentlicht nichts.
Tests sind deterministisch: `tests/determinism.js` (feste Uhr Di 10.11.2026, fester Zufall), kein Netz (fetch, Bring!, KV nachgebaut). Neue Tests genauso. Live-Tests (`tests/e2e_live.*`, `tools/check_live.*`) brauchen Zugangsdaten → nur von Hand, nie in CI.
