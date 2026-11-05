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
