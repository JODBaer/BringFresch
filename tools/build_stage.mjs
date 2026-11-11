// Baut die Test-Seite (Stage) aus static/ nach dist-stage/:
//   - spricht mit dem Test-Worker (bringfrisch-test, gleiche Adresse wie die Seite), der nur in die Bring!-Liste «Home-test» des Bots schreibt
//   - heisst «BringFrisch Test» und zeigt oben ein kleines «TEST»-Band, damit man sie nicht verwechselt
//   - Version = nächste Version nach dem letzten Release-Tag + «-test.N» (N = Commits seit dem Tag):
//     v1.6.7 + 3 Commits -> «1.6.8-test.3». So steht die Test-Version immer VOR der WG-Version
//     (im Quellcode steht nur ein alter Platzhalter; die WG-Version bekommt ihre Nummer vom Tag, build_site.mjs).
//   node tools/build_stage.mjs [version] [ausgabe-ordner]
// Veröffentlichen (Seite + Server in einem): cd worker && npx wrangler deploy --env stage
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGE_WORKER = "https://bringfrisch-test.bringfrisch-worker.workers.dev";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "static"), out = path.resolve(process.argv[3] || path.join(root, "dist-stage"));

function stageVersion(tag, commits) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag || "");
  return m ? `${m[1]}.${m[2]}.${+m[3] + 1}-test.${+commits || 0}` : "";
}
const git = args => { const r = spawnSync("git", args, { cwd: root, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };
const lastTag = git(["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"]);
const version = process.argv[2] || stageVersion(lastTag, lastTag && git(["rev-list", "--count", `${lastTag}..HEAD`]));

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const edit = (f, fn) => {
  const p = path.join(out, f), before = readFileSync(p, "utf8"), after = fn(before);
  if (after === before) throw new Error(`build_stage: nichts geändert in ${f}`);
  writeFileSync(p, after);
};

edit("app.js", s => {
  s = s.replace(/const DEFAULT_SYNC_URL = "[^"]*";/, `const DEFAULT_SYNC_URL = "${STAGE_WORKER}";`);
  // Nur die Deklarationszeile – das Suchmuster in «Aktualisieren» enthält denselben Text
  if (version) s = s.replace(/^([ \t]*)const APP_VERSION = "[^"]*";[ \t]*$/m, `$1const APP_VERSION = "${version}";`);
  else console.warn("build_stage: kein Release-Tag gefunden (Checkout ohne Tags?) – Version bleibt wie im Quellcode");
  return s;
});
edit("index.html", s => s
  .replace("<title>BringFrisch</title>", "<title>BringFrisch Test</title>")
  .replace('content="BringFrisch">', 'content="BringFrisch Test">')
  .replace("</body>", `<div aria-hidden="true" style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;padding:1px 10px 2px;border-radius:0 0 8px 8px;background:#e8590c;color:#fff;font:700 10px/1.4 system-ui,sans-serif;letter-spacing:.1em;pointer-events:none">TEST · Bring!-Liste «Home-test»</div>\n</body>`));
edit("manifest.json", s => s.replace(/"name": "BringFrisch"/, '"name": "BringFrisch Test"').replace(/"short_name": "BringFrisch"/, '"short_name": "BF Test"'));
edit("sw.js", s => s.replace(/bringfrisch-cache-/, "bringfrisch-stage-cache-"));
console.log(`dist-stage/ gebaut (Server: ${STAGE_WORKER}${version ? `, Version ${version}` : ""})`);
