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
| 16 | Grundvorrat-Pillen klein, durchgestrichen, ohne Bild | Von Joshua so gewählt («durchgestrichen ist gutes Design und die Grösse auch») |
| 17 | Neue Rezepte von Hand schreiben statt scrapen | Siehe #10; Fakten + kurze eigene Anleitung |
| 18 | Plan-Ansicht nach eigener Spezifikation: iPhone = Glas, Android = Material 3 Expressive, gleiche Bedienung | Fühlt sich auf beiden Handys «zuhause» an; Vorgabe in `docs/design/` |
| 19 | Schrift Roboto Flex lokal statt von Google Fonts | App bleibt offline und ohne fremde Server (#11) |
| 20 | Mit offenem Tag bleiben alle 7 Tage sichtbar; Dichte nur beim Start/Drehen ändern | Ruhige Ansicht, nichts springt beim Aufklappen |
