"""
Saison-Manager für Schweizer Gemüse, Kartoffeln und Milchprodukte.
Referenzen: gemuese.ch (VSGP), kartoffel.ch (Swisspatat), swissmilk.ch
"""

from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

DATA_PATH = Path(__file__).parent.parent / "data" / "swiss_seasonal.json"

class SeasonManager:
    def __init__(self, data_file: Path = DATA_PATH):
        self.data_file = data_file
        self.data: Dict[str, Any] = self._load_data()

    def _load_data(self) -> Dict[str, Any]:
        if not self.data_file.exists():
            raise FileNotFoundError(f"Saisondaten nicht gefunden unter: {self.data_file}")
        with open(self.data_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def is_cache_stale(self, max_months: int = 6) -> bool:
        """Prüft, ob die lokalen Saisondaten älter als max_months (Standard: 6 Monate) sind."""
        last_updated_str = self.data.get("last_updated")
        if not last_updated_str:
            return True
        try:
            last_date = datetime.strptime(last_updated_str, "%Y-%m-%d")
            return (datetime.now() - last_date) > timedelta(days=max_months * 30)
        except Exception:
            return True

    def get_seasonal_items(self, month: Optional[int] = None) -> List[Dict[str, Any]]:
        """Gibt alle Schweizer Produkte zurück, die im Monat (1-12, default aktueller Monat) Saison haben."""
        if month is None:
            month = datetime.now().month

        results = []
        for item in self.data.get("items", []):
            is_field = month in item.get("field_months", [])
            is_storage = month in item.get("storage_months", [])
            if is_field or is_storage:
                item_copy = dict(item)
                item_copy["current_status"] = "Freiland (Erntefrisch)" if is_field else "Schweizer Lagerware"
                results.append(item_copy)
        return results

    def get_month_name(self, month: Optional[int] = None) -> str:
        if month is None:
            month = datetime.now().month
        months = self.data.get("months", [])
        if 1 <= month <= len(months):
            return months[month - 1]
        return f"Monat {month}"
