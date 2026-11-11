// Release-Build wie auf GitHub Pages (tools/build_site.mjs): Version eintragen, alles gültiges JavaScript.
// Hintergrund: v1.5.0/v1.5.1 waren live kaputt, weil das Eintragen der Version auch das Suchmuster in
// «Aktualisieren» verändert hat (Syntaxfehler) – die Tests liefen nur gegen den Quellcode.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failed++; };

const out = mkdtempSync(path.join(tmpdir(), "bf-site-"));
try {
  const r = spawnSync(process.execPath, [path.join(root, "tools", "build_site.mjs"), out, "9.8.7"], { encoding: "utf8", env: { ...process.env, GITHUB_REF_NAME: "" } });
  process.stdout.write((r.stdout || "") + (r.stderr || ""));
  check(r.status === 0, "build_site.mjs läuft durch (inkl. node --check aller veröffentlichten .js)");

  const src = readFileSync(path.join(root, "static", "app.js"), "utf8").split(/\r?\n/);
  const built = readFileSync(path.join(out, "static", "app.js"), "utf8").split(/\r?\n/);
  const decl = built.filter(l => /const APP_VERSION = "[^"]*";/.test(l));
  check(decl.length === 1 && decl[0].includes('"9.8.7"'), `genau eine Versionszeile, mit 9.8.7 (${decl.map(l => l.trim()).join(" | ")})`);
  const changed = built.filter((l, i) => l !== src[i]);
  check(changed.length === 1, `nur diese eine Zeile verändert (${changed.length})`);
  check(readFileSync(path.join(out, "static", "sw.js"), "utf8").includes("'bringfrisch-cache-9.8.7'"), "Cache des Service Workers heisst wie die Version");
  const pattern = src.find(l => /\.match\(\/const APP_VERSION/.test(l));
  check(!pattern || built.includes(pattern), "Suchmuster in «Aktualisieren» unverändert");
  check(existsSync(path.join(out, "index.html")) && existsSync(path.join(out, "static", "index.html")), "index.html + static/ vorhanden");

  // Ohne Version (Push auf main / von Hand): nichts verändert
  const r2 = spawnSync(process.execPath, [path.join(root, "tools", "build_site.mjs"), out], { encoding: "utf8", env: { ...process.env, GITHUB_REF_NAME: "" } });
  check(r2.status === 0 && readFileSync(path.join(out, "static", "app.js"), "utf8") === readFileSync(path.join(root, "static", "app.js"), "utf8"), "ohne Tag: app.js unverändert");

  // Ungültige Version wird abgelehnt
  const r3 = spawnSync(process.execPath, [path.join(root, "tools", "build_site.mjs"), out, "1.2"], { encoding: "utf8" });
  check(r3.status !== 0, "Version «1.2» wird abgelehnt");
  // Test-Version (tools/build_stage.mjs): Nummer steht VOR der WG-Version, «Aktualisieren» erkennt neuere Test-Builds
  const stageOut = path.join(out, "stage");
  const r4 = spawnSync(process.execPath, [path.join(root, "tools", "build_stage.mjs"), "1.6.8-test.3", stageOut], { encoding: "utf8" });
  process.stdout.write((r4.stdout || "") + (r4.stderr || ""));
  const stageApp = r4.status === 0 ? readFileSync(path.join(stageOut, "app.js"), "utf8") : "";
  check(/^[ \t]*const APP_VERSION = "1\.6\.8-test\.3";/m.test(stageApp), "Test-Version: Versionszeile 1.6.8-test.3");
  check(!!pattern && stageApp.includes(pattern.trim()), "Test-Version: Suchmuster in «Aktualisieren» unverändert");
  const r5 = spawnSync(process.execPath, ["--check", path.join(stageOut, "app.js")], { encoding: "utf8" });
  check(r5.status === 0, "Test-Version: app.js gültiges JavaScript");
} finally {
  rmSync(out, { recursive: true, force: true });
}

// Versionsnummern: Test-Version = letzter Tag + 1 Patch + Commits; Vergleich wie in app.js («Aktualisieren»)
{
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/;
  const stageVersion = (tag, n) => { const x = m.exec(tag || ""); return x ? `${x[1]}.${x[2]}.${+x[3] + 1}-test.${+n || 0}` : ""; };
  const appSrc = readFileSync(path.join(root, "static", "app.js"), "utf8");
  const verNumSrc = appSrc.match(/const verNum = (v => .*);/)[1], isNewerSrc = appSrc.match(/const isNewer = (\(a, b\) => .*);/)[1];
  const isNewer = new Function(`const verNum = ${verNumSrc}; return ${isNewerSrc};`)();
  const tool = readFileSync(path.join(root, "tools", "build_stage.mjs"), "utf8");
  check(tool.includes("`${m[1]}.${m[2]}.${+m[3] + 1}-test.${+commits || 0}`"), "build_stage.mjs rechnet die Version wie hier geprüft");
  check(stageVersion("v1.6.7", "3") === "1.6.8-test.3", "v1.6.7 + 3 Commits = 1.6.8-test.3");
  check(isNewer(stageVersion("v1.6.7", "0"), "1.6.7"), "Test-Version 1.6.8-test.0 ist neuer als WG-Version 1.6.7");
  check(isNewer("1.6.8-test.4", "1.6.8-test.3"), "neuerer Test-Build wird erkannt");
  check(!isNewer("1.6.8-test.3", "1.6.8-test.3"), "gleicher Test-Build: nichts Neues");
  check(isNewer("1.7.0", "1.6.9") && !isNewer("1.6.9", "1.7.0") && isNewer("1.10.0", "1.9.9"), "normale Versionen wie bisher");
}
console.log(failed ? `\nFAIL: ${failed}` : "\nALLES OK");
process.exit(failed ? 1 : 0);
