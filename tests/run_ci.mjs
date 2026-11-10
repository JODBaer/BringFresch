// Ein Befehl für alles, was offline und immer gleich läuft (lokal wie in GitHub Actions):
//   cd tests && npm run ci                -> Syntax, App, 2-Handy-Integration, Worker, Release-Build, Layout + UI im Browser
//   npm run ci -- --shots                 -> zusätzlich Bildschirmfotos in tests/shots/
//   npm run ci -- --no-layout             -> ohne Layout-Prüfung im Browser
//   npm run ci -- --no-ui                 -> ohne UI-Test (klickt sich durch alle Seiten, ui_e2e.mjs)
// Keine Live-Tests (e2e_live, check_live): die brauchen echte Zugangsdaten.
import { spawnSync } from "node:child_process";
import { readdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const args = process.argv.slice(2);
const node = process.execPath;
const env = { ...process.env, TZ: process.env.TZ || "Europe/Zurich" };

const jsIn = dir => readdirSync(path.join(root, dir)).filter(f => /\.(m?js)$/.test(f)).map(f => path.join(dir, f));
const syntaxFiles = [...jsIn("static"), "worker/src/index.js", "worker/test.mjs", ...jsIn("tests"), ...jsIn("tools")];

const results = [];
const failLines = []; // für die Zusammenfassung (lokal und auf der GitHub-Seite des Laufs)
function runOnce(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: here, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : "");
  process.stdout.write(out);
  return { ok: r.status === 0, fails: out.split(/\r?\n/).filter(l => /^FAIL\b|Error:|FEHLER/.test(l)).slice(0, 15) };
}
// retry: Browser-Schritte dürfen einmal wiederholt werden (langsame CI-Maschinen); das steht dann sichtbar dabei
function step(name, cmd, cmdArgs, { retry = false } = {}) {
  console.log(`\n=== ${name} ===`);
  let r = runOnce(cmd, cmdArgs);
  if (!r.ok && retry) {
    failLines.push(`${name} – 1. Versuch rot (wiederholt):`, ...r.fails.map(l => "    " + l));
    console.log(`\n=== ${name} (2. Versuch) ===`);
    r = runOnce(cmd, cmdArgs);
    if (r.ok) name += " (2. Versuch)";
  }
  if (!r.ok) failLines.push(`${name}:`, ...r.fails.map(l => "    " + l));
  results.push([name, r.ok]);
}

// 1. Syntax (node --check)
console.log(`=== Syntax (${syntaxFiles.length} Dateien) ===`);
const bad = syntaxFiles.filter(f => {
  const r = spawnSync(node, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status !== 0) console.log(`FAIL  ${f}\n${r.stderr}`);
  return r.status !== 0;
});
if (!bad.length) console.log(`PASS  ${syntaxFiles.join(", ")}`);
results.push([`Syntax (${syntaxFiles.length} Dateien)`, bad.length === 0]);

// 2. Tests
step("App (jsdom)", node, ["app.test.js"]);
step("Integration (2 Handys + Worker)", node, ["integration.test.mjs"]);
step("Worker", node, ["../worker/test.mjs"]);
step("Release-Build (wie GitHub Pages)", node, ["release_build.test.mjs"]);
const shotArg = args.includes("--shots") ? ["--shots"] : [];
if (!args.includes("--no-layout")) step("Layout (Browser)", node, ["layout_check.mjs", ...shotArg], { retry: true });
if (!args.includes("--no-ui")) step("UI wie ein Mensch (Browser)", node, ["ui_e2e.mjs", ...shotArg], { retry: true });

console.log("\n=== Zusammenfassung ===");
for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(r => !r[1]).length;
if (failLines.length) console.log("\nWas rot war:\n" + failLines.join("\n"));
console.log(failed ? `\nFAIL: ${failed} Schritt(e) rot` : "\nPASS: alles grün");
// GitHub Actions: Zusammenfassung erscheint direkt auf der Seite des Laufs (ohne Log zu öffnen)
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ["### Tests", "", ...results.map(([n, ok]) => `- ${ok ? "✅" : "❌"} ${n}`),
    ...(failLines.length ? ["", "```", ...failLines, "```"] : []), "", failed ? `**FAIL: ${failed} Schritt(e) rot**` : "**PASS: alles grün**"];
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join("\n") + "\n"); } catch (e) { /* egal */ }
}
process.exit(failed ? 1 : 0);
