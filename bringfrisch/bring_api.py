"""
Bring! API V2 Client für BringFrisch.
Unterstützt Authentifizierung, Listenabruf und den direkten Export von Einkaufslisten.
Inklusive Offline-Sandbox-Modus für sicheres Testen ohne Zugangsdaten.
"""

from __future__ import annotations
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, List, Any, Optional

BRING_API_BASE = "https://api.getbring.com/rest/v2"

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
    def __init__(self, email: Optional[str] = None, password: Optional[str] = None):
        self.email = email
        self.password = password
        self.access_token: Optional[str] = None
        self.user_uuid: Optional[str] = None
        self.default_list_uuid: Optional[str] = None

    def login(self, email: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        """Authentifiziert den Nutzer bei der Bring! API."""
        user_email = email or self.email
        user_pw = password or self.password

        if not user_email or not user_pw:
            # Virtueller / Offline-Mock für Demo & WG-Test
            self.access_token = "mock-token-wg-bringfrisch"
            self.user_uuid = "mock-user-uuid"
            self.default_list_uuid = "mock-wg-list-uuid"
            return {
                "success": True,
                "is_mock": True,
                "access_token": self.access_token,
                "user_uuid": self.user_uuid,
                "bring_list_uuid": self.default_list_uuid,
                "message": "Erfolgreich im Offline-/Demo-Modus verbunden"
            }

        url = f"{BRING_API_BASE}/bringauth"
        data = urllib.parse.urlencode({"email": user_email, "password": user_pw}).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        req.add_header("X-BRING-COUNTRY", "CH")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                self.access_token = res_data.get("access_token")
                self.user_uuid = res_data.get("userUuid")
                self.default_list_uuid = res_data.get("bringListUuid")
                return {
                    "success": True,
                    "is_mock": False,
                    "access_token": self.access_token,
                    "user_uuid": self.user_uuid,
                    "bring_list_uuid": self.default_list_uuid
                }
        except Exception as e:
            # Falls falsches PW oder Offline, Fehlermeldung zurückgeben
            return {
                "success": False,
                "is_mock": False,
                "error": str(e)
            }

    def get_lists(self) -> List[Dict[str, Any]]:
        """Gibt alle verfügbaren Bring!-Listen des Nutzers/der WG zurück."""
        if not self.access_token or self.access_token.startswith("mock-"):
            return [
                {"listUuid": "mock-wg-list-uuid", "name": "WG-Einkauf (Bring! Test)", "theme": "ch.bring.theme.home"}
            ]

        url = f"{BRING_API_BASE}/bringusers/{self.user_uuid}/lists"
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {self.access_token}")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data.get("lists", [])
        except Exception:
            return [{"listUuid": self.default_list_uuid or "default", "name": "Hauptliste", "theme": "default"}]

    def get_list_items(self, list_uuid: Optional[str] = None) -> Dict[str, Any]:
        """Liest die aktuellen Artikel einer Bring!-Liste ein (purchase & recently)."""
        target_list = list_uuid or self.default_list_uuid or "mock-wg-list-uuid"

        if not self.access_token or self.access_token.startswith("mock-"):
            # Demo-Daten für den Abgleich im Mock-Modus
            return {
                "success": True,
                "is_mock": True,
                "list_uuid": target_list,
                "purchase": [
                    {"name": "Schweizer Festkochende Kartoffeln", "specification": "1 kg"},
                    {"name": "Magronen / Teigwaren", "specification": "500 g"}
                ],
                "recently": [
                    {"name": "Rüebli", "specification": "1 Beutel"}
                ]
            }

        url = f"{BRING_API_BASE}/bringlists/{target_list}"
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {self.access_token}")

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return {
                    "success": True,
                    "is_mock": False,
                    "list_uuid": target_list,
                    "purchase": res_data.get("purchase", []),
                    "recently": res_data.get("recently", [])
                }
        except Exception as e:
            return {
                "success": False,
                "is_mock": False,
                "error": str(e),
                "purchase": [],
                "recently": []
            }

    def compare_and_filter_list(
        self,
        shopping_list: List[Dict[str, Any]],
        list_uuid: Optional[str] = None,
        custom_pantry_staples: Optional[List[str]] = None,
        exclude_staples: bool = True
    ) -> Dict[str, Any]:
        """
        Gleicht die Einkaufsliste mit der aktuellen Bring!-Liste ab und filtert Grundzutaten.
        Klassifiziert Zutaten in:
        - to_sync: Neu auf die Bring!-Liste zu setzen
        - already_on_bring: Steht bereits auf Bring!
        - pantry_staple: Grundzutat zuhause (Salz, Pfeffer, Öl, Bouillon etc.)
        """
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
            
            # 1. Ist es eine Grundzutat (Salz, Pfeffer, Öl)?
            is_staple = any(st in name_lower for st in staples_set)
            
            # 2. Steht es bereits auf der Bring!-Liste?
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

    def push_items_to_list(
        self,
        items: List[Dict[str, Any]],
        list_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Pusht eine Liste von BringFrisch-Zutaten in die angegebene Bring!-Liste.
        Format der Items: [{"name": "Rüebli", "display_amount": "500 g", ...}]
        """
        target_list = list_uuid or self.default_list_uuid or "mock-wg-list-uuid"

        if not self.access_token or self.access_token.startswith("mock-"):
            return {
                "success": True,
                "is_mock": True,
                "items_count": len(items),
                "list_uuid": target_list,
                "message": f"{len(items)} Artikel virtuell mit Bring! synchronisiert"
            }

        url = f"{BRING_API_BASE}/bringlists/{target_list}"
        pushed_count = 0
        errors = []

        for item in items:
            item_name = item.get("name", "").strip()
            item_spec = item.get("display_amount", "").strip()
            
            # Bring! Spezifikation per PUT/POST
            data = urllib.parse.urlencode({
                "purchase": item_name,
                "specification": item_spec
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, method="PUT")
            req.add_header("Authorization", f"Bearer {self.access_token}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")

            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status in [200, 204]:
                        pushed_count += 1
            except Exception as e:
                errors.append(f"{item_name}: {str(e)}")

        return {
            "success": len(errors) == 0,
            "is_mock": False,
            "items_count": pushed_count,
            "errors": errors,
            "list_uuid": target_list
        }

