"""
Quittungs-Scanner und Diff-Engine für Kassenbons (Migros, Coop, Aldi, Lidl, Denner etc.).
Vergleicht eingescannte Quittungen mit der BringFrisch-Einkaufsliste:
- Zeigt an, was bereits gekauft wurde (inkl. Preis)
- Zeigt exakt an, was noch fehlt
- Erkennt Spontankäufe & kalkuliert Gesamtbetrag für die WG-Kasse
"""

from __future__ import annotations
import re
from typing import Dict, List, Any

# Häufige Schweizer Supermarkt-Füllwörter
SUPERMARKET_STOPWORDS = {
    "bio", "ch", "suisse", "m-budget", "prix", "garantie", "qualite", "prixgarantie",
    "budget", "demeter", "migros", "coop", "aldi", "lidl", "denner", "volg", "spar",
    "chf", "fr", "stk", "kg", "g", "total", "subtotal", "mwst", "bon", "cumulus", "supercard"
}

class ReceiptScanner:
    def __init__(self):
        pass

    def clean_text_line(self, line: str) -> str:
        """Entfernt Sonderzeichen, Zahlen und irrelevante Füllwörter."""
        line = re.sub(r"[0-9]+[.,]?[0-9]*\s*(chf|fr|\%)?", "", line, flags=re.IGNORECASE)
        line = re.sub(r"[^a-zA-ZäöüÄÖÜéèà\s]", " ", line)
        words = [w for w in line.strip().lower().split() if len(w) > 2 and w not in SUPERMARKET_STOPWORDS]
        return " ".join(words)

    def extract_receipt_lines(self, raw_text: str) -> List[Dict[str, Any]]:
        """Extrahiert Artikel und erkannte Beträge aus dem Text eines Kassenbons."""
        parsed_items = []
        for line in raw_text.splitlines():
            line = line.strip()
            if not line:
                continue

            # Preis suchen (z.B. 2.40 oder 12.50)
            price_match = re.search(r"(\d+[.,]\d{2})", line)
            price = float(price_match.group(1).replace(",", ".")) if price_match else None

            # Skip wenn Total-Zeile
            if re.search(r"\b(total|summe|kartenzahlung|bargeld|rückgeld)\b", line, re.IGNORECASE):
                continue

            cleaned = self.clean_text_line(line)
            if cleaned:
                parsed_items.append({
                    "raw_line": line,
                    "cleaned": cleaned,
                    "price": price
                })
        return parsed_items

    def match_receipt_with_shopping_list(
        self,
        receipt_text: str,
        shopping_list: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Gleicht Quittungseinträge mit der BringFrisch-Einkaufsliste ab.
        Gibt 'found', 'missing', 'extra' und 'total_spent' zurück.
        """
        receipt_items = self.extract_receipt_lines(receipt_text)
        
        found = []
        missing = []
        matched_receipt_indices = set()
        total_receipt_sum = 0.0

        for item in receipt_items:
            if item["price"]:
                total_receipt_sum += item["price"]

        for shop_item in shopping_list:
            item_name = shop_item["name"].lower()
            name_tokens = [t for t in re.sub(r"[^a-zäöü]", " ", item_name).split() if len(t) > 2 and t not in SUPERMARKET_STOPWORDS]

            matched = False
            matched_rec = None
            for idx, rec in enumerate(receipt_items):
                # Token-Übereinstimmung oder Substring
                if any(token in rec["cleaned"] for token in name_tokens) or any(w in item_name for w in rec["cleaned"].split()):
                    matched = True
                    matched_receipt_indices.add(idx)
                    matched_rec = rec
                    break

            if matched and matched_rec:
                found.append({
                    "name": shop_item["name"],
                    "display_amount": shop_item.get("display_amount", ""),
                    "receipt_line": matched_rec["raw_line"],
                    "price": matched_rec["price"]
                })
            else:
                missing.append({
                    "name": shop_item["name"],
                    "display_amount": shop_item.get("display_amount", ""),
                    "bring_cat": shop_item.get("bring_cat", "Sonstiges"),
                    "used_in_days": shop_item.get("used_in_days", [])
                })

        # Nicht zugeordnete Artikel auf dem Bon (Extras / Spontankäufe)
        extras = []
        for idx, rec in enumerate(receipt_items):
            if idx not in matched_receipt_indices and rec["price"] is not None:
                extras.append({
                    "line": rec["raw_line"],
                    "price": rec["price"]
                })

        return {
            "total_spent_chf": round(total_receipt_sum, 2),
            "found_count": len(found),
            "missing_count": len(missing),
            "found": found,
            "missing": missing,
            "extras": extras
        }
