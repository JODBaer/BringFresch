"""
Bring! API Integration für BringFrisch.
Verwendet die erprobte python-bring-api Bibliothek für zuverlässige Authentifizierung,
Listenabruf und das Hinzufügen von Artikeln.
"""

from __future__ import annotations
import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    from python_bring_api.bring import Bring
    HAS_BRING_LIB = True
except ImportError:
    HAS_BRING_LIB = False

CONFIG_FILE = Path(__file__).parent.parent / "data" / "bring_config.json"

DEFAULT_PANTRY_STAPLES = [
    # Gewürze & Brühen
    "salz", "speisesalz", "jodsalz", "meersalz",
    "pfeffer", "schwarzer pfeffer",
    "aromat", "knorr aromat",
    "bouillon", "gemüsebouillon", "rindsbouillon", "bouillonwürfel",
    "paprikapulver", "paprika",
    "currypulver", "curry",
    "muskatnuss", "muskat", "muskatnuss & lorbeerblatt",
    "zimt", "lorbeerblatt", "lorbeerblätter",
    "oregano", "italienische kräuter", "thymian", "rosmarin",
    "chili", "chiliflocken", "cayennepfeffer",
    
    # Fette, Öle & Essige
    "olivenöl", "rapsöl", "sonnenblumenöl", "bratöl", "speiseöl",
    "bratbutter", "bratcrème", "butter",
    "essig", "kräuteressig", "apfelessig", "balsamico", "aceto balsamico",
    "salatsauce", "schweizer salatsauce / rapsöl & essig", "french dressing",

    # Saucen & Pasten
    "senf", "thomy senf", "mayonnaise", "ketchup",
    "tomatenmark", "tomatenpüree", "sojasauce",

    # Backen & Binden
    "mehl", "weissmehl", "ruchmehl",
    "zucker", "kristallzucker", "puderzucker", "honig",
    "backpulver", "natron", "vanillezucker",
    "maizena", "speisestärke",

    # Basics
    "wasser", "knoblauch", "knoblauchzehe", "knoblauchzehen",
    "teigwaren", "hörnli", "magronen", "spaghetti", "pasta",
    "reis", "basmatireis", "trockenreis", "haferflocken"
]

class BringClient:
    def __init__(self):
        self.email: Optional[str] = None
        self.password: Optional[str] = None
        self.access_token: Optional[str] = None
        self.user_uuid: Optional[str] = None
        self.default_list_uuid: Optional[str] = None
        self.default_list_name: Optional[str] = None
        self.bring_instance: Optional[Any] = None
        self._load_saved_config()

    def _load_saved_config(self):
        """Lädt gespeicherte Zugangsdaten aus data/bring_config.json."""
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.email = cfg.get("email")
                    self.password = cfg.get("password")
                    self.access_token = cfg.get("access_token")
                    self.user_uuid = cfg.get("user_uuid")
                    self.default_list_uuid = cfg.get("list_uuid")
                    self.default_list_name = cfg.get("list_name")
                    if self.email and self.password and HAS_BRING_LIB:
                        self.bring_instance = Bring(self.email, self.password)
            except Exception as e:
                print("Bring Config Load Error:", e)

    def _save_config(self):
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "email": self.email,
                "password": self.password,
                "access_token": self.access_token,
                "user_uuid": self.user_uuid,
                "list_uuid": self.default_list_uuid,
                "list_name": self.default_list_name
            }, f, indent=2)

    def get_status(self) -> Dict[str, Any]:
        """Gibt den aktuellen Verbindungsstatus zurück."""
        has_auth = bool((self.email and self.password) or self.access_token)
        return {
            "is_connected": has_auth,
            "email": self.email if has_auth else None,
            "list_uuid": self.default_list_uuid,
            "list_name": self.default_list_name or "Hauptliste",
            "is_mock": not has_auth
        }

    def login(
        self,
        email: Optional[str] = None,
        password: Optional[str] = None,
        list_uuid: Optional[str] = None,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Authentifiziert den Nutzer bei Bring! (entweder via E-Mail/Passwort oder direkt via Web-Token)."""
        # 1. Direkter Token-Login (aus Bring! Web)
        if token and token.strip():
            self.access_token = token.strip()
            self.email = email or "Bring! Web User"
            if list_uuid:
                self.default_list_uuid = list_uuid
            self._save_config()
            return {
                "success": True,
                "email": self.email,
                "list_uuid": self.default_list_uuid,
                "list_name": self.default_list_name or "Bring! Web Liste",
                "message": "Erfolgreich via Bring! Web Token verknüpft!"
            }

        # 2. Regulärer Login via E-Mail & Passwort
        user_email = (email or self.email or "").strip()
        user_pw = (password or self.password or "").strip()

        if not user_email or not user_pw:
            return {
                "success": False,
                "error": "Bitte E-Mail und Passwort (oder Bring! Web Token) eingeben"
            }

        if not HAS_BRING_LIB:
            return {
                "success": False,
                "error": "python-bring-api Bibliothek ist nicht installiert"
            }

        try:
            bring = Bring(user_email, user_pw)
            bring.login()
            self.email = user_email
            self.password = user_pw
            self.bring_instance = bring

            # Listen laden
            lists_data = bring.loadLists()
            lists = lists_data.get("lists", [])

            # Standardliste setzen
            if list_uuid:
                self.default_list_uuid = list_uuid
            elif lists:
                self.default_list_uuid = lists[0].get("listUuid")
                self.default_list_name = lists[0].get("name")

            self._save_config()

            return {
                "success": True,
                "email": self.email,
                "list_uuid": self.default_list_uuid,
                "list_name": self.default_list_name,
                "lists": lists,
                "message": f"Erfolgreich mit Bring! verbunden ({self.email})"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Bring! Login fehlgeschlagen: {str(e)}"
            }

    def get_lists(self) -> List[Dict[str, Any]]:
        """Gibt alle verfügbaren Bring!-Listen des Nutzers zurück."""
        if not self.bring_instance:
            if self.email and self.password and HAS_BRING_LIB:
                try:
                    self.bring_instance = Bring(self.email, self.password)
                    self.bring_instance.login()
                except Exception:
                    pass

        if not self.bring_instance:
            return [{"listUuid": "mock-wg", "name": "WG Einkauf (Demo / Nicht verknüpft)"}]

        try:
            lists_data = self.bring_instance.loadLists()
            return lists_data.get("lists", [])
        except Exception as e:
            print("Bring loadLists error:", e)
            return [{"listUuid": self.default_list_uuid or "default", "name": self.default_list_name or "Hauptliste"}]

    def get_list_items(self, list_uuid: Optional[str] = None) -> Dict[str, Any]:
        """Liest aktive Artikel aus der Bring!-Liste ein."""
        target_list = list_uuid or self.default_list_uuid

        if not self.bring_instance and self.email and self.password and HAS_BRING_LIB:
            try:
                self.bring_instance = Bring(self.email, self.password)
                self.bring_instance.login()
            except Exception:
                pass

        if not self.bring_instance or not target_list:
            return {
                "success": True,
                "is_mock": True,
                "purchase": [
                    {"name": "Schweizer Festkochende Kartoffeln", "specification": "1 kg"},
                    {"name": "Magronen / Teigwaren", "specification": "500 g"}
                ],
                "recently": []
            }

        try:
            items_data = self.bring_instance.getItems(target_list)
            # getItems returns BringItemsResponse with .purchase and .recently
            purchase = items_data.purchase if hasattr(items_data, "purchase") else items_data.get("purchase", [])
            recently = items_data.recently if hasattr(items_data, "recently") else items_data.get("recently", [])
            
            # Formatieren in standard dicts
            def serialize_item(item):
                if hasattr(item, "name"):
                    return {"name": item.name, "specification": getattr(item, "specification", "")}
                return item

            return {
                "success": True,
                "is_mock": False,
                "list_uuid": target_list,
                "purchase": [serialize_item(i) for i in purchase],
                "recently": [serialize_item(i) for i in recently]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "purchase": [],
                "recently": []
            }

    def push_items_to_list(
        self,
        items: List[Dict[str, Any]],
        list_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pusht eine Liste von Zutaten in die angegebene Bring!-Liste."""
        target_list = list_uuid or self.default_list_uuid

        if not self.bring_instance and self.email and self.password and HAS_BRING_LIB:
            try:
                self.bring_instance = Bring(self.email, self.password)
                self.bring_instance.login()
            except Exception:
                pass

        if not self.bring_instance or not target_list:
            return {
                "success": True,
                "is_mock": True,
                "items_count": len(items),
                "message": f"{len(items)} Artikel virtuell exportiert (Verknüpfe Bring! in den Einstellungen für echten Sync)"
            }

        pushed_count = 0
        errors = []

        for item in items:
            name = item.get("name", "").strip()
            spec = item.get("display_amount") or f"{item.get('amount', '')} {item.get('unit', '')}".strip()
            try:
                self.bring_instance.saveItem(target_list, name, spec)
                pushed_count += 1
            except Exception as e:
                errors.append(f"{name}: {str(e)}")

        return {
            "success": len(errors) == 0,
            "is_mock": False,
            "items_count": pushed_count,
            "errors": errors,
            "list_uuid": target_list
        }

    def compare_and_filter_list(
        self,
        shopping_list: List[Dict[str, Any]],
        list_uuid: Optional[str] = None,
        custom_pantry_staples: Optional[List[str]] = None,
        exclude_staples: bool = True
    ) -> Dict[str, Any]:
        """Gleicht die Einkaufsliste mit der aktuellen Bring!-Liste ab und filtert Grundzutaten."""
        current_data = self.get_list_items(list_uuid)
        existing_bring_names = {
            item.get("name", "").strip().lower() for item in current_data.get("purchase", [])
        }
        
        staples_set = set(custom_pantry_staples or DEFAULT_PANTRY_STAPLES)

        to_sync = []
        already_on_bring = []
        pantry_items = []

        for item in shopping_list:
            name_lower = item.get("name", "").strip().lower()
            is_staple = any(st in name_lower for st in staples_set)
            is_on_bring = any(ex in name_lower or name_lower in ex for ex in existing_bring_names)

            item_copy = dict(item)
            if is_staple and exclude_staples:
                item_copy["status"] = "pantry_staple"
                item_copy["status_text"] = "🧂 Grundzutat zuhause"
                pantry_items.append(item_copy)
            elif is_on_bring:
                item_copy["status"] = "already_on_bring"
                item_copy["status_text"] = "✅ Bereits auf Bring!"
                already_on_bring.append(item_copy)
            else:
                item_copy["status"] = "to_sync"
                item_copy["status_text"] = "🛒 Muss gekauft werden"
                to_sync.append(item_copy)

        return {
            "total_items": len(shopping_list),
            "to_sync_count": len(to_sync),
            "already_on_bring_count": len(already_on_bring),
            "pantry_staple_count": len(pantry_items),
            "to_sync": to_sync,
            "already_on_bring": already_on_bring,
            "pantry_items": pantry_items
        }
