# BringFrisch – Architekturentscheidungen (entscheide.md)

Dieses Dokument hält alle grundlegenden Architektur- und Verhaltensregeln des BringFrisch-Systems verbindlich fest.

---

## 1. Kern-Entscheidungen (ADR)

### ADR 1: Modulares 3-Komponenten Menü («Alles für alle»)
* **Prinzip**: Kein Zwang zum kleinsten gemeinsamen Nenner. Wenn eine Person Fleisch isst und eine vegan, muss nicht die ganze WG vegan essen.
* **Aufbau jedes Rezepts**:
  1. **Basis** (z.B. Risotto, Teigwaren, Kartoffeln) – skaliert nach Gesamtanzahl Personen inkl. Reste.
  2. **Individuelle Proteine**:
     * Fleisch (Lukas): z.B. Speck, Geschnetzeltes, Bratwurst (+150g).
     * Vegetarisch (Jonas): z.B. Schweizer Grillkäse, Halloumi, Spiegelei (+100g).
     * Vegan (Anna): z.B. Tofu, veganer Reibkäse, Pesto (+1 Portion).
  3. **Frische Beilage**: Saisonaler Schweizer Salat (Nüsslisalat, Rüeblisalat).

### ADR 2: Standardmässig +2 Portionen Reste-Puffer
* Jedes Gericht wird standardmässig mit **+2 Portionen** für den nächsten Mittag gerechnet:
  $$\text{Gesamtportionen} = \text{Esser} + \text{Gäste} + 2$$
* Der Puffer kann auf der Tageskachel mit `[–]` und `[+]` jederzeit pro Tag angepasst werden.

### ADR 3: 2-Stufen Bring!-Integration (Robust & Ausfallsicher)
* **Problem**: Der direkte Bring!-API-Sync erfordert ein Python-Backend (CORS-Schutz der Bring!-Server).
* **Entscheidung**:
  * **Stufe 1 (Backend aktiv)**: Direkter REST-API Sync über `python-bring-api` mit persönlichem Login (E-Mail/Passwort) und automatischer Listen-Auswahl.
  * **Stufe 2 (Kein Backend / Offline)**: 1-Klick Bring!-Direktlink oder formatierter Text-Export, damit die App auch ohne laufenden Server mobil nie blockiert ist.

### ADR 4: Monatliche Schweizer Saison-Synchronisation
* Automatische Ernte-Aktualisierung beim Wechsel des Kalendermonats (VSGP `gemuese.ch` und Swisspatat).
* Trennung von Freiland-Gemüse und Schweizer Lagerware.

### ADR 5: Hosting & PWA-Fähigkeit
* **Frontend**: Statische PWA, 100% offline-fähig, installierbar auf iOS Safari («Zum Home-Bildschirm») und Android Chrome.
* **Backend**: Leichtgewichtig in Python (`bringfrisch.server`), deploybar lokal oder kostenlos auf Cloud-Plattformen (z.B. Render.com via `render.yaml`).

---

## 2. Die 7 Systemregeln

| Regel | Bezeichnung | Detail |
|---|---|---|
| **R1** | **3-Schritte-Workflow** | 1. Menü-Auswahl $\rightarrow$ 2. Leute & Reste verteilen $\rightarrow$ 3. Bring! füllen. |
| **R2** | **Alles für alle** | Modulares 3-Teile-Menü (Basis + Proteine nach Esser + Beilage). |
| **R3** | **Zmittag-Puffer** | Standard +2 Portionen extra einplanen. |
| **R4** | **Hybrid-Sync** | Echter Bring!-API-Push wenn Backend online, smarter Fallback wenn offline. |
| **R5** | **Grundvorrat** | 30+ Schweizer Grundzutaten (Salz, Aromat, Öl) bleiben zuhause, es sei denn leer markiert. |
| **R6** | **Ernte-Automatik** | Monatlicher automatischer Abgleich mit den Schweizer Erntedaten (VSGP). |
| **R7** | **PWA-Standard** | Mobilfähig, responsiv, sicher vor Caching-Problemen (Network-First). |
