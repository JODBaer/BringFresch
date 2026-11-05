# BringFrisch – Architekturentscheidungen & Regeln (entscheide.md)

Dieses Dokument hält alle grundlegenden Architektur- und Verhaltensregeln des BringFrisch-Systems fest.

---

## 1. Kern-Entscheidungen

### Entscheidung 1: Kein «Kleinster gemeinsamer Nenner» ➔ Modulares 3-Komponenten Menü
* **Problem**: Wenn eine Person vegan isst, mussten bisher alle vegan essen. Wenn ein Fleisch-Esser anwesend war, durfte es trotzdem kein Fleisch geben.
* **Entscheidung**: **«Alles für alle»**. Ein Gericht besteht aus drei getrennten Teilen:
  1. **Gemeinsame Basis** (Risotto, Magronen, Pasta, Gschwellti) für alle.
  2. **Individuelles Protein/Topping**:
     * Lukas (Fleisch) bekommt z.B. Speck oder Rindssteak.
     * Jonas (Vegi) bekommt z.B. Halloumi oder Bergkäse.
     * Anna (Vegan) bekommt z.B. veganen Käse-Ersatz, Tofu oder Pesto.
  3. **Frische Beilage** (Schweizer Salat, Nüsslisalat, Rüebli).
* **Auswirkung auf Bring!**: Auf die Einkaufsliste kommt die Basis (für alle Personen) **plus** exakt die Menge Proteine für die an diesem Tag tatsächlich anwesenden Esser.

---

### Entscheidung 2: Immer +2 Portionen Reste-Puffer als Standard
* **Problem**: In WGs wird oft spontan mehr gegessen oder die Mitbewohner möchten am nächsten Tag Zmittag-Reste essen.
* **Entscheidung**: Standardmäßig wird jedes Gericht immer mit **+2 Portionen extra** berechnet:
  $$\text{Gesamtportionen} = \text{Anwesende Esser} + \text{Gäste} + 2 \text{ (Reste-Puffer)}$$
* Die Mengenskalierung der Einkaufsliste rechnet automatisch mit diesem Puffer.
* Auf der Tageskachel kann der Puffer mit `[–]` und `[+]` individuell angepasst werden.

---

### Entscheidung 3: Bring!-Synchronisation via offizielle API & persönlicher Login
* **Problem**: Zwischenablage-Workarounds («In Bring! Web einfügen») sind fehleranfällig und auf Smartphones unpraktisch.
* **Entscheidung**: Die App synchronisiert direkt über die **offizielle Bring!-REST-API** (`python-bring-api`):
  * Persönlicher Login mit E-Mail und Passwort.
  * Zugangsdaten und die gewählte Listen-ID werden sicher in `data/bring_config.json` gespeichert.
  * 1-Klick auf «Bring! Sync» überträgt die fehlenden Zutaten direkt in die Bring!-Liste der WG.
  * Vorhandener Grundvorrat (Salz, Pfeffer, Öl) wird automatisch herausgefiltert.

---

### Entscheidung 4: Monatlicher Saisongemüse-Sync
* **Problem**: Saisongemüse ändert sich im Jahresverlauf (Freiland vs. Schweizer Lagerware).
* **Entscheidung**:
  * Beim Wechsel in einen neuen Kalendermonat synchronisiert BringFrisch automatisch das Schweizer Gemüse der VSGP (`gemuese.ch`), die Swisspatat-Sorten und die aktuellen Bauern-News.
  * Im Saison-Tab gibt es einen manuellen Button «🔄 Monat-Sync» für Sofort-Abgleich.
  * Funktioniert dank `standalone_data.js` auch 100% offline ohne Internet.

---

### Entscheidung 5: Hosting & Smartphone-Kompatibilität (iPhone & Android)
* **Problem**: Der Nutzer möchte keinen Heim-PC laufen lassen (`localhost` unpraktisch auf dem Handy).
* **Entscheidung**:
  * BringFrisch ist eine **vollwertige Progressive Web App (PWA)**.
  * **Hosting**: Der Ordner `static/` kann direkt auf **GitHub Pages** (kostenlos, dauerhaft online unter `https://<user>.github.io/BringFresch/static/`) oder auf **Vercel** gehostet werden.
  * **P2P-Sharing**: Wochenpläne können ohne Datenbank über URL-Hash (`#plan=...`) per WhatsApp/Signal geteilt werden.
  * **iOS / iPhone**: Unterstützt `apple-mobile-web-app-capable`, `apple-touch-icon` und kann in Safari via *«Zum Home-Bildschirm»* wie eine App installiert werden.
  * **Android**: Unterstützt Web App Manifest (`manifest.json`) und Service Worker (`sw.js`) für Offline-Nutzung.

---

## 2. Zusammenfassung aller Systemregeln

| Regel | Beschreibung |
|---|---|
| **R1: 3-Schritte-Workflow** | 1. Menü-Auswahl $\rightarrow$ 2. Leute verteilen $\rightarrow$ 3. Bring! füllen. |
| **R2: 3-Teile-Menü** | Jedes Gericht = Basis + individuelle Proteine + frische Beilage. |
| **R3: Zmittag-Puffer** | Immer +2 Portionen extra einberechnen, außer der Nutzer stellt auf 0. |
| **R4: Direkte Bring!-API** | Kein Clipboard-Export; echter API-Push mit persönlichem Login. |
| **R5: Grundvorrat** | 30+ Schweizer Grundzutaten (Salz, Aromat, Öl) bleiben zuhause, es sei denn leer markiert. |
| **R6: Ernte-Automatik** | Jeden Monat automatischer Abgleich mit den Schweizer Erntedaten (VSGP). |
| **R7: Serverlos mobil** | Voll mobilfähig auf iPhone & Android als PWA, teilbar via Link. |
