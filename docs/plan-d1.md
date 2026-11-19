# Vorbereitung: SQLite (Cloudflare D1 & `node:sqlite`), mehrere WGs, geteilte Rezepte

Stand: Entwurf, **noch nicht gebaut**. Heute läuft alles im Key-Value-Speicher (KV) – inklusive mehrerer WGs (`w:<slug>:…`) und geteilter Rezepte (`shared:<slug>`). Dieses Dokument beschreibt den Umbau auf SQLite (sowohl **Cloudflare D1** als auch **Node.js `node:sqlite`** für eigenen Host / Offline-Tests), damit er ohne Überraschungen in kleinen Schritten gehen kann.

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

### Nährwerte (19.11.2026, heute schon in KV/JSON gebaut)

- `recipe.kcal`, `protein_g`, `fat_g`, `carbs_g`: **nur** Angaben der Rezeptseite (schema.org, pro Portion). Heute als `nutrition` im Rezept-JSON (Katalog `recipes_imported.js`, eigene/geteilte Rezepte in `/settings` bzw. `shared:<wg>`).
- Geschätzte Werte werden nie gespeichert – `CORE.nutritionFor` rechnet sie aus den Zutaten (gleiche Datei in App und Worker). Abgeleitete Daten in der Datenbank veralten, sobald jemand eine Zutat ändert.
- `member.goal` (`kcal` | `protein`): worauf jemand achtet; heute Feld im Mitbewohner-Objekt in `/settings`.
- Umzug: 1:1 aus dem JSON übernehmbar, keine Sonderlogik nötig.

## WGs trennen

- **Wer gehört zu welcher WG?** Die App kennt `wg` (Kurzname) und PIN. Der Header `X-WG-PIN` bleibt, dazu kommt `X-WG` (Kurzname).
- **Prüfung im Worker:** Aus Kurzname und PIN wird die `wg_id`. Jede Abfrage enthält `WHERE wg_id = ?`, auch im Code durch eine kleine Hilfsfunktion `db(wg)` erzwungen.
- **PIN:** nur als `PBKDF2`-Hash mit Salz gespeichert, nie im Klartext. Falsche PINs werden gezählt und kurz gesperrt.
- **Bring!:** ein Bot-Konto für alle. Jede WG teilt ihre Liste mit dem Bot und wählt sie in den Einstellungen (`wg.bring_list`). Der Test-Server bleibt auf «Home» festgenagelt.
- **Kalender:** `/cal/<token>.ics`, der Token gehört zu genau einer WG.
- **Neue WG:** vorerst von Hand (`wrangler d1 execute` mit einem Skript, das nach Name und PIN fragt). Eine Registrierung in der App kommt erst, wenn es wirklich andere WGs gibt.

## Geteilte Rezepte

> **Stand 12.11.2026: ohne D1 gebaut** (KV, `worker/src/geteilt.js`): eigene Rezepte standardmässig für alle WGs geteilt (Joshua: «eigene immer standardmässig shared»), abwählbar pro Rezept. Der Rest dieses Abschnitts ist der ursprüngliche Entwurf.

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

## Plan-Aufgabe: Node.js + `node:sqlite` (Eigener Host ohne Cloudflare)

Ab Node 22.5 ist SQLite direkt in Node.js eingebaut (`import { DatabaseSync } from "node:sqlite"` – null externe Abhängigkeiten). Damit kann der komplette WG-Server auf jedem beliebigen Host (Raspberry Pi, eigener VPS, Fly.io, Railway, lokal im Heimnetz) laufen – in zwei Ausbaustufen:

### Stufe A: Sofortige KV-Brücke auf `node:sqlite` (0 Zeilen Änderung am Worker-Code)
Der bestehende Worker (`worker/src/index.js`) nutzt auf `env.WG` nur 5 Methoden (`get`, `getWithMetadata`, `put`, `delete`, `list`). Ein kleiner Start-Adapter `worker/node_server.mjs` (~60 Zeilen) reicht für den kompletten Eigenbetrieb:
- **SQLite-Tabelle für KV:**
  ```sql
  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value BLOB NOT NULL,
    meta  TEXT,
    exp   INTEGER -- Unix-Sekunden (aus expirationTtl), NULL = unbegrenzt
  );
  CREATE INDEX IF NOT EXISTS kv_exp ON kv (exp) WHERE exp IS NOT NULL;
  ```
- **KV-Adapter (`sqliteKv(dbPfad)`):**
  - `get(k, type)`: liest `WHERE key = ? AND (exp IS NULL OR exp > unixepoch())`, wandelt bei `type === "json"` per `JSON.parse` um, bei `"arrayBuffer"` in `Uint8Array.buffer`.
  - `getWithMetadata(k, type)`: liefert `{ value, metadata: JSON.parse(meta) }` (für den Rezeptbild-Cache `/img`).
  - `put(k, v, opts)`: berechnet `exp = opts?.expirationTtl ? Math.floor(Date.now()/1000) + opts.expirationTtl : null` und speichert per `INSERT OR REPLACE INTO kv`.
  - `delete(k)`: `DELETE FROM kv WHERE key = ?`.
  - `list({ prefix = "" })`: `SELECT key FROM kv WHERE key LIKE ? || '%' AND (exp IS NULL OR exp > unixepoch()) ORDER BY key`.
- **HTTP & Cron (`node:http`):**
  - Nimmt HTTP-Anfragen entgegen, reicht sie als Web-Standard-`Request` an `worker.fetch(req, env)` weiter und liefert optional statische Dateien aus `static/` direkt mit aus.
  - Täglicher Timer (`setInterval`) ruft `worker.scheduled({ scheduledTime: Date.now() }, env)` für `backup:<Tag>` auf und löscht abgelaufene Schlüssel (`DELETE FROM kv WHERE exp <= unixepoch()`).
- **Backup-Import/-Export:** Ein Skript kann einen bestehenden Tages-Snapshot (`GET /backup/:day` von Cloudflare) 1:1 in die lokale `obsonare.sqlite`-Datei einspielen – Umzug von Cloudflare auf eigenen Host in unter 1 Minute.

### Stufe B: Gemeinsamer D1- & `node:sqlite`-Treiber für `worker/schema.sql`
Für den späteren Umbau auf echte SQL-Tabellen (`worker/schema.sql`) bekommt `node:sqlite` einen dünnen D1-kompatiblen Wrapper (`prepare(sql).bind(...).all() / .first() / .run()`), sodass:
1. derselbe Worker-Code unverändert auf **Cloudflare D1** und auf **Node.js (`node:sqlite`)** läuft,
2. `worker/test.mjs` offline gegen eine echte In-Memory-SQLite-Datenbank (`new DatabaseSync(":memory:")`) mit `worker/schema.sql` testet.

## Umbau in Schritten (jeder Schritt einzeln releasbar)

1. **`node:sqlite`-KV-Brücke (`worker/node_server.mjs`) + Offline-Test:**
   - Adapter für `env.WG` auf Basis von `node:sqlite` bauen und in `worker/test.mjs` gegen alle bestehenden Worker-Tests prüfen.
2. **D1 anlegen und Schema einspielen:**
   - `npx wrangler d1 create bringfrisch`
   - Binding `DB` in `wrangler.toml` eintragen
   - `npx wrangler d1 execute bringfrisch --remote --file worker/schema.sql`
3. **Daten übernehmen:** `worker/migrate_kv_to_d1.mjs` (noch zu schreiben) liest alle KV-Schlüssel und legt sie in den SQL-Tabellen (`worker/schema.sql`) ab.
   - Die tägliche KV-Sicherung (`backup:<Tag>`) bleibt bis zum Schluss als Rückweg.
4. **Doppelt schreiben:** Der Worker schreibt in KV **und** SQLite (D1 / `node:sqlite`) und liest weiter aus KV. Die Tests vergleichen beide Ergebnisse.
5. **Lesen aus SQLite (D1 / `node:sqlite`):** Der Worker liest neu aus SQLite; KV ist nur noch die Sicherung.
6. **KV aufräumen:** erst wenn SQLite vier Wochen stabil läuft.

## Tests, die dazukommen

- **Worker offline:** D1 im Test als echtes SQLite (`node:sqlite` ab Node 22.5), gleiches Schema-File.
- **Trennung:** WG A und WG B mit gleichen Rezeptnamen, gleichen Personen-IDs und gleicher Woche. Keine Abfrage darf über die WG-Grenze lesen oder schreiben.
- **Geteilt:** WG A teilt ein Rezept, WG B sieht es und übernimmt es. Ändert WG B etwas, entsteht eine Kopie. Löscht WG A, bleibt der Plan von WG B intakt.
- **UI-Test:** zwei WGs in zwei Browser-Profilen.

## Entscheide (Joshua, 10.11.2026)

- **Neue WG anlegen: nur Joshua**, von Hand per Skript. Keine Registrierung in der App.
- **Eigener Gebrauch:** keine öffentliche Plattform. «Geteilt» heisst: zwischen den WGs, die Joshua selbst anlegt. Darum genügt «für alle WGs»; Freigaben für einzelne WGs und die Herkunftsangabe sind nicht nötig. Geteilte Rezepte zeigen schlicht «geteilt».

Grundsatz aus CLAUDE.md bleibt: **erst Praxistest mit der eigenen WG**, dann bauen. Bis dahin ändert dieses Dokument nichts am laufenden System.
