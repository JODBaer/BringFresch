// Auto-Release: kleine Fixes gehen ohne Freigabe raus, neue Funktionen warten (tools/release_decide.mjs)
import { decide, isFeature } from "../tools/release_decide.mjs";

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

check(decide("v1.13.2", []).action === "none", "nichts Neues -> kein Release");
let d = decide("v1.13.2", ["fix(plan): halbe Zwiebel (#5)", "docs: Teststrategie", "test(ui): Kernabläufe"]);
check(d.action === "patch" && d.tag === "v1.13.3", "nur Fixes/Doku/Tests -> v1.13.3 automatisch");
d = decide("v1.13.2", ["fix(plan): x (#5)", "feat(nav): Plan-Symbol (#3)"]);
check(d.action === "wait" && !d.tag, "eine neue Funktion dabei -> wartet auf Freigabe, auch der Fix");
check(isFeature("feat: x") && isFeature("feat(stage): y (#4)") && isFeature("fix!: Format geändert") && !isFeature("fix(feat): nur Name"), "feat, «!» und BREAKING zählen als neue Funktion");
check(decide("v1.13.9", ["chore: Cache"]).tag === "v1.13.10", "Zählen über 9 hinaus (v1.13.10)");
check(decide("", ["fix: erster"]).tag === "v0.0.1", "ohne Tag: v0.0.1");
check(decide("v1.13.2", ["Merge remote-tracking branch 'origin/main'"]).action === "none", "nur Merge-Commits -> nichts");

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
