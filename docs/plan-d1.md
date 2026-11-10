# Vorbereitung: SQLite (Cloudflare D1), mehrere WGs, geteilte Rezepte

Stand: Entwurf, **noch nicht gebaut**. Heute läuft alles für eine WG im Key-Value-Speicher (KV). Dieses Dokument beschreibt den Umbau, damit er ohne Überraschungen in kleinen Schritten gehen kann.

## Warum

| Heute (KV) | Mit D1 (SQLite) |
|---|---|
| ein Speicher = eine WG | viele WGs, sauber getrennt über `wg_id` |
| ganze Dokumente überschreiben («neuerer Stand gewinnt» pro Dokument) | einzelne Zeilen ändern (eine Stimme, ein Tag, ein Rezept) |
| eigene Rezepte reisen als grosses JSON in `/settings` | Rezepte als Tabelle: privat für die WG oder für alle WGs geteilt |
| Suchen/Filtern nur in der App | `SELECT … WHERE` im Worker (z.B. geteilte Saison-Rezepte) |

Kosten: D1 Free reicht (5 GB, 5 Mio. Lesezugriffe/Tag, 100 000 Schreibzugriffe/Tag).

## Datenmodell

Schema: [`worker/schema.sql`](../worker/schema.sql). Kurz:

- **`wg`**: eine Zeile pro WG. Kurzname (`slug`, z.B. `hottingen`), PIN nur als Hash, Kalender-Token, gewählte Bring!-Liste, Znacht-Zeit.
- **`member`**: Mitbewohner pro WG (Name, Kürzel, Ernährung, Reihenfolge).
- **`recipe`**: alle Rezepte.
  - `owner_wg` leer = Katalog (heute `standalone_data.js` und `recipes_imported.js`)
  - `visibility = 'wg'`: nur die eigene WG
  - `visibility = 'shared'`: für alle WGs sichtbar
- **`wg_recipe`**: was eine WG mit einem Rezept macht (Favorit, ausgeblendet, eigene Personenzahl), ohne das Rezept zu kopieren.
- **`plan_day`**: eine Zeile pro WG, Woche und Tag.
- **`vote`**: Wochenwahl.
  - Kandidaten pro WG und Woche (`vote_candidate`)
  - Stimmen pro Person (`vote_like`)
- **`staple`**: Grundvorrat pro WG.
- **`bot_item`**: was der Bot auf die Bring!-Liste gesetzt hat (heute `bot:<liste>`).
- **`recipe_site`**: Rezept-Webseiten zum Stöbern pro WG.

## WGs trennen

- **Wer gehört zu welcher WG?** Die App kennt `wg` (Kurzname) und PIN. Der Header `X-WG-PIN` bleibt, dazu kommt `X-WG` (Kurzname).
- **Prüfung im Worker:** Aus Kurzname und PIN wird die `wg_id`. Jede Abfrage enthält `WHERE wg_id = ?`, auch im Code durch eine kleine Hilfsfunktion `db(wg)` erzwungen.
- **PIN:** nur als `PBKDF2`-Hash mit Salz gespeichert, nie im Klartext. Falsche PINs werden gezählt und kurz gesperrt.
- **Bring!:** ein Bot-Konto für alle. Jede WG teilt ihre Liste mit dem Bot und wählt sie in den Einstellungen (`wg.bring_list`). Der Test-Server bleibt auf «Home» festgenagelt.
- **Kalender:** `/cal/<token>.ics`, der Token gehört zu genau einer WG.
- **Neue WG:** vorerst von Hand (`wrangler d1 execute` mit einem Skript, das nach Name und PIN fragt). Eine Registrierung in der App kommt erst, wenn es wirklich andere WGs gibt.

## Geteilte Rezepte

- **Eigenes Rezept:** «Für alle WGs teilen» ist ein Schalter beim Speichern, standardmässig aus.
- **Geteilt:** nur Fakten (Titel, Zutaten, Mengen, Personen, Saison, Link). Kein kopierter Text von fremden Seiten, wie beim Import heute.
- **Andere WGs:** Sie sehen geteilte Rezepte im Katalog unter «Von anderen WGs». Übernehmen bedeutet einen Eintrag in `wg_recipe`, keine Kopie. Ändern erstellt eine eigene Kopie, wie heute «Anpassen».
- **Löschen:** Die Besitzer-WG kann löschen. Bei anderen bleibt das Rezept im Plan, weil die Plan-Tage die Zutaten bereits enthalten.

## API (Entwurf)

Die heutigen Endpunkte bleiben gleich, damit die App nur wenig ändern muss. Neu:

| Endpunkt | Zweck |
|---|---|
| `GET /recipes?scope=wg\|shared\|all&month=11` | Rezepte der WG plus geteilte |
| `PUT /recipes/:id` | eigenes Rezept speichern (inkl. `visibility`) |
| `DELETE /recipes/:id` | nur Besitzer-WG |
| `PUT /wg-recipes/:id` | Favorit, ausgeblendet, eigene Personenzahl |
| `GET/PUT /members` | ersetzt `members` in `/settings` |

## Umbau in Schritten (jeder Schritt einzeln releasbar)

1. **D1 anlegen und Schema einspielen:**
   - `npx wrangler d1 create bringfrisch`
   - Binding `DB` in `wrangler.toml` eintragen
   - `npx wrangler d1 execute bringfrisch --remote --file worker/schema.sql`
2. **Daten übernehmen:** `worker/migrate_kv_to_d1.mjs` (noch zu schreiben) liest alle KV-Schlüssel und legt sie unter WG `default` ab.
   - Die tägliche KV-Sicherung (`backup:<Tag>`) bleibt bis zum Schluss als Rückweg.
3. **Doppelt schreiben:** Der Worker schreibt in KV **und** D1 und liest weiter aus KV. Die Tests vergleichen beide Ergebnisse.
4. **Lesen aus D1:** Der Worker liest neu aus D1; KV ist nur noch die Sicherung.
5. **Rezepte:** «Meine Rezepte» und der Katalog kommen aus `/recipes`; der Schalter «Für alle WGs teilen» wird eingeführt.
6. **Mehrere WGs:** Kurzname in den Einstellungen, eine zweite Test-WG auf dem Test-Server, Tests für die Trennung (WG A sieht nichts von WG B).
7. **KV aufräumen:** erst wenn D1 vier Wochen stabil läuft.

## Tests, die dazukommen

- **Worker offline:** D1 im Test als echtes SQLite (`node:sqlite` ab Node 22.5), gleiches Schema-File.
- **Trennung:** WG A und WG B mit gleichen Rezeptnamen, gleichen Personen-IDs und gleicher Woche. Keine Abfrage darf über die WG-Grenze lesen oder schreiben.
- **Geteilt:** WG A teilt ein Rezept, WG B sieht es und übernimmt es. Ändert WG B etwas, entsteht eine Kopie. Löscht WG A, bleibt der Plan von WG B intakt.
- **UI-Test:** zwei WGs in zwei Browser-Profilen.

## Offene Fragen (Joshua)

- Wer darf eine neue WG anlegen: nur du, oder jede Person mit Link?
- Sollen geteilte Rezepte mit dem WG-Namen («von WG Hottingen») oder anonym erscheinen?
- Soll ein Rezept auch zwischen nur zwei WGs geteilt werden können (befreundete WGs), oder genügt «alle»?

Grundsatz aus CLAUDE.md bleibt: **erst Praxistest mit der eigenen WG**, dann bauen. Bis dahin ändert dieses Dokument nichts am laufenden System.
