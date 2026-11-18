# Übergabe: Obsonare 2.0.0 – Umbau

Stand 18.11.2026. Startsatz von Joshua: **«nun auf Obsonare 2.0.0 Umbau starten»**. Dann diese Datei lesen,
danach `CLAUDE.md`, `docs/uebergabe-v2.md` (Abschnitt «Entscheide Joshua 16.11.») und `docs/umzug-obsonare.md`.
Der Chat «BringFresh zu Obsonare Umbenennung», der das angefangen hat, ist archiviert. Alles Nötige steht hier.

## Was zu v2.0.0 gehört (Entscheid Joshua 16.11.)

1. **Speicher-Umzug auf dem Handy** `bringfrisch_*` → `obsonare_*` und Cache `obsonare-cache-*`.
2. **Hofläden & Märkte**: Der Chat «Bauernhof-Verkauf und Märkte» arbeitet daran (Zweig `ccr-c75d431f-nkpfcv`).
   Das wird **nicht** hier gebaut. Erst übernehmen, wenn jener Chat sagt, dass er fertig und getestet ist.
3. **Schriftzug oben**: «Obsonare» muss hinein (`static/index.html`, `.brand`). Joshua entscheidet die Gestaltung selbst:
   2–3 Varianten als HTML-Entwurf zeigen, nicht einfach einbauen.
4. **Adressen** (Worker «obsonare», Repo «Obsonare»): `docs/umzug-obsonare.md`. Dafür braucht es Cloudflare- und
   GitHub-Einstellungen, die nur Joshua setzen kann. Mit ihm Schritt für Schritt machen, Reihenfolge einhalten.
   Das muss nicht im selben Release wie Punkt 1 kommen.

## Vorarbeit: Zweig `ccr-315f8b43-5aq49r`

Commit `2d250a0` (14.11.) «Speicher und Cache umbenannt, Umzug der Adressen vorbereitet», 21 Dateien:
- `static/store.js`: alle Schlüssel `obsonare_*`; alte `bringfrisch_*`-Daten werden beim ersten Start übernommen
  (sofort beim Laden), Altlasten weiter entfernt; Test dazu in `tests/app.test.js`.
- `static/sw.js`: Cache `obsonare-cache-*`, alte Caches räumt der Service Worker weg.
- `static/app_sync.js`: `OLD_SERVER` biegt gespeicherte alte Server-Adressen auf `DEFAULT_SYNC_URL` um
  (beim Umzug ist das dann eine Zeile).
- `worker/src/http.js`: CORS für die künftige Test-Seite `obsonare-test`.
- Tests und Tools auf die neuen Schlüssel angepasst.

**Achtung:** Der Zweig ist 4 Tage alt, auf `main` sind seither ~80 Commits dazugekommen (neue Schlüssel in
`store.js`, z.B. `bringfrisch_shop_sort`, `favMarkets`, Cache v77). Ein Probe-Merge gibt Konflikte in
`CLAUDE.md`, `static/store.js` und `static/sw.js`. **Darum nicht blind mergen.** Den Zweig als Vorlage nehmen
und den Umzug auf dem heutigen `main` neu machen:

1. Eigenen Worktree ab `origin/main` (`CLAUDE.md`, mehrere Chats).
2. `git show 2d250a0` lesen. Danach jeden heutigen Schlüssel in `static/store.js` umstellen, nicht nur die vom 14.11.
   Die Übernahme alter Daten muss **alle** `bringfrisch_*`-Schlüssel abdecken, auch die gemeinsamen
   (Plan, Vorrat, Einstellungen, `bringfrisch_base_*` des Abgleichs). Sonst verliert ein Handy seinen Abgleich-Stand.
3. `grep -rn bringfrisch_ static tests tools worker` muss danach nur noch die Übernahme-Liste in `store.js` finden.
4. Test: Handy mit altem Stand (nur `bringfrisch_*` gesetzt) → nach dem Start ist alles unter `obsonare_*` da,
   PIN/«Ich bin»/Plan/Vorrat gleich, kein 409-Durcheinander beim ersten Abgleich (`tests/sync_merge.test.mjs`).
5. `CLAUDE.md` und die Doku nachführen (Schlüsselnamen), `CACHE_NAME` hochzählen, `npm run ci` grün.
6. Auf `main`, Joshua testet auf der Test-Version. **Release v2.0.0 erst, wenn Joshua es sagt**
   (Ablauf: `docs/uebergabe-v2.md` → «Release machen»). Text für die WG dort ergänzen.
7. Danach kann der Zweig `ccr-315f8b43-5aq49r` auf GitHub gelöscht werden.

## Nicht ändern
- Den Namen des Cloudflare-Kontos (`bringfrisch-worker`) nicht ändern, sonst sind alle alten Adressen weg.
- Die KV-Daten und die Daten-Schlüssel im Worker (`w:<wg>:…`, `shared:…`, `bot:…`) bleiben, wie sie sind.
  Umbenannt wird nur der Speicher auf dem Handy.
- Den alten Worker «bringfrisch» nach dem Adressen-Umzug weiterlaufen lassen (alte Handys, Kalender-Abos).
