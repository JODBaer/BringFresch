# Umzug BringFrisch → Obsonare

Stand 14.11.2026. Der Name in der App ist umgestellt (v2.0.0), ebenso die Speicher auf dem Handy
(`bringfrisch_…` → `obsonare_…`, alte Daten werden beim ersten Start übernommen, `static/store.js`)
und der Cache des Service Workers. Was noch fehlt, sind die **Adressen**. Sie brauchen Zugangsdaten
oder GitHub-Einstellungen, die nur Joshua setzen kann. Reihenfolge einhalten, sonst ist die WG kurz ohne Server.

## 1. WG-Server: neuer Worker «obsonare»

Adresse danach: `https://obsonare.bringfrisch-worker.workers.dev`.
«bringfrisch-worker» ist der Name des Cloudflare-Kontos. Den nicht ändern: sonst sind sofort alle alten
Adressen weg (alte Handys, Kalender-Abos, Test-Version).

1. In `worker/wrangler.toml` `name = "obsonare"` setzen (KV-`id` bleibt gleich → **gleiche Daten**).
2. Zugangsdaten für den neuen Worker setzen, **mit denselben Werten wie bisher** (gleicher `WG_PIN`,
   gleicher `CAL_TOKEN`, damit PIN und Kalender-Links gleich bleiben):
   `powershell -ExecutionPolicy Bypass -File tools\setup-secrets.ps1`
   (oder einzeln: `cd worker && npx wrangler secret put BRING_EMAIL`, `BRING_PASSWORD`, `WG_PIN`, `CAL_TOKEN`, ggf. `BRING_LIST_UUID`).
3. `cd worker && npx wrangler deploy`, dann `https://obsonare.bringfrisch-worker.workers.dev/health` prüfen.
4. Im Code (Claude macht das): `DEFAULT_SYNC_URL` in `static/app.js` auf die neue Adresse, Health-Check in
   `.github/workflows/deploy-pages.yml`, `tests/ui_e2e.mjs`, `tools/new_wg.mjs`, README. Die App biegt gespeicherte
   alte Adressen automatisch auf die neue um (`OLD_SERVER` in `static/app_sync.js`). Danach Release.
5. Den alten Worker «bringfrisch» **laufen lassen**: Handys, die noch nicht aktualisiert haben, und die
   Kalender-Abos (`…/cal/<token>.ics`) zeigen noch dorthin. Er arbeitet auf denselben Daten. Wer das Abo neu
   einrichtet (App → «Mehr»), bekommt die neue Adresse. Frühestens nach ein paar Wochen in Cloudflare löschen.

## 2. Test-Version: «obsonare-test»

1. `worker/wrangler.toml` `[env.stage] name = "obsonare-test"`.
2. Zugangsdaten: `powershell -ExecutionPolicy Bypass -File worker\setup-stage.ps1`.
3. Im Code: `TEST_URL` (`static/app.js`), `STAGE_WORKER` (`tools/build_stage.mjs`), `tests/stage_live.mjs`,
   `worker/test.mjs`, README. Die CORS-Freigabe für die neue Test-Seite ist schon drin (`worker/src/http.js`).
4. Den alten Worker «bringfrisch-test» danach in Cloudflare löschen (nur Test-Daten).

## 3. GitHub-Repo «Obsonare» (App-Adresse)

App-Adresse danach: `https://jodbaer.github.io/Obsonare/`. Die Daten auf den Handys bleiben, weil die Domain
(`jodbaer.github.io`) gleich bleibt. GitHub leitet nach dem Umbenennen Repo-Links weiter, **GitHub Pages aber nicht**:
Die Icons auf dem Home-Bildschirm zeigen auf `/BringFresch/static/` und würden ins Leere gehen.

1. GitHub → Repo → Settings → Repository name: `Obsonare`.
2. Sofort danach ein neues, öffentliches Repo **«BringFresch»** mit GitHub Pages anlegen, das nur weiterleitet
   (Dateien `index.html` und `static/index.html`, beide gleich):
   ```html
   <!doctype html><meta charset="utf-8"><title>Obsonare</title>
   <script>location.replace("https://jodbaer.github.io/Obsonare/static/" + location.search + location.hash)</script>
   <a href="https://jodbaer.github.io/Obsonare/static/">Obsonare ist umgezogen – hier weiter</a>
   ```
3. Im Code: `REPO_URL`/`LIVE_URL` (`static/app.js`), README, CLAUDE.md, Tests (`url:` der jsdom-Tests, `e2e_live`,
   `check_live`), `tools/setup-secrets.ps1` (`$Repo`). Danach Release.
4. Auf jedem Handy die App einmal über die neue Adresse öffnen und neu «Zum Home-Bildschirm» hinzufügen;
   das alte Icon funktioniert über die Weiterleitung weiter.
