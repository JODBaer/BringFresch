"""
Regelbasierte Menü- und Budget-Engine für BringFrisch.
Erstellt Wochenpläne basierend auf Schweizer Saisongemüse, Diätwünschen und Personenanzahl.
"""

from __future__ import annotations
import json
import random
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from .season import SeasonManager

RECIPES_PATH = Path(__file__).parent.parent / "data" / "recipes.json"

DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

class MenuEngine:
    def __init__(self, recipes_file: Path = RECIPES_PATH):
        self.recipes_file = recipes_file
        self.season_mgr = SeasonManager()
        self.recipes: List[Dict[str, Any]] = self._load_recipes()

    def _load_recipes(self) -> List[Dict[str, Any]]:
        with open(self.recipes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("recipes", [])

    def filter_recipes(
        self,
        diet: Optional[str] = None,
        category: Optional[str] = None,
        search_query: Optional[str] = None,
        month: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Filtert Rezepte nach Diät (vegi, vegan, fleisch), Kategorie, Stichwort und Saison."""
        if month is None:
            month = datetime.now().month

        results = []
        for r in self.recipes:
            # Saisonprüfung
            if month not in r.get("season_months", []):
                continue

            # Diätfilter: wenn vegi gewählt, zeige vegi & vegan
            if diet:
                diet_lower = diet.lower()
                r_diet = r.get("diet", "").lower()
                if diet_lower == "vegi" and r_diet not in ["vegi", "vegan"]:
                    continue
                elif diet_lower == "vegan" and r_diet != "vegan":
                    continue
                elif diet_lower in ["fleisch", "normal"]:
                    pass  # Zeige alles

            # Kategorie (z.B. schweizerisch, exotisch, abendbrot)
            if category and r.get("category", "").lower() != category.lower():
                continue

            # Freitext / Stichwortsuche
            if search_query:
                query = search_query.lower()
                title_match = query in r.get("title", "").lower()
                instruction_match = query in r.get("instructions", "").lower()
                ingredient_match = any(query in ing.get("name", "").lower() for ing in r.get("ingredients", []))
                if not (title_match or instruction_match or ingredient_match):
                    continue

            results.append(r)
        return results

    def generate_week_plan(
        self,
        diet: Optional[str] = "vegi",
        category: Optional[str] = None,
        persons: int = 2,
        seed: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Generiert einen ausgewogenen 7-Tage-Plan (Montag bis Sonntag)."""
        if seed is not None:
            random.seed(seed)

        pool = self.filter_recipes(diet=diet, category=category)
        if not pool:
            # Fallback auf alle Rezepte der Saison
            pool = self.filter_recipes()

        # Zufällige oder rotierende Auswahl von 7 Rezepten
        selected = []
        available = list(pool)
        for day in DAYS:
            if not available:
                available = list(pool)
            choice = random.choice(available)
            available.remove(choice)
            
            # Rezeptdaten mit Wochentag kopieren
            day_plan = dict(choice)
            day_plan["day"] = day
            day_plan["scaled_cost_chf"] = round(choice["cost_per_person_chf"] * persons, 2)
            day_plan["cook_assigned"] = None  # Für WG-Modus: Wer kocht heute?
            selected.append(day_plan)

        return selected

    def aggregate_shopping_list(
        self,
        week_plan: List[Dict[str, Any]],
        base_persons: int = 2,
        target_persons: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Fasst Zutaten aller ausgewählten Gerichte zusammen, skaliert Mengen und
        gruppiert nach Bring!-Kategorien.
        """
        scale_factor = target_persons / base_persons if base_persons > 0 else 1.0
        aggregated: Dict[str, Dict[str, Any]] = {}

        for day in week_plan:
            for ing in day.get("ingredients", []):
                name_clean = ing["name"].strip()
                unit = ing.get("unit", "").strip()
                key = (name_clean.lower(), unit.lower())
                amount_str = ing.get("amount", "1")
                bring_cat = ing.get("bring_cat", "Sonstiges")

                try:
                    amount_val = float(amount_str) * scale_factor
                except ValueError:
                    amount_val = 1.0

                if key in aggregated:
                    aggregated[key]["total_amount"] += amount_val
                    if day["day"] not in aggregated[key]["used_in_days"]:
                        aggregated[key]["used_in_days"].append(day["day"])
                else:
                    aggregated[key] = {
                        "name": name_clean,
                        "total_amount": amount_val,
                        "unit": unit,
                        "bring_cat": bring_cat,
                        "used_in_days": [day["day"]],
                        "checked": False
                    }

        # Schöne Rundung der Mengen
        items = []
        for val in aggregated.values():
            amt = val["total_amount"]
            if amt == int(amt):
                amt_formatted = str(int(amt))
            else:
                amt_formatted = f"{amt:.1f}"
            val["display_amount"] = f"{amt_formatted} {val['unit']}".strip()
            items.append(val)

        # Sortierung nach Bring!-Kategorie
        items.sort(key=lambda x: (x["bring_cat"], x["name"]))
        return items
