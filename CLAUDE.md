# BringFrisch – Handover & System-Kontext (CLAUDE.md)

Dieses Dokument dient als vollständige Übergabe für **Claude / Claude Code**. Alle Architektur-Entscheidungen, Fachregeln und Dateistrukturen sind hier zusammengefasst.

---

## 1. Projekt-Vision & Kern-Architektur

**BringFrisch** ist ein mobiler Schweizer WG-Menüplaner & Einkaufs-Assistent (Fokus auf Schweizer Saisongemüse nach VSGP `gemuese.ch`, `kartoffel.ch`, `swissmilk.ch`) mit direkter Anbindung an **Bring!**.

### Architektur-Prinzip: «Phone-First PWA + Stateless Mini-Sync-Stecker»
1. **99% läuft autark auf dem Smartphone (PWA in `static/`)**:
   - Gehostet auf GitHub Pages: `https://jodbaer.github.io/BringFresch/` (Redirect über Root-`index.html` auf `static/`).
   - Alle Daten liegen im Browser-`localStorage` (und können per URL-Hash `#plan=...` serverlos via WhatsApp/iMessage geteilt werden):
     - `bringfrisch_current_plan`: 7-Tage-Wochenplan
     - `bringfrisch_members`: WG-Mitbewohner & Diät-Profile (`Jonas=vegi`, `Anna=vegan`, `Lukas=fleisch`)
     - `bringfrisch_user_staples`: Grundvorrat (Salz, Pfeffer, Aromat, Rapsöl etc.)
     - `bringfrisch_phone_bring_creds`: Gespeicherte Bring!-Zugangsdaten & Ziel-Liste auf dem Phone
     - `bringfrisch_layout_mode` (`bento` | `lego` | `matrix`) & `bringfrisch_theme_mode` (`light` | `dark` | `swiss`)
2. **Lokaler / Cloud Mini-Sync-Server (`bringfrisch/server.py`)**:
   - Dient als leichtgewichtige **Stateless Sync-Brücke** für die offizielle Bring!-REST-API (`python-bring-api`), da Bring! direkte Browser-CORS-Requests blockiert.
   - `POST /api/bring/sync` akzeptiert `{ items, email, password, token, list_uuid }` direkt in einem einzigen Aufruf vom Phone, loggt sich bei Bring! ein und pusht die Artikel.
   - Läuft kein Server (unterwegs), öffnet die PWA nahtlos das **Serverless Sync-Hub Modal** (`navigator.share` iOS/Android Teilen-Menü, `bring://` App-Deeplink & 1-Klick Copy).

---

## 2. Verbindliche Fachregeln (R1–R7)

* **R1 – 3-Schritte-Workflow**:
  `1. Menü-Auswahl (7 Tage)` $\rightarrow$ `2. Esser & Reste verteilen` $\rightarrow$ `3. Bring! füllen`.
* **R2 – Modulares 3-Komponenten-Menü («Alles für alle» statt kleinster gemeinsamer Nenner)**:
  Jedes Tagesgericht besteht aus 3 Bausteinen:
  1. **Gemeinsame Basis** (z.B. Risotto, Magronen, Gschwellti) – skaliert für alle Esser + Reste-Puffer.
  2. **Individuelle Proteine** (nur für an diesem Tag anwesende Esser):
     - 🥩 Fleisch (`Lukas`): +150g Speckwürfeli / Rindssteak pro Fleisch-Esser
     - 🧀 Vegi (`Jonas`): +100g Schweizer Grillkäse / Halloumi / Bergkäse pro Vegi-Esser
     - 🌱 Vegan (`Anna`): +1 Portion Veganer Reibkäse / Tofu / Pesto pro Vegan-Esser
  3. **Frische Beilage**: +50g Schweizer Nüsslisalat / Saisonsalat pro Portion.
* **R3 – Standard +2 Portionen Reste-Puffer**:
  Jeder Tag rechnet standardmässig `Gesamtportionen = Anwesende Esser + Gäste + 2 (Zmittag-Reste)`. Pro Tag über `[–]` und `[+]` anpassbar.
* **R4 – Rezept-Import via Browser-Link**:
  Nutzer können URLs von *Betty Bossi*, *Swissmilk*, *Fooby*, *Migusto* einfügen (`+ Link`), Titel wird automatisch erkannt und als klickbarer `🌐 Link` auf der Tageskachel gespeichert.
* **R5 – Monatlicher Schweizer Ernte-Sync**:
  Automatischer Abgleich beim Monatswechsel (`new Date().getMonth() + 1`) mit den Schweizer VSGP-Saisondaten.
* **R6 – Grundvorrat-Filter**:
  30+ Schweizer Standard-Gewürze/Öle werden automatisch von der Einkaufsliste gefiltert, solange sie nicht als «Leer» markiert sind.
* **R7 – 3 UX-Aufstellungen & 3 Farb-Themes live umschaltbar**:
  - Aufstellungen:
    1. `bento`: 2-Spalten Bento-Kachel-Wand (alle 7 Tage auf einen Blick)
    2. `lego`: 3-Teile Lego-Stack (Tages-Fokus mit 3 grossen Baustein-Kacheln & antippbaren Protein-Kacheln)
    3. `matrix`: Split-Matrix (7 kompakte Tages-Streifen oben + Live-Einkaufs-Kacheln nach Supermarkt-Abteilung direkt darunter)
  - Themes: `light` (Swiss Market Fresh), `dark` (Dark Culinary Studio), `swiss` (Alpine Minimalist).

---

## 3. Dateistruktur

```text
BringFresch/
├── CLAUDE.md                  # Dieses Übergabe-Dokument
├── plan.md                    # Kompakter Projekt- & Workflow-Plan
├── entscheide.md              # Architektur-Entscheidungen (ADRs) & Regeln R1-R7
├── index.html                 # Root-Weiterleitung auf static/ (erhält URL-Hash #plan=...)
├── start.bat                  # 1-Klick Windows-Starter für lokalen Sync-Server (Port 8080)
├── requirements.txt           # python-bring-api>=3.0.0, aiohttp>=3.9.0
├── render.yaml                # Optionales 1-Klick Cloud-Deployment für Python Sync-Server
├── static/                    # 100% Standalone Phone-First PWA
│   ├── index.html             # Haupt-UI inkl. UX Co-Designer Bar, 3 Layouts & Serverless Sync-Hub
│   ├── app.js                 # Gesamte Client-Logik, 3-Teile-Rechner, Layout-Renderer, Bring!-Sync
│   ├── standalone_data.js     # Offline-Datenbank: 12 Monate VSGP-Gemüse, Rezepte, Grundvorrat
│   ├── recipe_importer.js     # URL-Parser & Rezept-Importer für Betty Bossi, Swissmilk etc.
│   ├── pantry_tracker.js      # Tiefkühler-Gedächtnis & Ablauf-Warner
│   ├── manifest.json          # PWA Web-Manifest
│   └── sw.js                  # Service Worker (Network-First mit Offline-Cache-Fallback, v5)
└── bringfrisch/               # Python Mini-Sync-Brücke
    ├── server.py              # HTTP-Server & Stateless Bring!-Sync-Endpunkt (/api/bring/sync)
    ├── bring_api.py           # Wrapper um python-bring-api (Login, Listenwahl, Item-Push)
    ├── engine.py              # Backend-Menü-Engine
    └── season.py              # VSGP Saisondaten-Manager
```

---

## 4. Start- & Test-Befehle

* **Lokalen Sync-Server starten**:
  ```bash
  python -m bringfrisch.server
  ```
  *(Läuft auf `http://localhost:8080`)*
* **JavaScript Klammer-/Syntax-Check**:
  ```bash
  python scratch/test_js.py
  ```
* **Live GitHub Pages URL**:
  `https://jodbaer.github.io/BringFresch/`
