# BringFrisch – Überarbeiteter Masterplan (plan.md)

> **Motto**: *Einfach, robust und alltagstauglich – Schweizer Saisongemüse & WG-Menüplan.*

---

## 1. Was ist das Problem und wie lösen wir es?

Bisher gab es einen Konflikt zwischen zwei Anforderungen:
1. **«Es muss sofort und überall auf dem Handy laufen (GitHub / gratis).»**
2. **«Es muss direkten Bring!-API-Sync mit persönlichem Login haben.»**

**Die technische Realität:**
* **Bring!-API erlaubt keine direkten Browser-Aufrufe (CORS-Sperre)**. Ein Webbrowser darf aus Sicherheitsgründen die Bring!-Server nicht direkt kontaktieren – dafür braucht es ein kleines Python-Backend.
* **GitHub Pages kann kein Python ausführen** (nur statisches HTML/JS).
* **Lokal auf dem PC**: Windows Firewall blockiert standardmäßig das iPhone im Heimnetzwerk.

**Die Lösung: Das 2-Stufen-Modell (Fail-Safe)**
* **Stufe 1 (Immer & Überall)**: BringFrisch läuft zu 100% autark im Browser (PWA). Menüauswahl, 3-Komponenten-Portionen, Reste-Puffer und Schweizer Saisongemüse funktionieren immer.
* **Stufe 2 (Mit Python-Backend)**: Wenn ein Backend erreichbar ist (kostenlos auf Render.com oder am PC), schaltet sich der direkte 1-Klick Bring!-API-Sync automatisch dazu. Wenn kein Backend erreichbar ist, stürzt nichts ab – es gibt einen 1-Klick Fallback.

---

## 2. Der klare 3-Schritte-Workflow in der App

```
1️⃣ Menü-Auswahl  ➔  2️⃣ Esser & Reste verteilen  ➔  3️⃣ Bring! füllen
(7-Tage Kacheln)       (3-Komponenten-System)          (API-Sync oder Direkt-Export)
```

1. **Menü-Auswahl (7 Wochentage auf einen Blick)**:
   * Kacheln für Mo–So.
   * Schweizer Saisonrezepte (VSGP / Swissmilk / Betty Bossi).
   * Eigene Rezepte einfach per Link (`+ Link`) importieren.

2. **Leute verteilen («Alles für alle» + Zmittag-Puffer)**:
   * Kein kleinster gemeinsamer Nenner!
   * **Gemeinsame Basis** (Risotto, Pasta, Gschwellti) für alle.
   * **Individuelles Protein** je nach Esser (🥩 Lukas: Fleisch / 🧀 Jonas: Käse / 🌱 Anna: Vegan).
   * **Standard: +2 Portionen Reste-Puffer** (fürs Zmittag am nächsten Tag).

3. **Bring! füllen**:
   * Zieht Vorräte (Salz, Öl, Gewürze) automatisch ab.
   * Schreibt Zutaten mit Mengenangaben in die Bring!-Liste.

---

## 3. Bereitstellungs- und Hosting-Plan

| Umgebung | Verwendungszweck | Status & Vorgehen |
|---|---|---|
| **Lokal am PC** | Entwicklung & Testen | `start.bat` starten ➔ Browser öffnet `http://localhost:8080/` |
| **GitHub Pages** | Kostenlose Web-App fürs Handy | Repo auf **Public** stellen ➔ Settings > Pages aktivieren ➔ Link `https://jodbaer.github.io/BringFresch/` läuft |
| **Render.com** | 24/7 Gratis Python-Backend | `render.yaml` liegt bereit ➔ Mit GitHub verknüpfen ➔ Bring!-API läuft 24/7 in der Cloud |

---

## 4. Sofort-Massnahmen

- [x] Service Worker auf **Network-First** umgestellt (keine veralteten Caches mehr).
- [x] Fallback-System: App funktioniert auch ohne Backend stabil.
- [ ] GitHub Pages aktivieren (Repo auf Public stellen in GitHub Settings).
- [ ] Bring!-Sync live testen.
