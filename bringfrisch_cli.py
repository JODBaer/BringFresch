#!/usr/bin/env python3
"""
BringFrisch CLI:
Erzeugt wöchentliche Menüpläne und synchronisiert sie direkt auf die Bring!-Einkaufsliste.
Kann im Terminal ausgeführt oder per Cronjob automatisiert werden.
"""

import sys
import argparse
from bringfrisch.engine import MenuEngine
from bringfrisch.bring_api import BringClient
from bringfrisch.calendar_sync import CalendarSync

def main():
    parser = argparse.ArgumentParser(description="BringFrisch - Schweizer Saisongemüse & Bring!-Wochenplaner")
    parser.add_argument("--persons", type=int, default=3, help="Anzahl Personen in der WG (Standard: 3)")
    parser.add_argument("--diet", type=str, default="vegi", choices=["vegi", "vegan", "fleisch", "schweizerisch"], help="Ernährungsform")
    parser.add_argument("--sync-bring", action="store_true", help="Direkt in die Bring!-Liste synchronisieren")
    parser.add_argument("--email", type=str, help="Bring! E-Mail-Adresse")
    parser.add_argument("--password", type=str, help="Bring! Passwort")
    parser.add_argument("--export-ics", type=str, help="Pfad zum Speichern der .ics Kalenderdatei")

    args = parser.parse_args()

    print("🥬 ===================================================")
    print("   BRINGFRISCH: Günstig gekocht, ausgewogen gelebt    ")
    print("   Fokus: Schweizer Saisongemüse (gemuese.ch/VSGP)   ")
    print("=====================================================")

    engine = MenuEngine()
    plan = engine.generate_week_plan(diet=args.diet, persons=args.persons)

    print(f"\n📅 Menüplan für {args.persons} Personen ({args.diet.upper()}):\n")
    total_cost = 0.0
    for day in plan:
        cost = day.get("scaled_cost_chf", 0.0)
        total_cost += cost
        print(f"  • {day['day']:<11}: {day['title']} (CHF {cost:.2f})")
    
    print(f"\n💰 Geschätzte Wochenkosten Hauptmahlzeiten: ca. CHF {total_cost:.2f} (CHF {total_cost/args.persons:.2f}/Person)")

    shopping_list = engine.aggregate_shopping_list(plan, target_persons=args.persons)
    print(f"\n🛒 Einkaufsliste ({len(shopping_list)} Zutaten aggregiert):\n")
    for item in shopping_list:
        print(f"  [{item['bring_cat']:<18}] {item['name']:<35} : {item['display_amount']}")

    if args.export_ics:
        ics_data = CalendarSync.generate_ics(plan)
        with open(args.export_ics, "w", encoding="utf-8") as f:
            f.write(ics_data)
        print(f"\n📅 Kalender exportiert nach: {args.export_ics}")

    if args.sync_bring:
        print("\n🚀 Synchronisiere mit Bring!...")
        client = BringClient(email=args.email, password=args.password)
        login_res = client.login()
        if not login_res["success"]:
            print(f"❌ Bring! Login fehlgeschlagen: {login_res.get('error')}")
            sys.exit(1)
        sync_res = client.push_items_to_list(shopping_list)
        print(f"✅ {sync_res['items_count']} Artikel erfolgreich in Bring! eingetragen!")

if __name__ == "__main__":
    main()
