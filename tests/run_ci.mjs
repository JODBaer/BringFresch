// Ein Befehl für alles, was offline und immer gleich läuft (lokal wie in GitHub Actions):
//   cd tests && npm run ci                -> Syntax, App, 2-Handy-Integration, Worker, Layout + UI im Browser
//   npm run ci -- --shots                 -> zusätzlich Bildschirmfotos in tests/shots/
//   npm run ci -- --no-layout             -> ohne Layout-Prüfung im Browser
//   npm run ci -- --no-ui                 -> ohne UI-Test (klickt sich durch alle Seiten, ui_e2e.mjs)
// Keine Live-Tests (e2e_live, check_live): die brauchen echte Zugangsdaten.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
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
function step(name, cmd, cmdArgs) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, cmdArgs, { cwd: here, env, stdio: "inherit" });
  if (r.error) console.log(String(r.error));
  results.push([name, r.status === 0]);
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
const shotArg = args.includes("--shots") ? ["--shots"] : [];
if (!args.includes("--no-layout")) step("Layout (Browser)", node, ["layout_check.mjs", ...shotArg]);
if (!args.includes("--no-ui")) step("UI wie ein Mensch (Browser)", node, ["ui_e2e.mjs", ...shotArg]);

console.log("\n=== Zusammenfassung ===");
for (const [name, ok] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(r => !r[1]).length;
console.log(failed ? `\nFAIL: ${failed} Schritt(e) rot` : "\nPASS: alles grün");
process.exit(failed ? 1 : 0);
