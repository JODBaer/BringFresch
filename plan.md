# BringFrisch – Plan

Ziel: Tool für **unsere WG**, einfach zu benutzen. Erst mit der WG testen, dann erweitern.

## Erledigt

- [x] App-Absturz behoben (doppelte Variable), CI-Syntaxcheck
- [x] Schlanke App: Matrix-Plan, Alpine-Design (Schneeweiss/Alpengrün, Dark Mode), echte WG
- [x] Mengen korrekt (Rezepte für 4 Portionen), saubere Bring!-Mengen
- [x] Wochenwahl (Memory): 14 Saison-Gerichte, Stimmen, Wunschtag, Neu mischeln, faire Tagesverteilung
- [x] Cloudflare Worker: Bring!-Sync (Bot-Konto), gemeinsame Wochenwahl, gemeinsamer Plan, Kalender-Abo, Rezept-Link-Import
- [x] 82 Saisonrezepte (Betty Bossi, Migusto, Fooby, Swissmilk), ½ vegi / ½ Fleisch pro Saison
- [x] Python-Backend entfernt (alter Stand: `git tag v0-full`)

## Als Nächstes

- [ ] **Joshua**: Bring!-Bot-Konto + Cloudflare einrichten → `worker/README.md`
- [ ] Worker-Adresse in `static/app.js` (`DEFAULT_SYNC_URL`) eintragen
- [ ] **Praxistest**: eine echte Woche mit Lukas, Leonie und Jo planen, einkaufen, Feedback sammeln
- [ ] Danach entscheiden: Mengen der Protein-Zusätze (aktuell 150 g Fleisch / 100 g Käse pro Person), Rezeptauswahl prüfen, evtl. Koch-Zuteilung

## Später, nur wenn nötig

- Echte Kalender-Einladungen mit «Annehmen» (braucht E-Mail-Dienst)
- Weitere Rezepte einzeln über «Eigenes Rezept → Link» statt Massen-Import
