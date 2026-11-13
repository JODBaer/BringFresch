# Obsonare – Redesign «Plan»-Ansicht (Übergabe zur Umsetzung)

Referenz-Prototyp: `obsonare-prototyp.html` (eine Datei, im Browser öffnen; `?os=ios` / `?os=android` erzwingt den Stil).
Nur die **Plan**-Ansicht ist ausgearbeitet. Einkauf, Rezepte & Saison, Einstellungen folgen separat.

## 1. Plattform & Stil
- Automatische Erkennung: Android → **Google Material 3 Expressive**, sonst (iPhone) → **Glas-Stil** (iOS Liquid Glass). Manuell umschaltbar in Einstellungen.
- Gleicher Aufbau, gleiche Farben, gleiche Bedienung – nur die Oberflächen unterscheiden sich.
  - Glas: Leisten, Zeilen, Pop-ups aus Glas (`backdrop-filter: blur(22px) saturate(1.9)`, helle Lichtkante oben, innerer Glanz), Hintergrund = weiche Farbflächen (kein Bild).
  - Android: **kein Glas**, deckende Tonflächen (surface-container-Stufen), Expressive-Formen (grosse Aussen-/kleine Innenradien in Listen, Pillen-Knöpfe, Formwechsel beim Drücken).
- Schrift: Roboto Flex.

## 2. Farben (Hellgrün #90EE90 + Pistazie #93C572)
| Rolle | Hell | Dunkel |
|---|---|---|
| Primär (Text/Knöpfe) | #568F56 / #3A5F3A | #90EE90 |
| Primär-Container (Personen, heute) | #C8F6C8 / #90EE90 | #3A5F3A |
| Sekundär-Container | #E1EFCF | #34452A |
| Bring!-Hervorhebung (Glas) | Pistazie #93C572 | – |
| Flächen (Android) | #F8FCF4 → #D9E9CD | #101510 → #2F3C2D |
| Text auf Hellgrün | #1D301D | #EEFCEE |
Reines Hellgrün nie mit weisser Schrift (zu wenig Kontrast).

## 3. Aufbau (von oben nach unten)
1. **Leiste:** «Bring**Frisch**» (Frisch grün) + «KW 46 · November». Rechts: Wochenwahl als **Kalender-Symbol**, daneben **Bring!-Chip** «🛒 24 Artikel».
2. **«Wochenplan · Tag = Menü · Gericht = wechseln»** – kleine, fixe Zeile (10 px), verschwindet nie.
3. **7 Tage** als Liste.
4. **Saison-Zeile** («Saison im November: …»).
5. **Navigation:** Plan · Einkauf · Rezepte & Saison · Einstellungen – jede direkt als Seite (früheres ⋮-Menü entfällt, Inhalte unter Einstellungen → «Mehr»).

## 4. Tageszeile (links → rechts)
- **Tag** (Kreis; heute = Keks-Form, hellgrün). Antippen = Menü auf-/zuklappen.
- **Gericht** (eine Zeile, gekürzt) + darunter **Infos** (vegi/Fleisch · Dauer). Antippen = Menü wechseln.
- **WG-Personen** als **überlappende Kreise** mit Initialen; ab 5 Personen zwei versetzte Reihen (bis 7 lesbar). Antippen = an/ab. Abwesend = **ausgegraut + schräger Strich**.
- **+N Reste** als kleine **Hochzahl** direkt rechts oben an den Kreisen.
- **Gesamtzahl** (Personen + Reste) gross; **Antippen = +1** (0…6, dann wieder 0); **▾ daneben = Auswahl** (native Select).

## 5. Aufklappen – möglichst ruhig
- Kopfzeile bleibt **exakt stehen** (Tag, Personen, Zahl oben verankert; nur Farbe des Tages wechselt).
- Langer Name läuft in der Kopfzeile auf bis zu 3 Zeilen weiter – **kein doppelter Titel**.
- Darunter klappt auf: Zutaten mit Mengen (2 Spalten), Knöpfe **«Zum Rezept ↗»** und **«Wechseln»**.
- Andere Zeilen ändern sich **nicht**. Schriftgrössen ändern sich nie.
- **Alle 7 Tage müssen mit einem offenen Tag sichtbar bleiben** (bis iPhone SE / ~600 px Höhe). Dafür wird die Zeilendichte **einmal beim Start/Drehen** bestimmt (Stufen d1–d3: kleinere Zeilen/Kreise, Infozeile aus), nie beim Aufklappen.

## 6. Menü wechseln (Blatt von unten)
- Max. halbe Bildschirmhöhe; wird nur grösser, wenn das Suchfeld fokussiert ist.
- Suchfeld oben (auch eigenes Menü eintippbar), **«Beliebt bei euch» oben** (nach Häufigkeit ♥ n×), darunter «Weitere».
- Tastatur: Blatt sitzt über der Bildschirmtastatur (visualViewport); Pfeile/Enter/Esc. Auf Touch-Geräten Tastatur nicht automatisch öffnen.
- Nach Wahl: Hinweis unten mit «Rückgängig».
- Tippen vs. Scrollen: Aktion nur bei echtem Tippen (Bewegung < 8 px, Scrollposition unverändert).

## 7. Bring!-Chip (oben, immer am gleichen Platz)
- Ruhig: «🛒 24 Artikel». Nach **Sync** (Herunterziehen/Aktualisieren): grün hervorgehoben «24 für Bring!» + kurzer Hüpfer. Nach dem Füllen: «✓ in Bring!», Hinweis mit Details + Rückgängig.
- Keine eigene Einkaufskorb-Karte mehr.

## 8. Wochenwahl
- Ist für die aktuelle Woche nichts gewählt (oder ist ab **Donnerstag** die nächste Woche noch offen, siehe Chip «KW n →» in der Abschnittszeile): beim Start **Pop-up** mittig («Wochenwahl starten» / «Später»), Hintergrund verschwommen/abgedunkelt.
- Nach Wahl oder «Später» **fliegt das Pop-up in das Kalender-Symbol** oben (FLIP-Animation); solange offen: roter pulsierender Punkt am Symbol.
- Eigentlicher Auswahl-Ablauf ist noch zu bauen.

## 9. Navigation – animierte Symbole (beim Antippen)
- Plan: Kalenderblatt blättert, Termin wird eingetragen.
- Einkauf: Artikel fällt in den Wagen, darunter läuft ein Boden aus kurzen Strichen weg (Wagen selbst fährt nicht weg).
- Rezepte & Saison: Rüebli und Messer schwingen ins Kreuz (wie Messer & Gabel) und bleiben stehen.
- Einstellungen: Zahnrad dreht langsam (~2,2 s) aus.
- `prefers-reduced-motion` respektieren.

## 10. Sonstiges
- Scrollbalken unsichtbar, ohne Layout-Einfluss; unsichtbarer **Greifstreifen** rechts (10 px), feiner Balken nur beim Scrollen/Ziehen.
- Pull-to-Refresh mit Formwechsel-Ladeindikator (Android) bzw. Glas-Kreis (iPhone).
- Hell/Dunkel folgt dem System, pro Handy umschaltbar (Einstellungen → Stil: Automatisch / Hell / Dunkel).
- Mitbewohner-Anzahl im Prototyp über Einstellungen umschaltbar (4/5/7) – nur zum Testen.
