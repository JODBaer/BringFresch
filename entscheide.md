# BringFrisch – Entscheide

| # | Entscheid | Warum |
|---|---|---|
| 1 | Tool nur für die eigene WG, kein Produkt | Keine Konten, keine Datenschutz-/AGB-Fragen, Fokus |
| 2 | Eine Ansicht: Matrix-Plan; ein Design: Alpine (hell/dunkel automatisch) | 3 Layouts × 3 Themes = 9 Varianten waren nicht wartbar |
| 3 | «Alles für alle»: gemeinsame Basis + Protein pro Person + Salat | Kein kleinster gemeinsamer Nenner, Fleisch- und Vegi-Esser am selben Tisch |
| 4 | Standard +2 Portionen Reste (wählbar +0…+6) | Zmittag am nächsten Tag |
| 5 | Wochenwahl als Memory-Raster (statt Swipe), 14 Gerichte, Top 7 | Von Joshua im Live-Vergleich gewählt; alle sehen alles auf einen Blick |
| 6 | Cloudflare Worker statt Python-Server | Gratis, keine Kreditkarte, kein Kaltstart; Python-Server auf Render schlief ein |
| 7 | Bring! über ein eigenes Bot-Konto | Persönliche Google-Logins haben kein Bring!-Passwort; kein privates Konto im Server |
| 8 | Phones kennen nur einen WG-PIN | Bring!-Passwort liegt nur verschlüsselt im Worker |
| 9 | Kalender als Abo (iCal), Zusagen in der App | Abos sind in Google/Apple/Outlook nur lesbar; Esser antippen = zusagen |
| 10 | Rezepte: einmaliger Import von Fakten + Link, keine Texte/Bilder | Öffentliches Repo, Urheberrecht/AGB respektieren; kein weiteres Massen-Scraping |
| 11 | Keine externen CDNs in der App | Läuft offline, keine fremden Abhängigkeiten |
| 12 | Bring! ist die Wahrheit für die Liste, BringFrisch für Plan, Stimmen und Grundvorrat | Abhaken/Löschen in Bring! gilt immer; keine zweite Einkaufsliste pflegen |
| 13 | Bot löscht nur, was er selbst gesetzt hat (Merkliste im Worker) | Einträge von Mitbewohnern bleiben unangetastet |
| 14 | Schon Vorhandenes: pro Artikel nachfragen statt doppelt senden; danach «Rückgängig» | Zweites Rezept mit Rahm soll Menge erhöhen dürfen, aber nie unbemerkt |
| 15 | Zutaten auf Bring!-Katalognamen abbilden, genaue Sorte in die Mengenangabe | Bring!-Bilder und -Abteilungen; eigene Bilder hochladen kann die API nicht |
| 16 | ~~Grundvorrat-Pillen klein, durchgestrichen, ohne Bild~~ (abgelöst durch #26, 12.11.2026) | Von Joshua so gewählt («durchgestrichen ist gutes Design und die Grösse auch») |
| 17 | Neue Rezepte von Hand schreiben statt scrapen | Siehe #10; Fakten + kurze eigene Anleitung |
| 18 | Plan-Ansicht nach eigener Spezifikation: iPhone = Glas, Android = Material 3 Expressive, gleiche Bedienung | Fühlt sich auf beiden Handys «zuhause» an; Vorgabe in `docs/design/` |
| 19 | Schrift Roboto Flex lokal statt von Google Fonts | App bleibt offline und ohne fremde Server (#11) |
| 20 | Mit offenem Tag bleiben alle 7 Tage sichtbar; Dichte nur beim Start/Drehen ändern | Ruhige Ansicht, nichts springt beim Aufklappen |
| 21 | Ab Donnerstag die nächste Woche planen: Chip «KW 47 →» in der Abschnittszeile, eigener Plan pro KW | Am Wochenende schon einkaufen; Chip im Design der Vorgabe (Pistazie/Sekundär-Container), ändert die Höhe nicht, alle 7 Tage bleiben sichtbar. Wochenwahl pro Woche gespeichert, kein Raster geht verloren. Am Montag wird die geplante Woche zur laufenden, sonst bleibt der Plan stehen |
| 22 | Grundvorrat bleibt in der PWA (Worker `/vorrat`), keine eigene Bring!-Liste «Vorrat» | Bring! kennt kein «nur lesen»; eine geteilte Vorrat-Liste bräuchte einen Cron-Abgleich mit der Einkaufsliste (gekauft ≠ gelöscht nicht sicher erkennbar), mehr Abhängigkeit von der inoffiziellen API. Idee steht im Plan unter «Später» |
| 23 | PWA in Vanilla JavaScript bleibt, kein Flutter | Link + «Zum Homescreen» statt App Store/TestFlight (iPhone bräuchte Mac, Xcode, Apple-Konto); Flutter-Web ist schwer und zeichnet auf Leinwand; kompletter Neubau inkl. Tests. Neu prüfen nur bei App Store, Homescreen-Widgets oder wenn JS unübersichtlich wird |
| 24 | WG-Server kommt mit dem Release-Tag (nach grünen Tests), vor der App | Kein ungetesteter Server mehr von Hand; Server zuerst, damit die neue App ihn schon findet. Rückweg: `wrangler rollback` |
| 25 | Tägliche Sicherung der WG-Daten im Worker selbst (KV `backup:<Tag>`, 30 Tage) | Schützt vor kaputtem Überschreiben durch einen App-Fehler; bleibt in Cloudflare, nichts landet im öffentlichen Repo |
| 26 | Grundvorrat neu nach **Variante C** des Entwurfs (`docs/design/grundvorrat-varianten.html`): Mengen pro Artikel, Knappes und Abbuchen vorne beim Einkauf, ein Grundvorrat statt Vorrat + Verwalten, nichts geht ungefragt auf Bring! | Von Joshua am 11.11.2026 im Entwurf gewählt («wir nehmen C»). 12.11.: «man kann es mal umsetzen, dann teste ich» → erste Fassung gebaut (Test-Version), Annahmen in `docs/uebergabe-umbau.md` Abschnitt 4. Ersetzt #16 (Pillen) und die Regel «Antippen = direkt auf Bring!» |
