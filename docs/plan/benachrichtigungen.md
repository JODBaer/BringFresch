# Plan: Benachrichtigungen (Push)

> Stand 19.11.2026: **gebaut** nach Entscheid Joshua. Entwurf: `docs/design/benachrichtigungen-entwurf.html`.
> Entscheide: (1) Zeitpunkt der Markt-Erinnerung **auswählbar** (Vorabend / vor Öffnung / fest). (2) Ort aus der Hofläden-Liste,
> **Suche nach Name des Bauern oder Ortschaft**; fehlt er, **selbst eintragen** (Name + Tag). (3) Anstupsen 1× pro Tag, Ruhezeit 21–8: **ja**.
> (4) «Alle haben gewählt» zusätzlich: **ja**. Abweichung vom Plan: ein Cron alle 15 Min. statt stündlich (Uhrzeiten wie 7:30 genauer),
> Abo löschen über `POST /push/off` statt DELETE. Damit es live geht: VAPID-Secrets setzen (worker/README.md).

## Wunsch (Joshua 19.11.)

1. **Wochenwahl**: Hat jemand für die Woche gewählt, bekommen **alle anderen** in der WG eine Meldung («Leonie hat für KW 48 gewählt»).
2. **Anstupsen**: In der Wochenwahl lassen sich die, die noch nicht gewählt haben, per Meldung anstupsen.
3. **Bauer / Markt**: Erinnerung, beim Bauern nebenan die Bring!-Liste abzuarbeiten oder beim Markt vorbeizugehen. **Beides** (nach Zeit und nach Ort), aber **nur einmal pro Woche**, nicht täglich.

## Was technisch geht

- **Web Push** aus der PWA, verschickt vom eigenen Worker (kein fremder Dienst, kein Konto). Android (Chrome) geht direkt. **iPhone nur, wenn Obsonare auf dem Home-Bildschirm liegt** (iOS ≥ 16.4); im Safari-Tab gibt es keine Meldungen. Die App erklärt das an der Stelle, wo man Meldungen einschaltet.
- **Nach Ort** kann eine Web-App nicht: kein Standort im Hintergrund, keine Geofences. Deshalb:
  - **Nach Zeit** (in Obsonare): einmal pro Woche, an einem gewählten Markt/Hofladen (aus den Lieblingen der Hofläden-Liste, `favMarkets`) oder an einem festen Tag mit eigenem Namen («Bauer nebenan»). Nur wenn auf Bring! etwas steht.
  - **Nach Ort** (iPhone-Kurzbefehl, Anleitung in der App): Automation «Ankommen bei …» ruft eine Adresse von Obsonare ab. Der Worker antwortet **höchstens einmal pro Woche** und nur, wenn auf Bring! etwas steht, mit einem Text; sonst leer, dann zeigt der Kurzbefehl nichts. So bleibt es «einmal pro Woche», obwohl man täglich am Hof vorbeigeht. Android: kein gleichwertiger Weg ohne Zusatz-App, darum nur Zeit.

## Meldungen

| Anlass | An wen | Text (Beispiel) | Tippen öffnet |
|---|---|---|---|
| Jemand hat gewählt | alle anderen mit Schalter «Jemand hat gewählt» | «Leonie hat für KW 48 gewählt» · «Noch offen: Lukas, Jo» | Wochenwahl |
| Letzte Stimme | alle | «Alle haben gewählt» · «Plan für KW 48 übernehmen» | Wochenwahl |
| Anstupsen | die Ausgewählten ohne Stimme | «Joshua stupst dich an 👋» · «Die Wochenwahl für KW 48 wartet noch auf dich» | Wochenwahl |
| Markt (Zeit) | wer es auf seinem Handy eingeschaltet hat | «Heute Markt Robenhausen 8–11» · «6 Sachen auf Bring!: Lauch, Rüebli, Eier …» | Einkauf «Auf Bring!» |
| Hof (Ort, Kurzbefehl) | nur dieses iPhone | «Bring!-Liste: 6 Sachen» · «Lauch, Rüebli, Eier …» | (Kurzbefehl) Bring! |

Regeln (Vorschlag, Joshua entscheidet im Entwurf):
- Eine Stimme ändern (zweites Speichern) löst keine neue Meldung aus: pro Person und Woche nur die erste.
- Anstupsen: pro Person **höchstens 1× pro Tag** (egal von wem), Knopf zeigt danach «wieder ab morgen».
- **Ruhezeit 21:00–8:00**: Wahl-Meldungen und Anstupser warten bis 8:00 (Markt-Erinnerung liegt sowieso tagsüber).
- Markt-Erinnerung: **1× pro Kalenderwoche** pro Handy, nur wenn Bring! nicht leer ist und der Ort laut Öffnungszeiten wirklich offen hat (Winterpause → keine Meldung).

## Bau (wenn freigegeben)

**Schlüssel**: `node tools/vapid.mjs` erzeugt ein VAPID-Schlüsselpaar. Öffentlicher Schlüssel als Konstante in `app.js` (Build-Skripte ersetzen ihn für die Test-Version), privater als Worker-Secret `VAPID_PRIVATE` (WG und Test getrennt).

**Worker** (`worker/src/push.js`, neu, ohne Abhängigkeiten):
- Verschlüsselung RFC 8291 (`aes128gcm`) + VAPID-JWT RFC 8292 (ES256) mit WebCrypto.
- `PUT /push/:member` `{ sub, prefs }` · `DELETE /push/:member/:id` – Abo pro Handy, KV `push:<wg>` (Liste; WG mit Präfix wie gewohnt). Abos mit Antwort 404/410 werden gelöscht.
- `PUT /week/:week/vote/:member` (gibt es) → nach dem Speichern `ctx.waitUntil(notifyVote(...))`; Merker `week:<w>:notified:<member>` gegen doppelte Meldungen.
- `POST /week/:week/nudge` `{ from, to:[...] }` → Sperre `nudge:<w>:<member>` (TTL bis Mitternacht).
- `GET /erinnerung/:token` (Kurzbefehl): Token pro Handy wie beim iCal-Abo, ohne PIN. Antwort Text oder leer; Merker `remind:<token>:<KW>`.
- **Zeitplan**: Statt eines zweiten Crons den bestehenden auf **stündlich** stellen (`7 * * * *`); Sicherung nur um 3 Uhr Zürcher Zeit. Pro Stunde: Markt-Erinnerungen fällig? (nur lesen; geschrieben wird nur beim Senden → KV-Schreibgrenze im Gratis-Tarif bleibt weit weg). Ruhezeit-Warteschlange leeren.
- Bring!-Inhalt für die Texte: wie `/bring/list` über den Bot.

**App**:
- `sw.js`: `push` (Meldung zeigen) und `notificationclick` (App öffnen bzw. fokussieren, Ziel per `#wahl` / `#einkauf`). `CACHE_NAME` hoch.
- `app_einstellungen.js`: Karte «Benachrichtigungen» (pro Handy): Einschalten (Erlaubnis nur auf Knopfdruck), Schalter, Markt-Erinnerung, Kurzbefehl-Anleitung. iPhone ohne Home-Bildschirm: Hinweis statt Schalter.
- `app_wahl.js`: Zeile «Gewählt / offen» mit Knopf «Anstupsen».
- `store.js`: `bringfrisch_push` (Abo-Id, Schalter, Markt-Wahl, Kurzbefehl-Token) – nur dieses Handy.
- Regeln nach `core.js`: `marketReminderDue(pref, now, hours)`, `quietUntil(now)`, `voteNotifyText(...)` – direkt in Node testbar.
- `rechtliches.html`: Absatz Push (Adresse des Push-Dienstes von Apple/Google/Mozilla liegt im Worker, nur für die Meldungen, Löschen = Ausschalten).

**Tests**: `core.test.mjs` (Fälligkeit, Winterpause, Ruhezeit, 1× pro Woche), Worker-Test (Stimme → alle ausser mir, zweite Stimme → nichts, Anstupsen-Sperre, Kurzbefehl leer bei leerer Liste/zweitem Abruf, 410 löscht Abo, Verschlüsselung gegen Node-`crypto` entschlüsselt), `ui_e2e.mjs`-Schritt (Karte Benachrichtigungen, Anstupsen-Knopf; `PushManager` nachgebaut). Live-Test einer echten Meldung nur von Hand.

## Offene Fragen an Joshua

Stehen auch im Entwurf (rechte Spalte):
1. Markt-Erinnerung: **am Vorabend** (z.B. Fr 19:00 «Morgen Markt …») oder **kurz vor der Öffnung** oder **fester Zeitpunkt**?
2. Welcher **Bauer nebenan**? Steht er in der Hofläden-Liste (Name), oder ein eigener Eintrag mit festem Tag?
3. Anstupsen 1× pro Tag und Ruhezeit 21–8 so recht?
4. «Alle haben gewählt» zusätzlich zur Meldung pro Stimme – ja/nein?
