"""
BringFrisch HTTP & REST API Server.
Leichtgewichtig, ohne zwingende externe Abhängigkeiten.
Serviert die mobile PWA und stellt Endpunkte für WG-Sharing, Bring!-Sync, Quittungsscan & Kalender bereit.
"""

from __future__ import annotations
import os
import json
import mimetypes
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

from .season import SeasonManager
from .engine import MenuEngine
from .bring_api import BringClient
from .receipt_scanner import ReceiptScanner
from .calendar_sync import CalendarSync

BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"
WG_DATA_FILE = BASE_DIR / "data" / "wg_plans.json"

class BringFrischServer(SimpleHTTPRequestHandler):
    season_mgr = SeasonManager()
    engine = MenuEngine()
    bring_client = BringClient()
    scanner = ReceiptScanner()

    def do_OPTIONS(self):
        """Erlaubt CORS-Preflight-Requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def send_json(self, data: dict | list, status: int = 200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _load_wg_plans(self) -> dict:
        if WG_DATA_FILE.exists():
            try:
                with open(WG_DATA_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_wg_plans(self, plans: dict):
        WG_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(WG_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(plans, f, ensure_ascii=False, indent=2)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/api/season":
            month = int(params.get("month", [datetime.now().month])[0])
            items = self.season_mgr.get_seasonal_items(month)
            month_name = self.season_mgr.get_month_name(month)
            news = self.season_mgr.get_monthly_news(month)
            stale = self.season_mgr.is_cache_stale()
            self.send_json({
                "month": month,
                "month_name": month_name,
                "news": news,
                "is_cache_stale": stale,
                "items": items
            })
            return

        elif path == "/api/recipes":
            diet = params.get("diet", [None])[0]
            cat = params.get("category", [None])[0]
            q = params.get("q", [None])[0]
            recipes = self.engine.filter_recipes(diet=diet, category=cat, search_query=q)
            self.send_json({"count": len(recipes), "recipes": recipes})
            return

        elif path == "/api/wg/plan":
            wg_id = params.get("wg_id", ["default-wg"])[0]
            plans = self._load_wg_plans()
            plan_data = plans.get(wg_id)
            if not plan_data:
                # Neuen Standardplan erstellen
                plan_data = {
                    "wg_id": wg_id,
                    "persons": 3,
                    "diet": "vegi",
                    "plan": self.engine.generate_week_plan(diet="vegi", persons=3),
                    "updated_at": datetime.now().isoformat()
                }
                plans[wg_id] = plan_data
                self._save_wg_plans(plans)
            self.send_json(plan_data)
            return

        elif path == "/api/bring/lists":
            lists = self.bring_client.get_lists()
            self.send_json({"lists": lists})
            return

        elif path == "/api/bring/status":
            status_data = self.bring_client.get_status()
            self.send_json(status_data)
            return

        elif path == "/api/bring/current":
            list_uuid = params.get("list_uuid", [None])[0]
            items = self.bring_client.get_list_items(list_uuid)
            self.send_json(items)
            return

        # Statische Dateien (PWA Frontend)
        if path == "/":
            file_path = STATIC_DIR / "index.html"
        else:
            file_path = STATIC_DIR / path.lstrip("/")

        if file_path.exists() and file_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(file_path))
            mime_type = mime_type or "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path == "/api/plan/generate":
            diet = body.get("diet", "vegi")
            cat = body.get("category")
            persons = int(body.get("persons", 2))
            plan = self.engine.generate_week_plan(diet=diet, category=cat, persons=persons)
            self.send_json({"plan": plan, "persons": persons, "diet": diet})
            return

        elif path == "/api/shopping-list":
            plan = body.get("plan", [])
            persons = int(body.get("persons", 2))
            shopping_list = self.engine.aggregate_shopping_list(plan, base_persons=2, target_persons=persons)
            self.send_json({"items": shopping_list, "total_items": len(shopping_list)})
            return

        elif path == "/api/wg/plan/update":
            wg_id = body.get("wg_id", "default-wg")
            plans = self._load_wg_plans()
            body["updated_at"] = datetime.now().isoformat()
            plans[wg_id] = body
            self._save_wg_plans(plans)
            self.send_json({"success": True, "wg_id": wg_id, "updated_at": body["updated_at"]})
            return

        elif path == "/api/bring/login":
            email = body.get("email")
            password = body.get("password")
            list_uuid = body.get("list_uuid")
            token = body.get("token")
            res = self.bring_client.login(email, password, list_uuid, token)
            self.send_json(res)
            return

        elif path == "/api/bring/set-list":
            list_uuid = body.get("list_uuid")
            list_name = body.get("list_name")
            if list_uuid:
                self.bring_client.default_list_uuid = list_uuid
            if list_name:
                self.bring_client.default_list_name = list_name
            self.bring_client._save_config()
            self.send_json({"success": True, "list_uuid": list_uuid, "list_name": list_name})
            return

        elif path == "/api/bring/sync":
            items = body.get("items", [])
            list_uuid = body.get("list_uuid")
            res = self.bring_client.push_items_to_list(items, list_uuid)
            self.send_json(res)
            return

        elif path == "/api/bring/compare":
            shopping_list = body.get("shopping_list", [])
            list_uuid = body.get("list_uuid")
            exclude_staples = body.get("exclude_staples", True)
            custom_staples = body.get("custom_staples")
            res = self.bring_client.compare_and_filter_list(
                shopping_list=shopping_list,
                list_uuid=list_uuid,
                custom_pantry_staples=custom_staples,
                exclude_staples=exclude_staples
            )
            self.send_json(res)
            return

        elif path == "/api/receipt/scan":
            receipt_text = body.get("receipt_text", "")
            shopping_list = body.get("shopping_list", [])
            res = self.scanner.match_receipt_with_shopping_list(receipt_text, shopping_list)
            self.send_json(res)
            return

        elif path == "/api/calendar/export":
            plan = body.get("plan", [])
            ics_content = CalendarSync.generate_ics(plan)
            body_bytes = ics_content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/calendar; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="bringfrisch_menueplan.ics"')
            self.send_header("Content-Length", str(len(body_bytes)))
            self.end_headers()
            self.wfile.write(body_bytes)
            return

        self.send_json({"error": "Endpunkt nicht gefunden"}, status=404)

def run(port: int = 8080):
    server_address = ("", port)
    httpd = HTTPServer(server_address, BringFrischServer)
    print(f"🚀 BringFrisch Server läuft auf http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()

