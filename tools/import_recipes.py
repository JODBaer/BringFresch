"""
Obsonare Rezept-Import (einmalig, von Hand gestartet – nicht Teil der App).

Liest die standardisierten Rezeptdaten (schema.org Recipe als JSON-LD oder Microdata)
von Betty Bossi, Migusto, Fooby, Swissmilk und einzelnen Chefkoch-Links.

Übernommen werden nur Fakten: Titel, Link, Portionen, Zutaten mit Mengen, Zeit.
Keine Zubereitungstexte und keine Bilder – die App verlinkt auf das Originalrezept.

Ablauf:
  python tools/import_recipes.py discover   # Rezept-Links aus den Sitemaps sammeln (Vorfilter nach Titel)
  python tools/import_recipes.py fetch      # Seiten höflich abrufen (1 Anfrage / 3 s pro Website), Cache in tools/.cache
  python tools/import_recipes.py build      # Parsen, Diät + Saison bestimmen, Vorschlag zusammenstellen
                                            # -> tools/recipes_staging.json (zum Durchsehen)

Zusätzliche Einzel-Links (z.B. Chefkoch): eine URL pro Zeile in tools/extra_urls.txt
Nur Standardbibliothek, Python 3.9+.
"""
from __future__ import annotations

import gzip
import hashlib
import html
import json
import random
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
CANDIDATES = CACHE / "candidates.json"
PAGES = CACHE / "recipes"
STAGING = ROOT / "recipes_staging.json"
EXTRA_URLS = ROOT / "extra_urls.txt"

UA = "Obsonare-RecipeImport/1.0 (private WG meal planner; low volume)"
DELAY_S = 3.0
PER_SITE = 90  # Kandidaten pro Website, die abgerufen werden
SEED = 2026

SITES = {
    "bettybossi": {
        "sitemap": "https://www.bettybossi.ch/sitemap-recipe-de.xml",
        "match": r"^https://www\.bettybossi\.ch/de/rezepte/rezept/",
    },
    "migusto": {
        "sitemap": "https://migusto.migros.ch/de/sitemap.xml",
        "match": r"^https://migusto\.migros\.ch/de/rezepte/[^/]+/\d+$",
    },
    "fooby": {
        "sitemap": "https://fooby.ch/sitemap.xml",
        "match": r"^https://fooby\.ch/de/rezepte/\d+/[^/]+$",
    },
    "swissmilk": {
        "sitemap": "https://www.swissmilk.ch/sitemap.xml",
        "match": r"^https://www\.swissmilk\.ch/de/rezepte-kochideen/rezepte/[^/]+/[^/]+/$",
    },
}

# --- Saison: Gemüse-Stichworte -> Monate (aus standalone_data.js season_items, field ∪ storage) ---------
# Ganzjährige Zutaten (Kartoffeln, Zwiebeln, Käse …) beeinflussen die Saison nicht.
SEASON_VEG = {
    "Bärlauch": (["bärlauch"], [3, 4, 5], [3, 4, 5]),
    "Spargeln": (["spargel"], [4, 5, 6], [4, 5, 6]),
    "Rhabarber": (["rhabarber"], [4, 5, 6], [4, 5, 6]),
    "Radiesli": (["radiesli", "radieschen"], [4, 5, 6, 7, 8, 9, 10], [4, 5, 6, 7, 8, 9, 10]),
    "Kohlrabi": (["kohlrabi"], [5, 6, 7, 8, 9, 10, 11], [5, 6, 7, 8, 9, 10, 11]),
    "Fenchel": (["fenchel"], [5, 6, 7, 8, 9, 10, 11], [5, 6, 7, 8, 9, 10, 11]),
    "Blumenkohl": (["blumenkohl"], [5, 6, 7, 8, 9, 10, 11], [5, 6, 7, 8, 9, 10, 11]),
    "Brokkoli": (["brokkoli", "broccoli"], [5, 6, 7, 8, 9, 10, 11], [5, 6, 7, 8, 9, 10, 11]),
    "Zucchetti": (["zucchetti", "zucchini", "courgette"], [5, 6, 7, 8, 9, 10], [5, 6, 7, 8, 9, 10]),
    "Tomaten": (["tomate"], [5, 6, 7, 8, 9, 10], [5, 6, 7, 8, 9, 10]),
    "Gurken": (["gurke"], [4, 5, 6, 7, 8, 9, 10], [4, 5, 6, 7, 8, 9, 10]),
    "Peperoni": (["peperoni", "paprikaschote", "rote paprika", "gelbe paprika"], [6, 7, 8, 9, 10], [6, 7, 8, 9, 10]),
    "Auberginen": (["aubergine"], [6, 7, 8, 9, 10], [6, 7, 8, 9, 10]),
    "Bohnen": (["buschbohnen", "stangenbohnen", "grüne bohnen", "prinzessbohnen"], [6, 7, 8, 9, 10], [6, 7, 8, 9, 10]),
    "Zuckermais": (["zuckermais", "maiskolben"], [8, 9, 10], [8, 9, 10]),
    "Kürbis": (["kürbis", "butternut", "knirps", "hokkaido"], [8, 9, 10, 11], [8, 9, 10, 11, 12, 1, 2]),
    "Federkohl": (["federkohl", "grünkohl", "kale"], [10, 11, 12, 1, 2], [10, 11, 12, 1, 2]),
    "Rüebli": (["rüebli", "karotte", "möhre"], [6, 7, 8, 9, 10, 11], list(range(1, 13))),
    "Lauch": (["(?<!knob)(?<!schnitt)(?<!bär)lauch"], [6, 7, 8, 9, 10, 11, 12], list(range(1, 13))),
    "Wirz": (["wirz", "wirsing"], [6, 7, 8, 9, 10, 11], [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4]),
    "Weisskabis": (["weisskabis", "weisskohl", "spitzkabis"], [6, 7, 8, 9, 10, 11], list(range(1, 13))),
    "Rotkabis": (["rotkabis", "rotkohl", "blaukraut"], [7, 8, 9, 10, 11], [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]),
    "Randen": (["randen", "rande", "rote bete", "rote beete"], [7, 8, 9, 10, 11], [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]),
    "Pastinaken": (["pastinake"], [9, 10, 11, 12], [9, 10, 11, 12, 1, 2, 3, 4]),
    "Sellerie": (["knollensellerie", "sellerie"], [8, 9, 10, 11], [8, 9, 10, 11, 12, 1, 2, 3, 4, 5]),
    "Chicorée": (["chicorée", "chicoree"], [10, 11, 12, 1, 2, 3], [10, 11, 12, 1, 2, 3, 4]),
    "Nüsslisalat": (["nüsslisalat", "feldsalat"], [1, 2, 3, 9, 10, 11, 12], [1, 2, 3, 9, 10, 11, 12]),
    "Rosenkohl": (["rosenkohl"], [10, 11, 12, 1, 2], [10, 11, 12, 1, 2]),
    "Schwarzwurzeln": (["schwarzwurzel"], [10, 11, 12, 1, 2, 3], [10, 11, 12, 1, 2, 3]),
    "Topinambur": (["topinambur"], [10, 11, 12, 1, 2, 3], [10, 11, 12, 1, 2, 3]),
    "Erdbeeren": (["erdbeer"], [5, 6, 7], [5, 6, 7]),
    "Kirschen": (["kirsche"], [6, 7], [6, 7]),
    "Aprikosen": (["aprikose"], [7, 8], [7, 8]),
    "Zwetschgen": (["zwetschge", "pflaume"], [8, 9, 10], [8, 9, 10]),
    "Melone": (["melone"], [6, 7, 8, 9], [6, 7, 8, 9]),
    "Beeren": (["heidelbeer", "himbeer", "brombeer"], [6, 7, 8, 9], [6, 7, 8, 9]),
    "Spinat": (["spinat"], [3, 4, 5, 6, 9, 10, 11], [3, 4, 5, 6, 9, 10, 11]),
}
# Zeilen mit diesen Wörtern sind Konserven/Gewürze, keine frische Saisonware
NOT_FRESH = re.compile(r"püree|mark|dose|passiert|pelati|getrocknet|sugo|essiggurke|gewürzgurke|cornichon|pulver|kerne|kernöl|tiefgekühlt|tk-|schnittlauch|bärlauchpesto", re.I)

SEASONS = {"winter": [12, 1, 2], "fruehling": [3, 4, 5], "sommer": [6, 7, 8], "herbst": [9, 10, 11]}

# --- Diät -------------------------------------------------------------------------------------------
MEAT = re.compile(
    r"fleisch|poulet|huhn|hühner|hähnchen|\brind|kalb|schwein|lamm|speck|schinken|hackfleisch|ghackets|gehacktes\b|"
    r"wurst|würste|salami|chorizo|cervelat|wienerli|landjäger|merguez|pancetta|prosciutto|coppa|bündner|mostbröckli|"
    r"lachs|fisch|thon|thunfisch|crevette|krevette|garnele|scampi|forelle|egli|dorsch|kabeljau|zander|sardelle|anchovis|"
    r"seeteufel|dorade|wolfsbarsch|felchen|saibling|pangasius|muschel|tintenfisch|calamar|sepia|hummer|krabbe|"
    r"salsiccia|surimi|brät|kebab|gyros|nduja|'nduja|lardo|guanciale|kassler|leberkäse|fleischkäse|"
    r"steak|entrecôte|geschnetzeltes|plätzli|ente\b|truthahn|trute|kaninchen|hirsch|\breh\b|leber|saucisson|kutteln",
    re.I,
)
MEAT_EXCEPTIONS = re.compile(r"vegi|vegetar|vegan|planted|quorn|ersatz|bouillon|fond|gelatine|fischsauce", re.I)
ANIMAL = re.compile(
    r"milch|rahm|butter|käse|quark|joghurt|jogurt|\beier?\b|eigelb|eiweiss|mozzarella|parmesan|sbrinz|gruyère|"
    r"ricotta|mascarpone|crème fraîche|creme fraiche|sauerrahm|feta|halloumi|honig|mayonnaise|raclette|fondue",
    re.I,
)
ANIMAL_EXCEPTIONS = re.compile(r"kokos|hafer|soja|mandel|pflanz|vegan|erdnussbutter", re.I)

NOT_MAIN = re.compile(
    r"dessert|kuchen|torte|guetzli|gebäck|cake|muffin|biscuit|cookie|brownie|konfitüre|sirup|glace|sorbet|"
    r"getränk|drink|smoothie|punsch|bowle|zopf|\bbrot\b|brötchen|apéro|apero|dip\b|sauce\b|pesto\b|crêpe süss|"
    r"porridge|müesli|birchermüesli|frühstück|creme\b|mousse|tiramisu|guezli|weihnachtsgebäck|brunsli|mailänderli|"
    r"chräbeli|lebkuchen|grittibänz|osterfladen|praline|konfekt|marmelade|chutney|sirup|tee\b|kompott",
    re.I,
)
MAIN_HINT = re.compile(r"hauptgericht|hauptspeise|hauptmahlzeit|main|abendessen|mittagessen", re.I)

# Vorfilter auf den URL-Slug, damit nicht tausende Seiten geladen werden
SLUG_GOOD = re.compile(
    r"risotto|gratin|eintopf|curry|pasta|spaghetti|nudel|hörnli|hoernli|magronen|rösti|roesti|waehe|wähe|quiche|"
    r"ragout|geschnetzelt|braten|auflauf|lasagne|gnocchi|polenta|ofen|pfanne|bowl|suppe|chili|tajine|"
    r"kuerbis|kürbis|lauch|wirz|randen|ruebli|rüebli|kartoffel|spinat|fenchel|kohl|kabis|sellerie|pastinake|"
    r"chicoree|chicorée|zucchetti|zucchini|aubergine|peperoni|tomate|spargel|baerlauch|bärlauch|bohnen|"
    r"poulet|rind|kalb|schwein|lachs|fisch|hackfleisch|ghackets|wurst|cervelat|capuns|pizokel|spaetzli|spätzli|"
    r"knoepfli|knöpfli|pizza|tofu|linsen|kichererbsen",
    re.I,
)
SLUG_BAD = re.compile(
    r"kuchen|torte|guetzli|cake|muffin|dessert|glace|creme|mousse|konfitu|sirup|drink|smoothie|zopf|brot|"
    r"biscuit|cookie|brownie|tiramisu|parfait|sorbet|punsch|apero|dip|chutney|kompott|porridge|muesli|crepe|"
    r"waffel|praline|schoggi|schokolade|lebkuchen|gritti|osterfladen|brunsli|mailaenderli|zimtstern",
    re.I,
)

# --- Zutaten ----------------------------------------------------------------------------------------
UNITS = {
    "g": "g", "gr": "g", "kg": "kg", "dl": "dl", "l": "l", "ml": "ml", "cl": "cl",
    "el": "EL", "tl": "TL", "msp": "Msp", "prise": "Prise", "prisen": "Prise",
    "stk": "Stk", "stück": "Stk", "bund": "Bund", "dose": "Dose", "dosen": "Dose", "becher": "Becher",
    "packung": "Pck", "pck": "Pck", "päckchen": "Pck", "beutel": "Pck", "zweig": "Zweig", "zweige": "Zweig",
    "zehe": "Zehe", "zehen": "Zehe", "scheibe": "Scheibe", "scheiben": "Scheibe", "glas": "Glas",
    "kopf": "Kopf", "köpfe": "Kopf", "tranche": "Tranchen", "tranchen": "Tranchen", "rolle": "Rolle",
    "rollen": "Rolle", "handvoll": "Handvoll", "stange": "Stange", "stangen": "Stange", "würfel": "Würfel",
    "cm": "cm", "pack": "Pck", "tropfen": "Tropfen", "zweiglein": "Zweig", "blatt": "Blatt", "blätter": "Blatt",
}
FRACTIONS = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125}
# Küchengeräte & Hilfsmittel gehören nicht auf die Einkaufsliste
EQUIPMENT = re.compile(r"\b(form|gratinform|springform|cakeform|ausstechform|blech|backpapier|alufolie|klarsichtfolie|"
                       r"brattopf|topf|pfanne|bratpfanne|grillpfanne|schüssel|spiess(chen|li)?|zahnstocher|küchenschnur|"
                       r"schnur|spritzbeutel|pinsel|thermometer|holzspiesse|muffinförmchen)\b", re.I)
# "Öl zum Braten", "Butter für die Form", "Kräuter zum Garnieren" -> Zusatz entfernen
USAGE = re.compile(r"\s+(zum|zur|für (die|das|den)|fürs)\s+.*$", re.I)
FILLER = re.compile(r"^(ca\.?|circa|etwa|wenig|etwas|einige|evtl\.?|nach belieben|je)\s+", re.I)

AISLES = [
    ("Gewürze & Saucen", r"salz|pfeffer|aromat|bouillon|paprika(pulver)?\b|curry(pulver)?|muskat|zimt|oregano|thymian|"
                         r"rosmarin|lorbeer|chili(flocken)?|cayenne|kümmel|kreuzkümmel|kurkuma|senf|essig|öl\b|öl,|olivenöl|"
                         r"rapsöl|sojasauce|ketchup|mayonnaise|tomatenpüree|tomatenmark|honig|zucker|mehl|maizena|backpulver"),
    ("Fleisch & Fisch", MEAT.pattern),
    ("Milch & Käse", r"milch|rahm|butter|käse|quark|joghurt|jogurt|\beier?\b|mozzarella|parmesan|sbrinz|gruyère|"
                     r"ricotta|mascarpone|crème fraîche|sauerrahm|feta|halloumi|tofu|raclette"),
    ("Brot & Gebäck", r"brot|baguette|toast|teig|blätterteig|kuchenteig|pizzateig|tortilla|wraps"),
    ("Vorrat & Konserven", r"reis|risotto|pasta|teigwaren|spaghetti|nudel|hörnli|magronen|penne|gnocchi|polenta|"
                           r"linsen|bohnen.*dose|kichererbsen|couscous|bulgur|quinoa|dose|kokosmilch|nüsse|mandeln|"
                           r"pinienkerne|kerne|wein|tomaten, gehackt|pelati|passata"),
    ("Obst & Gemüse", r".*"),
]


def guess_aisle(name: str) -> str:
    n = name.lower()
    for aisle, pat in AISLES:
        if re.search(pat, n, re.I):
            return aisle
    return "Sonstiges"


def parse_amount(tok: str) -> float | None:
    tok = tok.strip()
    for f, v in FRACTIONS.items():
        if tok == f:
            return v
        if tok.endswith(f) and tok[:-1].strip().isdigit():
            return int(tok[:-1]) + v
    m = re.match(r"^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?$", tok)
    if not m:
        m2 = re.match(r"^(\d+)/(\d+)$", tok)
        return int(m2.group(1)) / int(m2.group(2)) if m2 else None
    hi = m.group(2) or m.group(1)  # bei "1-2" die obere Menge nehmen
    return float(hi.replace(",", "."))


def parse_ingredient(line: str) -> dict | None:
    s = html.unescape(re.sub(r"<[^>]+>", " ", line)).strip()
    s = re.sub(r"\s+", " ", s)
    if not s or len(s) > 120:
        return None
    s = re.sub(r"\([^)]*\)", "", s).strip()   # "(ca. 600 g)" entfernen
    s = re.sub(r"([\d½¼¾⅓⅔⅛]+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)", r"\2", s)  # "400 - 500 g" -> "500 g"
    if EQUIPMENT.search(s.split(",")[0]) and not re.search(r"\b(für|zum)\b", s, re.I):
        return None
    s = re.sub(r"(\d+)\s+([½¼¾⅓⅔⅛])", lambda m: f"{int(m.group(1)) + FRACTIONS[m.group(2)]:g}", s)  # "1 ½" -> "1.5"
    s = FILLER.sub("", s)
    parts = s.split(" ", 2)
    amount, unit, rest = None, "", s
    if parts:
        amount = parse_amount(parts[0])
        if amount is None and len(parts) > 1 and re.match(r"^\d+$", parts[0]) is None:
            # Zahl direkt am Wort: "500g"
            m = re.match(r"^(\d+(?:[.,]\d+)?)([a-zA-Zäöü]+)\.?$", parts[0])
            if m and m.group(2).lower() in UNITS:
                amount, unit = float(m.group(1).replace(",", ".")), UNITS[m.group(2).lower()]
                rest = s.split(" ", 1)[1]
        elif amount is not None:
            tail = s.split(" ", 1)[1] if " " in s else ""
            u = tail.split(" ", 1)[0].rstrip(".").lower() if tail else ""
            if u in UNITS and " " in tail:
                unit, rest = UNITS[u], tail.split(" ", 1)[1]
            else:
                unit, rest = "Stk", tail
    # "gewaschener, gerüsteter Federkohl" -> "Federkohl" (Zubereitungs-Adjektive vor dem Nomen)
    rest = re.sub(r"^(?:[a-zäöüß]+,\s+)+", "", rest.strip())
    rest = re.sub(r"^(?:(?:gewaschen|gerüstet|geschält|gerieben|geputzt)(?:e|er|es|en)\s+)+(?=[A-ZÄÖÜ])", "", rest)
    name = USAGE.sub("", FILLER.sub("", rest.split(",")[0].strip(" .:-"))).strip()
    if not name or EQUIPMENT.fullmatch(name.split()[-1]) or re.match(r"^(ofenfeste|grill-|brat-)", name, re.I):
        return None
    if amount is None:
        amount, unit = 1.0, ""
    return {
        "name": name[0].upper() + name[1:],
        "amount": str(round(amount, 2)).rstrip("0").rstrip(".") if amount % 1 else str(int(amount)),
        "unit": unit,
        "bring_cat": guess_aisle(name),
    }


# --- HTTP -------------------------------------------------------------------------------------------
_robots: dict[str, urllib.robotparser.RobotFileParser] = {}


def get(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    return data.decode("utf-8", "replace")


def allowed(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc
    if host not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            rp.parse(get(f"https://{host}/robots.txt").splitlines())
        except Exception:
            rp.parse([])
        _robots[host] = rp
    return _robots[host].can_fetch(UA, url)


# --- Rezeptdaten aus HTML ---------------------------------------------------------------------------
def recipe_from_jsonld(page: str) -> dict | None:
    for m in re.finditer(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", page, re.S):
        try:
            data = json.loads(m.group(1).strip())
        except Exception:
            continue
        stack = [data]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                t = x.get("@type")
                if "Recipe" in (t if isinstance(t, list) else [t]):
                    return x
                stack.extend(v for v in x.values() if isinstance(v, (list, dict)))
    return None


class MicrodataRecipe(HTMLParser):
    """Liest itemprop-Felder (Swissmilk nutzt Microdata statt JSON-LD)."""
    WANT = {"recipeYield", "recipeIngredient", "totalTime", "recipeCategory", "keywords"}
    VOID = {"meta", "link", "img", "br", "input", "hr", "source"}

    def __init__(self):
        super().__init__()
        self.data: dict[str, list[str]] = {}
        self.capture: list[list] = []  # [prop, depth, parts]
        self.depth = 0
        self.h1: list[str] = []
        self.in_h1 = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        prop = a.get("itemprop")
        if tag == "h1":
            self.in_h1 = True
        if prop in self.WANT:
            if "content" in a or tag in self.VOID:
                self.data.setdefault(prop, []).append(a.get("content") or a.get("datetime") or "")
            else:
                self.capture.append([prop, self.depth, []])
        if tag not in self.VOID:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_h1 = False
        if tag in self.VOID:
            return
        self.depth -= 1
        while self.capture and self.capture[-1][1] >= self.depth:
            prop, _, parts = self.capture.pop()
            self.data.setdefault(prop, []).append(re.sub(r"\s+", " ", " ".join(parts)).strip())

    def handle_data(self, d):
        for c in self.capture:
            c[2].append(d)
        if self.in_h1:
            self.h1.append(d)


def recipe_from_microdata(page: str) -> dict | None:
    if 'itemprop="recipeIngredient"' not in page:
        return None
    p = MicrodataRecipe()
    p.feed(page)
    d = p.data
    m = re.search(r'<meta property="og:title" content="([^"]+)"', page)
    title = html.unescape(m.group(1)).split(" | ")[0].strip() if m else clean_title(" ".join(p.h1))
    return {
        "name": title,
        "recipeYield": (d.get("recipeYield") or [""])[0],
        "recipeIngredient": [x for x in d.get("recipeIngredient", []) if x],
        "totalTime": (d.get("totalTime") or [""])[0],
        "recipeCategory": d.get("recipeCategory", []),
        "keywords": ", ".join(d.get("keywords", [])),
    }


def clean_title(t: str) -> str:
    t = re.sub(r"\s+", " ", t or "").strip()
    t = re.sub(r"^Navigieren auf [\w.]+\s*", "", t)
    t = re.sub(r"\s*Fusszeile$", "", t)
    return t.split(" | ")[0].strip()


def extract(page: str) -> dict | None:
    r = recipe_from_jsonld(page) or recipe_from_microdata(page)
    if not r:
        return None

    def as_text(v):
        if isinstance(v, list):
            return ", ".join(as_text(x) for x in v)
        if isinstance(v, dict):
            return v.get("name") or v.get("@id") or ""
        return str(v or "")

    return {
        "name": html.unescape(as_text(r.get("name"))).strip(),
        "yield": as_text(r.get("recipeYield")),
        "ingredients": [html.unescape(as_text(i)) for i in (r.get("recipeIngredient") or [])],
        "totalTime": as_text(r.get("totalTime")),
        "category": as_text(r.get("recipeCategory")),
        "keywords": as_text(r.get("keywords")),
        "diet": as_text(r.get("suitableForDiet")),
    }


# --- Schritte ---------------------------------------------------------------------------------------
def cmd_discover():
    CACHE.mkdir(exist_ok=True)
    rnd = random.Random(SEED)
    out = {}
    for site, cfg in SITES.items():
        try:
            xml = get(cfg["sitemap"], timeout=120)
        except Exception as e:
            print(f"{site}: Sitemap-Fehler {e}")
            continue
        locs = [u.strip() for u in re.findall(r"<loc>([^<]+)</loc>", xml)]
        recipes = [u for u in locs if re.match(cfg["match"], u)]
        slug = lambda u: urllib.parse.unquote(u.rstrip("/").split("/")[-1 if site != "migusto" else -2])
        good = [u for u in recipes if SLUG_GOOD.search(slug(u)) and not SLUG_BAD.search(slug(u))]
        rnd.shuffle(good)
        out[site] = good[:PER_SITE]
        print(f"{site}: {len(recipes)} Rezepte, {len(good)} passen zum Vorfilter, {len(out[site])} ausgewählt")
        time.sleep(DELAY_S)
    if EXTRA_URLS.exists():
        extra = [l.strip() for l in EXTRA_URLS.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
        out["extra"] = extra
        print(f"extra: {len(extra)} Einzel-Links")
    CANDIDATES.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")


def cache_file(url: str) -> Path:
    return PAGES / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".json")


def fetch_site(urls: list[str], log):
    for url in urls:
        f = cache_file(url)
        if f.exists():
            continue
        rec = {"url": url}
        try:
            if not allowed(url):
                rec["error"] = "robots.txt"
            else:
                r = extract(get(url))
                rec.update(r or {"error": "keine Rezeptdaten"})
        except Exception as e:
            rec["error"] = str(e)[:200]
        f.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        log(f"{'✗' if 'error' in rec else '✓'} {url}")
        time.sleep(DELAY_S)


def cmd_fetch():
    PAGES.mkdir(parents=True, exist_ok=True)
    cands = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    lock = threading.Lock()

    def log(msg):
        with lock:
            print(msg, flush=True)

    # eine Warteschlange pro Website: parallel über Websites, höflich innerhalb einer Website
    threads = [threading.Thread(target=fetch_site, args=(urls, log)) for urls in cands.values()]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


def iso_minutes(s: str) -> int | None:
    if not s:
        return None
    if re.match(r"^\d+$", s.strip()):
        return int(s)
    m = re.match(r"P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?", s.strip())
    if not m or not (m.group(1) or m.group(2)):
        return None
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0)


def source_of(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc
    for key in ("bettybossi", "migusto", "fooby", "swissmilk", "chefkoch"):
        if key in host:
            return key
    return host


def classify(raw: dict) -> dict | str:
    """Gibt ein App-Rezept zurück oder einen Ablehnungsgrund (str)."""
    name = clean_title(raw.get("name") or "")
    lines = raw.get("ingredients") or []
    cat_kw = f"{raw.get('category', '')} {raw.get('keywords', '')}"
    if NOT_MAIN.search(name) or NOT_MAIN.search(raw.get("category", "")):
        return "kein Hauptgericht"
    if raw.get("category") and not MAIN_HINT.search(cat_kw) and re.search(r"vorspeise|beilage|apéro|snack|dessert|gebäck", cat_kw, re.I):
        return "Vorspeise/Beilage"
    m = re.search(r"(\d+)", raw.get("yield") or "")
    servings = int(m.group(1)) if m else 0
    if not 2 <= servings <= 8:
        return f"Portionen unklar ({raw.get('yield')})"
    minutes = iso_minutes(raw.get("totalTime", ""))
    if minutes and minutes > 120:
        return f"zu lang ({minutes} Min.)"
    ingredients = [i for i in (parse_ingredient(l) for l in lines) if i]
    if not 4 <= len(ingredients) <= 22:
        return f"{len(ingredients)} Zutaten"

    meat_lines = [l for l in lines + [name] if MEAT.search(l) and not MEAT_EXCEPTIONS.search(l)]
    animal_lines = [l for l in lines if ANIMAL.search(l) and not ANIMAL_EXCEPTIONS.search(l)]
    declared = raw.get("diet", "").lower()
    if meat_lines:
        diet = "fleisch"
    elif "vegan" in declared or not animal_lines:
        diet = "vegan"
    else:
        diet = "vegi"

    # Saison: Schnittmenge der verfügbaren Monate aller erkannten Saisongemüse
    months = set(range(1, 13))
    field_veg, veg_found = [], []
    for veg, (kws, field, available) in SEASON_VEG.items():
        hit = any(re.search(k if k.startswith("(?") else re.escape(k), l, re.I) and not NOT_FRESH.search(l) for k in kws for l in lines)
        if hit:
            veg_found.append(veg)
            months &= set(available)
            field_veg.append((veg, set(field)))
    if not months:
        return "Saison widersprüchlich"
    seasons = [s for s, ms in SEASONS.items() if len(months & set(ms)) >= 2]
    if not seasons:
        return "passt in keine Saison"
    # Saisonwörter im Titel schliessen andere Saisons aus ("Sommerliche Spätzli" nicht im Herbst)
    title_season = {
        "winter": r"winter|weihnacht|advent", "fruehling": r"frühling|frühlings|oster|spargel|bärlauch",
        "sommer": r"sommer|grill|erdbeer", "herbst": r"herbst|kürbis|wild\b|marroni",
    }
    named = [s for s, pat in title_season.items() if re.search(pat, name, re.I)]
    if named:
        seasons = [s for s in seasons if s in named] or seasons
    # Saison-Stärke: Freiland-frisch zählt 2, Lagerware 1
    strength = {}
    for s in seasons:
        ms = set(SEASONS[s])
        strength[s] = sum(2 if len(f & ms) >= 2 else 1 for veg, f in field_veg) + (2 if s in named else 0)

    rid = re.sub(r"[^a-z0-9]+", "-", name.lower().translate(str.maketrans("äöüéèàç", "aoueeac"))).strip("-")[:48]
    return {
        "id": f"{source_of(raw['url'])}-{rid}",
        "source_url": raw["url"],
        "source": source_of(raw["url"]),
        "title": name,
        "category": "import",
        "diet": diet,
        "servings": servings,
        "prep_time_min": minutes or 30,
        "primary_vegetables": veg_found,
        "ingredients": ingredients,
        "season_months": sorted(months),
        "seasons": seasons,
        "season_strength": strength,
    }


def cmd_build(per_season: int = 26):
    recipes, rejected = [], {}
    for f in sorted(PAGES.glob("*.json")):
        raw = json.loads(f.read_text(encoding="utf-8"))
        if "error" in raw:
            rejected[raw["url"]] = raw["error"]
            continue
        r = classify(raw)
        if isinstance(r, str):
            rejected[raw["url"]] = r
        else:
            recipes.append(r)

    # Doppelte Titel entfernen
    seen, unique = set(), []
    for r in recipes:
        key = re.sub(r"[^a-z]", "", r["title"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(r)

    # Vorschlag: pro Saison ½ vegi (inkl. vegan) und ½ Fleisch, saisonal stärkste zuerst, Quellen gemischt
    proposed = {}
    for season in SEASONS:
        for diet_group in ("vegi", "fleisch"):
            pool = [r for r in unique if season in r["seasons"] and ((r["diet"] == "fleisch") == (diet_group == "fleisch"))]
            is_salad = lambda r: bool(re.search(r"salat|bowl", r["title"], re.I))
            pool.sort(key=lambda r: (is_salad(r), -r["season_strength"].get(season, 0), r["prep_time_min"] > 60, r["source"]))
            # Quellen abwechseln
            by_src: dict[str, list] = {}
            for r in pool:
                by_src.setdefault(r["source"], []).append(r)
            picked = []
            while len(picked) < per_season // 2 and any(by_src.values()):
                for src in list(by_src):
                    if by_src[src] and len(picked) < per_season // 2:
                        picked.append(by_src[src].pop(0))
            for r in picked:
                proposed.setdefault(r["id"], set()).add(season)

    for r in unique:
        r["proposed"] = r["id"] in proposed
        r["proposed_for"] = sorted(proposed.get(r["id"], []))

    STAGING.write_text(json.dumps({"recipes": unique, "rejected": rejected}, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\n{len(unique)} brauchbare Rezepte, {len(rejected)} abgelehnt → {STAGING.name}")
    print(f"{'Saison':<10} {'vegi':>5} {'fleisch':>8}   (vorgeschlagen / verfügbar)")
    for s in SEASONS:
        v = [r for r in unique if s in r["seasons"] and r["diet"] != "fleisch"]
        m = [r for r in unique if s in r["seasons"] and r["diet"] == "fleisch"]
        pv = sum(1 for r in v if s in r["proposed_for"])
        pm = sum(1 for r in m if s in r["proposed_for"])
        print(f"{s:<10} {pv:>2}/{len(v):<3} {pm:>4}/{len(m):<3}")
    reasons: dict[str, int] = {}
    for why in rejected.values():
        k = re.sub(r"\(.*\)", "", why).strip()[:40]
        reasons[k] = reasons.get(k, 0) + 1
    print("Ablehnungsgründe:", dict(sorted(reasons.items(), key=lambda x: -x[1])[:8]))


def cmd_merge():
    """Vorgeschlagene (oder in tools/recipes_selected.json ausgewählte) Rezepte in die App übernehmen."""
    data = json.loads(STAGING.read_text(encoding="utf-8"))
    selected_file = ROOT / "recipes_selected.json"
    if selected_file.exists():
        ids = set(json.loads(selected_file.read_text(encoding="utf-8")))
        chosen = [r for r in data["recipes"] if r["id"] in ids]
    else:
        chosen = [r for r in data["recipes"] if r["proposed"]]
    keep = ("id", "source_url", "title", "category", "diet", "servings", "prep_time_min", "primary_vegetables", "ingredients", "season_months")
    out = [{k: r[k] for k in keep} for r in sorted(chosen, key=lambda r: r["title"])]
    target = ROOT.parent / "static" / "recipes_imported.js"
    target.write_text(
        "// Automatisch erzeugt von tools/import_recipes.py merge – nicht von Hand bearbeiten.\n"
        "// Nur Fakten (Titel, Portionen, Zutaten); Zubereitung steht auf der verlinkten Originalseite.\n"
        "window.OBSONARE_IMPORTED = " + json.dumps(out, ensure_ascii=False, indent=0).replace("\n", "") + ";\n",
        encoding="utf-8",
    )
    print(f"{len(out)} Rezepte → {target.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    {"discover": cmd_discover, "fetch": cmd_fetch, "build": cmd_build, "merge": cmd_merge}.get(cmd, lambda: print(__doc__))()
