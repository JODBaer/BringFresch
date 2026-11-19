// Ein Befehl für alles, was offline und immer gleich läuft (lokal wie in GitHub Actions). Teststrategie: docs/teststrategie.md
//   cd tests && npm run ci                -> ALLES (Release-Prüfung): Syntax, App, 2-Handy-Integration, Worker, Release-Build,
//                                            Layout in 3 Grössen + alle UI-Abläufe im Browser
//   npm run ci -- --pr                    -> PR-Prüfung (ca. 2 Min): alle schnellen Tests; Browser nur, wenn nötig:
//                                            static/ geändert -> UI-Kernabläufe (ui_e2e.mjs --core);
//                                            CSS/index.html/Plan geändert -> Layout in der engsten Grösse (layout_check.mjs --quick)
//                                            Geänderte Dateien: gegen origin/<GITHUB_BASE_REF|main> + nicht Committetes.
//   npm run ci -- --shots                 -> zusätzlich Bildschirmfotos in tests/shots/
//   npm run ci -- --no-layout / --no-ui   -> ohne Layout-Prüfung / ohne UI-Test
// Keine Live-Tests (e2e_live, check_live): die brauchen echte Zugangsdaten.
// Zusammenfassung: pro Schritt Sekunden und Wiederholungen (Kennzahlen für die Teststrategie).
import { spawnSync } from "node:child_process";
import { readdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const args = process.argv.slice(2);
const PR = args.includes("--pr");
const node = process.execPath;
const env = { ...process.env, TZ: process.env.TZ || "Europe/Zurich" };

const jsIn = dir => readdirSync(path.join(root, dir)).filter(f => /\.(m?js)$/.test(f)).map(f => path.join(dir, f));
const syntaxFiles = [...jsIn("static"), ...jsIn("worker/src"), "worker/test.mjs", ...jsIn("tests"), ...jsIn("tools")];

// Welche Dateien hat diese Änderung angefasst? null = unbekannt (dann lieber alles im Browser prüfen)
export function changedFiles() {
  const git = a => { const r = spawnSync("git", a, { cwd: root, encoding: "utf8" }); return r.status === 0 ? r.stdout : null; };
  const base = `origin/${process.env.GITHUB_BASE_REF || "main"}`;
  const diff = git(["diff", "--name-only", `${base}...HEAD`]);
  if (diff == null) return null;
  const local = git(["status", "--porcelain"]) || "";
  return [...new Set([...diff.split("\n"), ...local.split("\n").map(l => l.slice(3))].map(s => s.trim().replace(/\\/g, "/")).filter(Boolean))];
}
// Regeln für die PR-Prüfung (Pareto: Browser kosten 79 % der Zeit, nur laufen lassen, wo sie etwas finden können)
export const needsUi = files => !files || files.some(f => /^static\/|^tests\/ui_e2e\.mjs$|^worker\/src\//.test(f));
export const needsLayout = files => !files || files.some(f => /^static\/(app\.css|index\.html|app\.js|app_plan\.js|app_theme\.js)$|^tests\/layout_check\.mjs$/.test(f));

const results = []; // [name, ok, sekunden, wiederholt]
const failLines = []; // für die Zusammenfassung (lokal und auf der GitHub-Seite des Laufs)
function runOnce(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: here, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : "");
  process.stdout.write(out);
  return { ok: r.status === 0, fails: out.split(/\r?\n/).filter(l => /^FAIL\b|Error:|FEHLER/.test(l)).slice(0, 15) };
}
// retry: Browser-Schritte dürfen einmal wiederholt werden (langsame CI-Maschinen); das wird gezählt und steht sichtbar dabei
function step(name, cmd, cmdArgs, { retry = false } = {}) {
  console.log(`\n=== ${name} ===`);
  const t0 = Date.now();
  let r = runOnce(cmd, cmdArgs), again = false;
  if (!r.ok && retry) {
    again = true;
    failLines.push(`${name} – 1. Versuch rot (wiederholt):`, ...r.fails.map(l => "    " + l));
    console.log(`\n=== ${name} (2. Versuch) ===`);
    r = runOnce(cmd, cmdArgs);
  }
  if (!r.ok) failLines.push(`${name}:`, ...r.fails.map(l => "    " + l));
  results.push([name, r.ok, (Date.now() - t0) / 1000, again]);
}

// 1. Syntax (node --check)
console.log(`=== Syntax (${syntaxFiles.length} Dateien) ===`);
const tSyntax = Date.now();
const bad = syntaxFiles.filter(f => {
  const r = spawnSync(node, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status !== 0) console.log(`FAIL  ${f}\n${r.stderr}`);
  return r.status !== 0;
});
if (!bad.length) console.log(`PASS  ${syntaxFiles.join(", ")}`);
results.push([`Syntax (${syntaxFiles.length} Dateien)`, bad.length === 0, (Date.now() - tSyntax) / 1000, false]);

// 2. Schnelle Tests: immer, auch in der PR-Prüfung (fangen die teuren Fehler: Bring!, Abgleich, Einkaufsliste, Release)
step("Regeln direkt (core.js)", node, ["core.test.mjs"]);
step("Offline-Liste (sw.js) + Skript-Reihenfolge", node, ["assets.test.mjs"]);
step("Architektur-Übersicht (Funktionsnamen, Selektoren)", node, ["architektur.test.mjs"]);
step("App (jsdom)", node, ["app.test.js"]);
step("Zutaten-Abgleich (alle Rezepte)", node, ["zutaten.test.js"]);
step("Einkaufsliste aller Rezepte (fester Stand)", node, ["einkauf_snapshot.test.js"]);
step("Integration (2 Handys + Worker)", node, ["integration.test.mjs"]);
step("Abgleich (gleichzeitige Änderungen, falsche Uhr)", node, ["sync_merge.test.mjs"]);
step("Worker", node, ["../worker/test.mjs"]);
step("Release-Build (wie GitHub Pages)", node, ["release_build.test.mjs"]);
step("Auto-Release-Regel (Fix geht raus, Funktion wartet)", node, ["release_decide.test.mjs"]);

// 3. Browser: vor dem Release alles, in der PR-Prüfung nur, was die Änderung betreffen kann
const shotArg = args.includes("--shots") ? ["--shots"] : [];
const skippedNotes = [];
const files = PR ? changedFiles() : null;
if (PR) console.log(`\nPR-Prüfung: ${files ? `${files.length} geänderte Datei(en)` : "geänderte Dateien unbekannt -> Browser-Tests laufen"}`);
if (!args.includes("--no-layout")) {
  if (!PR) step("Layout (Browser, 3 Grössen)", node, ["layout_check.mjs", ...shotArg], { retry: true });
  else if (needsLayout(files)) step("Layout (Browser, 375×667)", node, ["layout_check.mjs", "--quick", ...shotArg], { retry: true });
  else skippedNotes.push("Layout: kein CSS/HTML/Plan geändert");
}
if (!args.includes("--no-ui")) {
  if (!PR) step("UI wie ein Mensch (Browser, alle Abläufe)", node, ["ui_e2e.mjs", ...shotArg], { retry: true });
  else if (needsUi(files)) step("UI-Kernabläufe (Browser)", node, ["ui_e2e.mjs", "--core", ...shotArg], { retry: true });
  else skippedNotes.push("UI: nichts in static/ oder worker/ geändert");
}

console.log("\n=== Zusammenfassung ===");
for (const [name, ok, s, again] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${s.toFixed(1)} s${again ? "  (wiederholt)" : ""}`);
if (skippedNotes.length) console.log(`(PR-Prüfung übersprungen: ${skippedNotes.join("; ")} – läuft vor dem Release)`);
const failed = results.filter(r => !r[1]).length;
const total = results.reduce((s, r) => s + r[2], 0), retries = results.filter(r => r[3]).length;
console.log(`Dauer ${Math.round(total)} s, wiederholt: ${retries}`);
if (failLines.length) console.log("\nWas rot war:\n" + failLines.join("\n"));
console.log(failed ? `\nFAIL: ${failed} Schritt(e) rot` : "\nPASS: alles grün");
// GitHub Actions: Zusammenfassung erscheint direkt auf der Seite des Laufs (ohne Log zu öffnen)
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [`### Tests (${PR ? "PR-Prüfung" : "Release-Prüfung"})`, "", "| | Schritt | Sek. |", "|---|---|---:|",
    ...results.map(([n, ok, s, again]) => `| ${ok ? "✅" : "❌"} | ${n}${again ? " (wiederholt)" : ""} | ${s.toFixed(1)} |`),
    "", `Dauer **${Math.round(total)} s**, wiederholt: **${retries}**`,
    ...(skippedNotes.length ? ["", `Übersprungen: ${skippedNotes.join("; ")}`] : []),
    ...(failLines.length ? ["", "```", ...failLines, "```"] : []), "", failed ? `**FAIL: ${failed} Schritt(e) rot**` : "**PASS: alles grün**"];
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join("\n") + "\n"); } catch (e) { /* egal */ }
}
process.exit(failed ? 1 : 0);
