# WG-Server einrichten (Cloudflare Worker)

Einmalig, ca. 15 Minuten. Danach schreibt «Bring! füllen» direkt in eure Bring!-Liste, alle können gemeinsam die Woche wählen und der Kalender-Link funktioniert.

Kostet nichts: Cloudflare Free Plan, keine Kreditkarte.

## 1. Bring!-Bot-Konto anlegen (5 Min.)

Der Worker meldet sich mit E-Mail + Passwort bei Bring! an. Ein eigenes Bot-Konto hält eure privaten (Google-)Logins da raus.

1. Bring!-App → abmelden oder zweites Gerät → **Neues Konto mit E-Mail** (z.B. eine Zweitadresse wie `wg-bot@…`). Ein **Passwort** setzen, nicht «Mit Google anmelden».
2. Mit deinem normalen Bring!-Konto: WG-Liste öffnen → **Teilen** → das Bot-Konto einladen und im Bot-Konto annehmen.
3. Im Bot-Konto die WG-Liste als **Standardliste** wählen (dann muss nichts weiter eingestellt werden).

## 2. Cloudflare-Konto (2 Min.)

1. <https://dash.cloudflare.com/sign-up> → mit E-Mail registrieren, E-Mail bestätigen.

## 3. Worker hochladen (5 Min., im Terminal im Projektordner)

```bash
cd worker
npx wrangler login                        # öffnet den Browser, «Allow» klicken
npx wrangler kv namespace create WG       # gibt eine id aus
```

Die ausgegebene `id` in `worker/wrangler.toml` bei `id = "REPLACE_WITH_KV_ID"` eintragen. Dann die vier Geheimnisse setzen (jeweils eintippen, wird nicht angezeigt):

```bash
npx wrangler secret put BRING_EMAIL       # E-Mail des Bot-Kontos
npx wrangler secret put BRING_PASSWORD    # Passwort des Bot-Kontos
npx wrangler secret put WG_PIN            # z.B. 4-6 Ziffern, bekommen alle in der WG
npx wrangler secret put CAL_TOKEN         # langer Zufallstext, z.B. 32 Zeichen
npx wrangler deploy                       # gibt die Adresse aus: https://bringfrisch.<name>.workers.dev
```

Kurztest im Browser: `https://bringfrisch.<name>.workers.dev/health` → `{"ok":true}`

## 4. In der App verbinden

App → Tab **WG** → **WG-Server**: Adresse + WG-PIN eingeben → **Verbinden**. Status zeigt «Verbunden ✓».

Den anderen in der WG einfach Adresse und PIN schicken. Tipp: Adresse in `static/app.js` bei `DEFAULT_SYNC_URL` eintragen, dann müssen alle nur noch den PIN eingeben.

**Kalender:** Tab WG → **📅 Kalender abonnieren**. iPhone öffnet direkt das Abo. Google Kalender: Link wird kopiert → calendar.google.com → «Weitere Kalender +» → «Per URL» → einfügen.

## Wenn etwas nicht geht

| Meldung | Lösung |
|---|---|
| «Falscher WG-PIN» | PIN in der App prüfen, oder neu setzen: `npx wrangler secret put WG_PIN` |
| «Bring!-Login abgelehnt» | E-Mail/Passwort des Bot-Kontos neu setzen (Schritt 3). Bot-Konto darf kein Google-Login sein. |
| Artikel landen in der falschen Liste | Im Bot-Konto die WG-Liste als Standard wählen, oder `npx wrangler secret put BRING_LIST_UUID` |
| Verbindungsfehler | `/health` im Browser testen; `npx wrangler deploy` nochmals ausführen |

Logs live ansehen: `npx wrangler tail`

## Hochladen per Release (empfohlen)

Ein Release-Tag (`git tag v1.2.0 && git push origin v1.2.0`) lädt nach grünen Tests zuerst den WG-Server und dann die App hoch (`.github/workflows/deploy-pages.yml`). Dafür braucht GitHub die Secrets `CLOUDFLARE_ACCOUNT_ID` und `CLOUDFLARE_API_TOKEN` (für die Test-Version auch `STAGE_PIN`). Einrichten Schritt für Schritt – du tippst, nichts wird angezeigt oder gespeichert, die Account-ID wird automatisch aus `wrangler whoami` übernommen:

```powershell
powershell -ExecutionPolicy Bypass -File tools\setup-secrets.ps1
```

Kontrolle (nur Namen, nie Werte): `gh secret list`

Fehlt der Token, veröffentlicht der Release nur die App und zeigt eine Warnung. Alte Server-Version zurückholen: `npx wrangler rollback`.

## Sicherung

Jeden Tag um 03:00 UTC (Cron in `wrangler.toml`) speichert der Worker alle WG-Daten (Plan, Wochenwahl, Vorrat, Listenwahl, Bot-Merkliste) als `backup:<Tag>`. Jede Sicherung läuft nach 30 Tagen ab.

- Ansehen: `GET /backup` (Tage) und `GET /backup/2026-11-10` (Inhalt), beide mit `X-WG-PIN`
- Zurückholen, z.B. nur den Vorrat:
  ```bash
  npx wrangler kv key get backup:2026-11-10 --binding WG --remote > b.json
  node -e "const b=require('./b.json');process.stdout.write(b.keys.vorrat)" > v.json
  npx wrangler kv key put vorrat --path v.json --binding WG --remote
  ```

## Entwicklung

```bash
node test.mjs          # Offline-Test (Bring! und Speicher simuliert)
npx wrangler dev       # lokal starten
```

Hinweis: Die Bring!-Schnittstelle ist inoffiziell (wie bei python-bring-api / Home Assistant). Falls Bring! sie ändert, funktioniert «Bring! füllen» weiterhin über Teilen/Kopieren.
