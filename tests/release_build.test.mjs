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
  const pattern = src.find(l => /\.match\(\/const APP_VERSION/.test(l));
  check(!pattern || built.includes(pattern), "Suchmuster in «Aktualisieren» unverändert");
  check(existsSync(path.join(out, "index.html")) && existsSync(path.join(out, "static", "index.html")), "index.html + static/ vorhanden");

  // Ohne Version (Push auf main / von Hand): nichts verändert
  const r2 = spawnSync(process.execPath, [path.join(root, "tools", "build_site.mjs"), out], { encoding: "utf8", env: { ...process.env, GITHUB_REF_NAME: "" } });
  check(r2.status === 0 && readFileSync(path.join(out, "static", "app.js"), "utf8") === readFileSync(path.join(root, "static", "app.js"), "utf8"), "ohne Tag: app.js unverändert");

  // Ungültige Version wird abgelehnt
  const r3 = spawnSync(process.execPath, [path.join(root, "tools", "build_site.mjs"), out, "1.2"], { encoding: "utf8" });
  check(r3.status !== 0, "Version «1.2» wird abgelehnt");
} finally {
  rmSync(out, { recursive: true, force: true });
}
console.log(failed ? `\nFAIL: ${failed}` : "\nALLES OK");
process.exit(failed ? 1 : 0);
