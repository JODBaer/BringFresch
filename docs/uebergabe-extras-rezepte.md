# Übergabe: Salat-Rezepte + «Extra / Side Dish» pro Tag

## 1. Rezepte (kein Massen-Scraping)
CLAUDE.md verbietet weiteres Scraping (`tools/import_recipes.py` war einmalig), und die Seiten verbieten es in ihren Nutzungsbedingungen.

- **Gezielter Import:** 10–20 konkrete Links (v.a. Salate als Hauptgang) in `tools/extra_urls.txt`, einmal mit `tools/import_recipes.py merge` importieren – nur Fakten mit Link.
- **Von Hand geschrieben** (`standalone_data.js`, je 4 Portionen, mit Saison):
  - *Salate als Hauptgang:* Feigen-Ziegenkäse-Rucola mit Baumnüssen (Aug–Okt), Nüsslisalat mit Ei, Speck und Croûtons (Okt–März), Randen-Linsen mit Feta und Apfel (Sep–März), Chicorée-Orangen mit Poulet (Nov–März), Kürbis-Quinoa mit Granatapfel (Sep–Dez, vegan), Wassermelone-Feta-Minze (Jun–Aug), Panzanella (Jul–Sep)
  - *Teigwaren:* Kürbis-Salbei-Penne (Sep–Dez), Carbonara (Jo: Champignons), Lauch-Rahm-Nudeln mit Schinken (Jo: Räuchertofu), Orecchiette mit Rosenkohl, Zitrone, Baumnüssen (Okt–Feb), Bolognese mit Rüebli (Jo: Vegi-Hack), Spinat-Ricotta-Penne (Frühling/Herbst), Cherrytomaten-Burrata-Pasta (Jun–Sep)

## 2. Neu: «Extra» (Side Dish) pro Tag
Ersetzt den automatischen Zusatz von 50 g Salat pro Portion.

- Im aufgeklappten Tag ein Knopf **«+ Extra»** mit kleiner Auswahl (Zutaten pro Portion):
  - Gemischter Salat (Eisberg, Mozzarella, Cherrytomaten)
  - Nüsslisalat
  - Tofu gebraten (z.B. bei Fleischmenü für Vegi)
  - Brot
  - Gemüse vom Blech
  - Reis/Couscous
- **Mengen:** nach Portionen des Tages. Vegi-Extras wie Tofu nur nach Anzahl Vegi-Esser.
- **Vorschlag, wenn das Menü wenig hergibt:** Rezept eher leicht (Flag `light: true` oder wenige Zutaten) → Hinweis «Eher leicht – Extra dazu?». Fleischmenü mit Vegi-Essern → Vorschlag Tofu/Vegi-Protein.
- **Nicht automatisch einkaufen:** nur gewählte Extras kommen auf die Einkaufsliste (mit Bring!-Bild).
- Salate als Hauptgang: kein Extra-Hinweis.
- CLAUDE.md, Fachregel «Alles für alle», anpassen.
- **Offen, vorher mit Joshua klären:** Bleiben 150 g Fleisch pro Fleisch-Esser und 100 g Grillkäse pro Vegi automatisch, oder werden sie auch wählbare Extras?

## 3. Vorgehen
1. Design als **HTML-Vorschau** zeigen (Knopf «+ Extra», Auswahl, Hinweis «eher leicht»).
2. Bauen, `npm run ci` grün.
3. Test-Version prüfen, dann Release.
