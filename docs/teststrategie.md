# Teststrategie (Pareto / Lean Six Sigma, Joshua 19.11.2026)

Auswertung mit Zahlen: https://claude.ai/artifact/44ChvAA9KKwmdvhe7xeok6 (letzte 100 CI-Läufe, Stand 19.11.2026).

## Befund (Measure / Analyze)

- Ein ganzer Lauf dauert ca. 8 Min. **Layout (229 s) und UI-Test (149 s) = 79 %** der Zeit, 2 von 13 Schritten.
- Layout war in 100 Läufen **nie** rot. UI-Test: **10 von 12** roten Läufen, davon ca. 3 echte App-Fehler und ca. 7 veraltete Tests.
- Die teuren Fehler (Bot löscht Fremdes auf Bring!, Abgleich überschreibt, falsche Einkaufsliste, kaputter Release)
  fangen die schnellen Tests ab: Regeln, Zutaten, Einkaufsliste, Integration, Abgleich, Worker, Release-Build (< 2 Min).

## Ablauf (Improve)

| Stufe | Wann | Was | Dauer |
|---|---|---|---|
| 1 PR-Prüfung | jeder PR (`ci.yml`, `npm run ci -- --pr`) | alle schnellen Tests; `static/` oder `worker/src/` geändert → UI-Kernabläufe (`ui_e2e.mjs --core`: Handy B verbunden + D Erster Start); CSS/`index.html`/Plan geändert → Layout 375×667 hell (`layout_check.mjs --quick`) | ca. 2 Min |
| Test-App | nach dem Merge (`stage.yml`) | Test-Version neu (ca. 1 Min) + Live-Test gegen Bring! «Home-test» | ca. 1 Min |
| 2 Release-Prüfung | vor jedem Release (`deploy-pages.yml`, `npm run ci`) | alles: alle UI-Abläufe, Layout in 3 Grössen, hell/dunkel | ca. 8 Min |
| 3 Mensch | nur bei `feat` | Joshua prüft in der Test-App, TEST-Band → Freigeben | – |

**Release-Regel** (`tools/release_decide.mjs`, `release-auto.yml`): Nach jedem Merge auf main:
- nur `fix`/`docs`/`test`/`chore`/`ci`/… seit dem letzten Tag → Release-Prüfung, WG-Server, WG-App, danach Tag **v…+0.0.1**, ohne Freigabe
- mindestens ein `feat` (oder `!`/BREAKING) → wartet; Freigabe in der Test-App setzt **v…+0.1.0** (`worker/src/freigabe.js`). Ein Fix wartet mit, damit nichts Ungeprüftes zur WG geht.
- PR-Titel bestimmen den Typ (Squash-Merge) – darum PR-Titel immer mit Typ beginnen: `fix(plan): …`, `feat(nav): …`.

## Regeln für Tests (gegen Nacharbeit)

- UI-Schritte prüfen **Ergebnisse** (was auf Bring! steht, was im Plan steht), nicht Klickwege oder Zwischenzustände.
- Neue Funktion → neuer Schritt in `ui_e2e.mjs`; gehört er zu Bring!/Abgleich/Vorrat/Erster Start, dann bei Handy B oder D (läuft in jeder PR-Prüfung).
- Browser-Schritte werden bei Rot einmal wiederholt; das steht als «wiederholt» in der Zusammenfassung. Wackelt ein Schritt öfter, wird er repariert, nicht weiter wiederholt.

## Kennzahlen (Control)

Jeder Lauf schreibt Sekunden pro Schritt und Wiederholungen in die Zusammenfassung (GitHub: Seite des Laufs).

| Kennzahl | 19.11. | Ziel |
|---|---|---|
| Dauer PR-Prüfung | 8:00 | < 3:00 |
| rote UI-Läufe, die nur den Test betrafen | ca. 70 % | < 20 % |
| Fehler, die erst die WG findet (Issues aus «Problem melden» nach Release) | – | 0 / Monat bei Bring! und Abgleich |
| wiederholte Browser-Schritte | nicht gezählt | < 5 % |

Offen: Abgleich, Integration und App (jsdom) brauchen je ca. 30 s – vermutlich echte Wartezeiten statt vorgestellter Uhr.
