"""Regeln des Rezept-Imports ohne Netz prüfen (Monatsabgleich, Auswahl, Ernährung). Start: python tools/test_import_recipes.py"""
import importlib.util
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("imp", Path(__file__).with_name("import_recipes.py"))
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)
fails = 0


def check(ok, msg):
    global fails
    print(("PASS  " if ok else "FAIL  ") + msg)
    fails += 0 if ok else 1


def cand(title, diet="vegi", months=(12, 1, 2), strength=4, minutes=40, nutrition=True, url=None):
    return {"title": title, "diet": diet, "season_months": list(months), "season_strength": {"winter": strength, "herbst": strength},
            "prep_time_min": minutes, "source_url": url or f"https://x.ch/{title}", **({"nutrition": {"kcal": 500}} if nutrition else {})}


# Auswahl für den nächsten Monat (Dezember = Winter)
cs = [cand("Lauchgratin", strength=6), cand("Kürbisrisotto", strength=4, nutrition=False), cand("Wirzeintopf mit Speck", "fleisch", strength=4),
      cand("Erdbeersalat", months=(6, 7)), cand("Langes Ragout", "fleisch", minutes=180), cand("Rosenkohl", strength=1),
      cand("Schon da", url="https://x.ch/alt"), cand("Lauch-Gratin", strength=5)]
got = [r["title"] for r in imp.pick_new(cs, 12, {"https://x.ch/alt"}, 3)]
check(got[:2] == ["Lauchgratin", "Wirzeintopf mit Speck"], f"zuerst ein vegi und ein Fleisch, stärkste Saison zuerst ({got})")
check(len(got) == 3 and "Erdbeersalat" not in got and "Langes Ragout" not in got and "Rosenkohl" not in got and "Schon da" not in got,
      "nicht Saison / über 60 Min. / schwache Saison / schon im Katalog fallen weg")
check("Lauch-Gratin" not in got, "gleicher Titel (ohne Bindestrich) nur einmal")
check(imp.pick_new([], 12, set(), 3) == [], "keine Kandidaten = nichts")

# Ernährung: keine falschen Fleisch-Treffer mehr
check(not imp.MEAT.search("Farbige Peperoniwürfelchen") and imp.MEAT.search("Felchenfilets"), "Peperoniwürfelchen ist kein Felchen")
check(imp.MEAT.search("Entenbrüstli") and imp.MEAT.search("Bresaola") and imp.MEAT.search("Mortadella in Tranchen"), "Ente, Bresaola, Mortadella = Fleisch")
check(imp.NOT_MAIN.search("Süss eingelegte Zitrusfrüchte") and imp.NOT_MAIN.search("Znüni-Täschli") and not imp.NOT_MAIN.search("Milchreis mit Rhabarber"), "Eingelegtes und Znüni sind kein Znacht")

# Abgleich mit der Seite: Zutaten/Nährwerte neu, Ernährung nur strenger
page = '<script type="application/ld+json">' + json.dumps({"@type": "Recipe", "name": "Neuer Titel", "recipeYield": "4", "totalTime": "PT35M",
       "recipeIngredient": ["500 g Lauch", "200 g Speckwürfeli", "2 dl Rahm", "1 Zwiebel"], "nutrition": {"calories": "620 kcal", "proteinContent": "25 g"}}) + "</script>"
r = {"id": "x-lauch", "title": "Lauchgratin", "source_url": "https://www.fooby.ch/de/rezepte/1/lauch", "diet": "vegi", "servings": 2, "prep_time_min": 30, "ingredients": []}
changed = imp.refresh_recipe(r, page)
check(set(changed) >= {"servings", "prep_time_min", "ingredients", "nutrition", "diet"} and r["title"] == "Lauchgratin" and r["diet"] == "fleisch" and r["nutrition"]["kcal"] == 620,
      f"Abgleich übernimmt Zutaten, Portionen, Zeit, Nährwerte; Titel bleibt; Speck macht es zu Fleisch ({changed})")
r2 = {**r, "diet": "fleisch"}
page_veg = page.replace("200 g Speckwürfeli", "200 g Champignons")
imp.refresh_recipe(r2, page_veg)
check(r2["diet"] == "fleisch", "Ernährung wird nie automatisch lockerer (nur von Hand)")
check(imp.refresh_recipe(dict(r), "<html>nichts</html>") == [], "Seite ohne Rezeptdaten: nichts ändern")

# Aktive Zeit (Joshua 25.11.: «einfach» zählt nur die aktive Zeit, Ofen daneben nicht)
r3 = {**r, "prep_time_min": 30}
imp.refresh_recipe(r3, page.replace('"totalTime": "PT35M"', '"totalTime": "PT55M", "prepTime": "PT15M"'))
check(r3.get("active_min") == 15 and r3["prep_time_min"] == 55, f"prepTime = aktive Zeit, totalTime bleibt total ({r3.get('active_min')}, {r3['prep_time_min']})")
r4 = {**r}
imp.refresh_recipe(r4, page.replace('"totalTime": "PT35M"', '"totalTime": "PT35M", "prepTime": "PT35M"'))
check("active_min" not in r4, "aktive Zeit gleich total: kein eigenes Feld")

print(f"\n{fails} FEHLER" if fails else "\nALLES OK")
sys.exit(1 if fails else 0)
