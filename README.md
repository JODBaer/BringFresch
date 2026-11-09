# 🥬 BringFrisch

WG-Menüplaner mit Schweizer Saisongemüse. Die WG wählt gemeinsam 7 Znacht für die Woche, die App rechnet die Mengen für alle Anwesenden (plus Reste fürs Zmittag) und schreibt die Einkaufsliste direkt in **Bring!**.

**App:** <https://jodbaer.github.io/BringFresch/> (auf dem Handy öffnen → «Zum Home-Bildschirm»)

## So funktioniert's

1. **🃏 Wochenwahl**: 14 saisonale Gerichte (halb vegi, halb Fleisch). Alle tippen auf dem eigenen Handy ihre Favoriten an, optional mit Wunschtag. «Neu mischeln» tauscht Gerichte ohne Stimme aus.
2. **Plan**: Die Top 7 landen an Tagen, an denen ihre Fans zuhause sind. Pro Tag: wer isst mit (`J L Le Jo`), Reste-Puffer +0 … +6, Menü antippen zum Wechseln.
3. **🛒 Bring! füllen**: Gemeinsame Basis + Protein pro Person (Fleisch / Vegi) + Salat, Grundvorrat (Salz, Öl, …) wird weggelassen.
4. **📅 Kalender**: Alle Znacht als Abo im iPhone-, Google- oder Outlook-Kalender.

Rezepte: 10 Klassiker + 82 Saisonrezepte von Betty Bossi, Migusto, Fooby und Swissmilk (verlinkt aufs Original) + eigene Rezepte mit Link.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `static/` | Die App (HTML/JS, läuft offline, Daten im Browser) – wird auf GitHub Pages veröffentlicht |
| `worker/` | Kleiner Cloudflare Worker: Bring!-Sync, gemeinsame Wochenwahl, Kalender-Abo. Einrichtung: [worker/README.md](worker/README.md) |
| `tools/` | Einmaliger Rezept-Import (`python tools/import_recipes.py`) |
| `tests/` | `cd tests && npm install && npm test` |

Ohne Worker funktioniert alles auf einem Handy; Bring! dann über Teilen/Kopieren.
