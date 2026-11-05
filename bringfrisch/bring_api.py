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
                    self._ensure_authenticated()
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

    def _ensure_authenticated(self) -> bool:
        """Stellt sicher, dass die Bring-Instanz existiert und angemeldet ist."""
        if not HAS_BRING_LIB:
            return False

        # 1. Wenn bereits angemeldet mit uuid
        if self.bring_instance and getattr(self.bring_instance, "uuid", None):
            return True

        # 2. Wenn E-Mail & Passwort vorhanden sind -> Direkter API Login
        if self.email and self.password:
            try:
                bring = Bring(self.email, self.password)
                auth_data = bring.login()
                self.bring_instance = bring
                if isinstance(auth_data, dict):
                    self.access_token = auth_data.get("access_token")
                    self.user_uuid = auth_data.get("uuid")
                elif hasattr(auth_data, "access_token"):
                    self.access_token = getattr(auth_data, "access_token", None)
                    self.user_uuid = getattr(auth_data, "uuid", None)
                return True
            except Exception as e:
                print("Bring re-auth error:", e)
                return False

        # 3. Wenn access_token & user_uuid vorhanden sind (z.B. aus Web)
        if self.access_token and self.user_uuid:
            try:
                bring = Bring(self.email or "user@example.com", "dummy")
                bring.uuid = self.user_uuid
                bring.headers['X-BRING-USER-UUID'] = self.user_uuid
                bring.headers['Authorization'] = f'Bearer {self.access_token}'
                bring.putHeaders = {**bring.headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
                bring.postHeaders = {**bring.headers, 'Content-Type': 'application/json; charset=UTF-8'}
                self.bring_instance = bring
                return True
            except Exception as e:
                print("Bring token instance error:", e)
                return False

        return False

    def get_status(self) -> Dict[str, Any]:
        """Gibt den aktuellen Verbindungsstatus zurück."""
        has_auth = self._ensure_authenticated()
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
        """Authentifiziert den Nutzer bei Bring! (persönlicher Login mit E-Mail & Passwort oder Bearer-Token)."""
        # 1. Direkter Token-Login (aus Bring! Web)
        if token and token.strip():
            self.access_token = token.strip()
            self.email = email or "Bring! Web User"

            # Versuche UUID aus JWT zu extrahieren falls vorhanden
            try:
                import base64
                parts = self.access_token.split(".")
                if len(parts) >= 2:
                    padded = parts[1] + "=" * (-len(parts[1]) % 4)
                    payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode("utf-8"))
                    self.user_uuid = payload.get("sub") or payload.get("uuid") or payload.get("userUuid")
            except Exception:
                pass

            if list_uuid:
                self.default_list_uuid = list_uuid
            self._ensure_authenticated()
            self._save_config()

            lists = self.get_lists()
            return {
                "success": True,
                "email": self.email,
                "list_uuid": self.default_list_uuid,
                "list_name": self.default_list_name or "Bring! Web Liste",
                "lists": lists,
                "message": "Erfolgreich via Bring! Web Token verknüpft!"
            }

        # 2. Regulärer persönlicher Login via E-Mail & Passwort (Empfohlen!)
        user_email = (email or self.email or "").strip()
        user_pw = (password or self.password or "").strip()

        if not user_email or not user_pw:
            return {
                "success": False,
                "error": "Bitte deine Bring! E-Mail und dein Passwort eingeben."
            }

        if not HAS_BRING_LIB:
            return {
                "success": False,
                "error": "python-bring-api Bibliothek ist nicht installiert."
            }

        try:
            bring = Bring(user_email, user_pw)
            auth_data = bring.login()
            self.email = user_email
            self.password = user_pw
            self.bring_instance = bring

            if isinstance(auth_data, dict):
                self.access_token = auth_data.get("access_token")
                self.user_uuid = auth_data.get("uuid")
            elif hasattr(auth_data, "access_token"):
                self.access_token = getattr(auth_data, "access_token", None)
                self.user_uuid = getattr(auth_data, "uuid", None)

            # Echte Listen aus dem persönlichen Bring!-Account laden
            lists_data = bring.loadLists()
            lists = lists_data.get("lists", []) if isinstance(lists_data, dict) else getattr(lists_data, "lists", [])

            # Standardliste setzen
            if list_uuid:
                self.default_list_uuid = list_uuid
                for l in lists:
                    l_uuid = l.get("listUuid") if isinstance(l, dict) else getattr(l, "listUuid", None)
                    if l_uuid == list_uuid:
                        self.default_list_name = l.get("name") if isinstance(l, dict) else getattr(l, "name", None)
            elif lists:
                first = lists[0]
                self.default_list_uuid = first.get("listUuid") if isinstance(first, dict) else getattr(first, "listUuid", None)
                self.default_list_name = first.get("name") if isinstance(first, dict) else getattr(first, "name", None)

            self._save_config()

            return {
                "success": True,
                "email": self.email,
                "list_uuid": self.default_list_uuid,
                "list_name": self.default_list_name or "Hauptliste",
                "lists": lists,
                "message": f"Erfolgreich mit Bring! als {self.email} verbunden!"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Bring! Login fehlgeschlagen: {str(e)}"
            }

    def get_lists(self) -> List[Dict[str, Any]]:
        """Gibt alle verfügbaren Bring!-Listen des Nutzers zurück."""
        if not self._ensure_authenticated():
            return [{"listUuid": "mock-wg", "name": "WG Einkauf (Nicht verbunden)"}]

        try:
            lists_data = self.bring_instance.loadLists()
            raw_lists = lists_data.get("lists", []) if isinstance(lists_data, dict) else getattr(lists_data, "lists", [])
            formatted = []
            for l in raw_lists:
                if isinstance(l, dict):
                    formatted.append({"listUuid": l.get("listUuid"), "name": l.get("name")})
                else:
                    formatted.append({"listUuid": getattr(l, "listUuid", ""), "name": getattr(l, "name", "")})
            return formatted if formatted else [{"listUuid": self.default_list_uuid or "default", "name": self.default_list_name or "Hauptliste"}]
        except Exception as e:
            print("Bring loadLists error:", e)
            return [{"listUuid": self.default_list_uuid or "default", "name": self.default_list_name or "Hauptliste"}]

    def get_list_items(self, list_uuid: Optional[str] = None) -> Dict[str, Any]:
        """Liest aktive Artikel aus der Bring!-Liste ein."""
        if not self._ensure_authenticated():
            return {
                "success": False,
                "is_mock": True,
                "purchase": [],
                "recently": []
            }

        target_list = list_uuid or self.default_list_uuid
        if not target_list:
            lists = self.get_lists()
            if lists:
                target_list = lists[0].get("listUuid")

        try:
            items_data = self.bring_instance.getItems(target_list)
            purchase = items_data.purchase if hasattr(items_data, "purchase") else (items_data.get("purchase", []) if isinstance(items_data, dict) else [])
            recently = items_data.recently if hasattr(items_data, "recently") else (items_data.get("recently", []) if isinstance(items_data, dict) else [])

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
        """Pusht eine Liste von Zutaten via API in die angegebene Bring!-Liste."""
        if not self._ensure_authenticated():
            return {
                "success": False,
                "is_mock": False,
                "items_count": 0,
                "error": "Nicht mit Bring! verbunden. Bitte melde dich in der App mit deinem persönlichen Bring!-Login an."
            }

        target_list = list_uuid or self.default_list_uuid
        if not target_list:
            lists = self.get_lists()
            if lists:
                target_list = lists[0].get("listUuid")
                self.default_list_uuid = target_list

        if not target_list:
            return {
                "success": False,
                "is_mock": False,
                "items_count": 0,
                "error": "Keine Bring!-Liste ausgewählt. Bitte in den Einstellungen eine Liste wählen."
            }

        pushed_count = 0
        errors = []

        for item in items:
            name = item.get("name", "").strip()
            if not name:
                continue
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
            "list_uuid": target_list,
            "message": f"Erfolgreich {pushed_count} Artikel via API in Bring! eingetragen!" if len(errors) == 0 else f"{pushed_count} Artikel eingetragen, {len(errors)} Fehler."
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
