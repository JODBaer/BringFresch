"""
Kalender-Synchronisation (.ics) für BringFrisch.
Erzeugt iCalendar-Dateien für Wochentage, Rezepte und WG-Kochzuweisungen.
Kompatibel mit Apple Kalender (iOS), Google Kalender (Android) und Outlook.
"""

from __future__ import annotations
from datetime import datetime, timedelta
from typing import List, Dict, Any

class CalendarSync:
    @staticmethod
    def generate_ics(week_plan: List[Dict[str, Any]], start_date: datetime = None) -> str:
        """
        Erstellt einen standardkonformen .ics Kalender-String für die geplanten Mahlzeiten.
        """
        if start_date is None:
            # Nächster Montag
            today = datetime.now()
            start_date = today + timedelta(days=(7 - today.weekday()) % 7)

        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//BringFrisch//Wochenplan Schweizer Saisongemuese//DE",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:BringFrisch Menueplan"
        ]

        day_offset_map = {
            "Montag": 0, "Dienstag": 1, "Mittwoch": 2, "Donnerstag": 3,
            "Freitag": 4, "Samstag": 5, "Sonntag": 6
        }

        for item in week_plan:
            day_name = item.get("day", "Montag")
            offset = day_offset_map.get(day_name, 0)
            event_date = start_date + timedelta(days=offset)
            
            # Start: 19:00 Uhr, Dauer: 1 Stunde
            dt_start = event_date.replace(hour=19, minute=0, second=0).strftime("%Y%m%dT%H%M%S")
            dt_end = event_date.replace(hour=20, minute=0, second=0).strftime("%Y%m%dT%H%M%S")
            now_stamp = datetime.now().strftime("%Y%m%dT%H%M%SZ")

            title = item.get("title", "Abendessen")
            cook = item.get("cook_assigned") or "WG / Freiwillig"
            desc = f"Gericht: {title}\\nKoch: {cook}\\nKosten ca.: CHF {item.get('scaled_cost_chf', '0.00')}\\n\\nZubereitung: {item.get('instructions', '')}"

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:bringfrisch-{item.get('id', 'dish')}-{event_date.strftime('%Y%m%d')}@bringfrisch.ch",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART:{dt_start}",
                f"DTEND:{dt_end}",
                f"SUMMARY:🍽️ {title} (Koch: {cook})",
                f"DESCRIPTION:{desc}",
                "STATUS:CONFIRMED",
                "END:VEVENT"
            ])

        lines.append("END:VCALENDAR")
        return "\r\n".join(lines)
