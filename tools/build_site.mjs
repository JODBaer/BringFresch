// Baut die WG-Version für GitHub Pages: _site/ = index.html + static/, Version = Release-Tag.
//   node tools/build_site.mjs [ausgabe-ordner] [version]      (Standard: _site, Version aus GITHUB_REF_NAME v1.2.3)
// Wird vom Release (.github/workflows/deploy-pages.yml) UND von den Tests (tests/run_ci.mjs) benutzt –
// was getestet wird, ist genau das, was veröffentlicht wird.
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(process.argv[2] || path.join(root, "_site"));
const tag = process.env.GITHUB_REF_NAME || "";
const version = process.argv[3] || (/^v\d+\.\d+\.\d+$/.test(tag) ? tag.slice(1) : "");

function fail(msg) { console.error(`FAIL  ${msg}`); process.exit(1); }

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(root, "index.html"), path.join(out, "index.html"));
cpSync(path.join(root, "static"), path.join(out, "static"), { recursive: true });

// Version in der App = Release-Tag, damit «Aktualisieren» die neue Version erkennt.
// Nur die Deklarationszeile ersetzen – das Suchmuster in «Aktualisieren» enthält denselben Text (v1.5.0/1.5.1 kaputt).
if (version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Version «${version}» ist nicht x.y.z`);
  const file = path.join(out, "static", "app.js");
  const src = readFileSync(file, "utf8");
  const decl = /^([ \t]*)const APP_VERSION = "[^"]*";[ \t]*$/m;
  const hits = src.split(/\r?\n/).filter(l => /^[ \t]*const APP_VERSION = "[^"]*";[ \t]*$/.test(l)).length;
  if (hits !== 1) fail(`app.js: ${hits} Zeilen «const APP_VERSION = "…";» statt genau 1`);
  writeFileSync(file, src.replace(decl, `$1const APP_VERSION = "${version}";`));
  // Cache des Service Workers heisst wie die Version: jede Veröffentlichung räumt den alten Cache von selbst weg
  const sw = path.join(out, "static", "sw.js");
  const swSrc = readFileSync(sw, "utf8");
  if (!/bringfrisch-cache-v\d+/.test(swSrc)) fail("sw.js: CACHE_NAME «bringfrisch-cache-v…» nicht gefunden");
  writeFileSync(sw, swSrc.replace(/bringfrisch-cache-v\d+/, `bringfrisch-cache-${version}`));
}

// Alles, was veröffentlicht wird, muss gültiges JavaScript sein.
const bad = readdirSync(path.join(out, "static")).filter(f => f.endsWith(".js")).filter(f => {
  const r = spawnSync(process.execPath, ["--check", path.join(out, "static", f)], { encoding: "utf8" });
  if (r.status !== 0) console.error(r.stderr);
  return r.status !== 0;
});
if (bad.length) fail(`Syntaxfehler in ${bad.join(", ")}`);
console.log(`PASS  Seite gebaut: ${path.relative(root, out) || out}${version ? ` (Version ${version})` : ""}`);
