# Übergabe vor Obsonare v2.0.0 (Stand 14.11.2026)

Alles liegt auf `main`, `npm run ci` grün. **Noch kein Release-Tag** – Joshua will erst weitere Features und testen (Test-Version baut sich bei jedem Push auf `main`).

## Auf main zusammengeführt
- Umbenennung **BringFrisch → Obsonare** (sichtbarer Name; Speicher-Schlüssel `bringfrisch_*`, Worker-Adressen, Cache-Präfix, Kalender-UIDs bleiben absichtlich).
  Offen (Chat «Obsonare»): Speicher-Umzug `bringfrisch_*` → `obsonare_*` und neue Adressen – erst nach Entscheid. Logo oben zeigt noch «BringFrisch».
- **Hofläden & Märkte** (Knopf im Einkauf, Google-Maps-Suche).
- **Knappen Vorrat in «Kaufen» vormerken**, «Alle auswählen» in der Gegenüberstellung (0413bab; zwei UI-Tests dazu angepasst, die App war richtig).
- **Alle Rezepte** (`static/app_alle.js`): Knopf in der Zeile «Meine Rezepte», kleine Memory-Karten nach Herkunft, darin Saison zuerst, Karte antippen → Tag Mo–So = einplanen, Rückgängig, Suche, ab Do KW-Umschalter. Regel `CORE.groupBySource`.
- **Vorrat-Zeile**: Name antippen = für Bring! vormerken, Zeile antippen / Name lange drücken = Blatt.

## Release v2.0.0 (wenn Joshua sagt «jetzt»)
1. `cd tests && npm ci && npm run ci` → «PASS: alles grün»
2. `git tag v2.0.0 && git push origin v2.0.0` (Nummer 2.0.0 ist entschieden: Handys mit 1.10.0 sehen so «Neue Version verfügbar»)
3. Actions-Lauf `deploy-pages.yml` prüfen (test → worker → deploy).

## Offene Zweige
- `ccr-c75d431f-nkpfcv` (Hofläden) und `ccr-315f8b43-5aq49r` (Obsonare): Inhalt ist auf main, Zweige können gelöscht werden.
