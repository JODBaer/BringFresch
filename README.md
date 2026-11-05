# 🥬 BringFrisch: Günstig gekocht, ausgewogen gelebt.

> **Fokus auf Gesundheit & Portemonnaie mit Schweizer Saisongemüse direkt vom Bauern.**  
> Autonome Progressive Web App (PWA) für Smartphones (Android & iOS) mit Bring!-Integration, WG-Kollaboration und Quittungs-Scanner.

---

## 🎯 Highlights

- 🇨🇭 **100% Schweizer Saisongemüse**: Basiert auf dem offiziellen Saisonkalender von **gemuese.ch** (VSGP) und **kartoffel.ch** (Swisspatat). Erkennt automatisch den aktuellen Monat (Freiland vs. Schweizer Lagerware).
- 💰 **Günstig & Ausgewogen**: Kostenschätzung pro Person (durchschnittlich CHF 2.50 – 3.80 pro Hauptmahlzeit) mit intelligentem Mengenausgleich über die Woche.
- 📱 **Autonom & Offline-fähig (PWA)**: Läuft direkt im mobilen Browser auf iPhone & Android oder als installierte App auf dem Home-Bildschirm – **ohne LLM-Kosten oder externe KI-Agenten**.
- 👥 **WG-Modus (Gemeinsam planen & kochen)**:
  - Gemeinsamer WG-Code (z.B. `wg-limmat-4`) für den synchronisierten Menüplan.
  - Zuweisung von Koch-Diensten pro Wochentag.
  - Tinder-Style Swipe-Karten (Mo–So) zum Durchswipen und Neu-Würfeln.
- 🛒 **Bring! Synchronisation**:
  - Aggregiert alle Zutaten der 7 Tage und skaliert Mengen exakt nach WG-Grösse (1–8 Personen).
  - Gruppiert nach offiziellen Bring!-Kategorien (*Obst & Gemüse*, *Milch & Käse*, *Vorrat* etc.).
  - 1-Klick-Export in deine Bring!-Einkaufsliste.
- 🧾 **Quittungs-Scanner & Fehl-Check**:
  - Kassenbon (Migros, Coop, Denner, Aldi, Lidl) fotografieren oder Text einfügen.
  - Automatischer Diff: ✅ Bereits gekauft vs. ⚠️ Fehlt noch im Einkaufswagen.
  - Gesamtsumme für die WG-Kasse.
- 📅 **Kalender-Export**: 1-Klick-Download als `.ics`-Datei für Apple Kalender, Google Kalender und Outlook.

---

## 🚀 Schnellstart

### 1. Server starten (lokal oder im Heimnetzwerk / WG-WLAN)
```bash
python -m bringfrisch.server
```
Der Server läuft nun auf: `http://localhost:8080`

### 2. Auf dem Handy öffnen & als PWA installieren
1. Öffne die IP deines Rechners im Handy-Browser (z.B. `http://192.168.1.50:8080`).
2. **iPhone (Safari)**: Tippe auf den *Teilen-Button* ➔ *«Zum Home-Bildschirm»*.
3. **Android (Chrome)**: Tippe auf die drei Punkte ➔ *«App installieren»*.

### 3. CLI-Modus (für Automationen / Cronjob)
Du kannst BringFrisch auch ohne UI auf der Konsole ausführen:
```bash
# Wochenplan für 3 Personen (vegetarisch) generieren & Kalenderdatei erzeugen
python bringfrisch_cli.py --persons 3 --diet vegi --export-ics mein_plan.ics

# Direkt mit Bring! synchronisieren
python bringfrisch_cli.py --persons 4 --sync-bring --email dein@bring.ch --password deinpasswort
```

---

## 📂 Projektstruktur

```
BringFresch/
├── bringfrisch/                 # Python Backend & Logik
│   ├── __init__.py
│   ├── season.py               # Schweizer Saison-Manager (VSGP / gemuese.ch)
│   ├── engine.py               # Menü- & Budget-Engine, Mengen-Aggregator
│   ├── bring_api.py            # Bring! REST API v2 Client & Sync
│   ├── receipt_scanner.py      # Quittungs-Diff & Kassenbon-Scanner
│   ├── calendar_sync.py        # iCalendar (.ics) Generator
│   └── server.py               # HTTP REST Server für Web & PWA
├── data/
│   ├── swiss_seasonal.json     # Schweizer Saisonmatrix (12 Monate)
│   ├── recipes.json            # Budget- & Saisonrezepte mit Bring-Kategorien
│   └── wg_plans.json           # Gespeicherte WG-Wochenpläne
├── static/                     # Mobile-First PWA Frontend
│   ├── index.html              # Responsive App-Shell mit Swipe-Cards
│   ├── app.js                  # PWA-Logik, Touch-Gesten, Bring!-Sync
│   ├── manifest.json           # Web App Manifest
│   └── sw.js                   # Service Worker für Offline-Betrieb
├── bringfrisch_cli.py          # Terminal- & Cron-Runner
└── README.md                   # Projektdokumentation
```

---

## 🥗 Ernährungsfilter & Schweizer Küche

- **Vegi / Vegan**: Schweizer Hülsenfrüchte, Linsen, Wurzelgemüse, Kürbis.
- **Schweizer Klassiker**: Älplermagronen, Gschwellti, Schweizer Rösti, Wirz-Eintopf, Lauchwähe.
- **Kaltes Abendbrot**: Gschwellti mit Schweizer Bergkäse, Kräuterquark, Radieschen, Nüsslisalat.
- **Exotisch**: Schweizer Kürbis-Linsen-Curry, Randen-Risotto.
- **Mit Fleisch**: Ghackets mit Hörnli und viel frischem Lauch & Rüebli, Chicorée-Schinken-Gratin.

---

## 🔄 Git Workflow
Das Projekt ist vollständig versioniert. Änderungen committen:
```bash
git add .
git commit -m "feat: deine erweiterung"
```
