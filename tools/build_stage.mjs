// Baut die Test-Seite (Stage) aus static/ nach dist-stage/:
//   - spricht mit dem Test-Worker (bringfrisch-test, gleiche Adresse wie die Seite), der nur in die Bring!-Liste «Home-test» des Bots schreibt
//   - heisst «BringFrisch Test» und zeigt oben ein kleines «TEST»-Band, damit man sie nicht verwechselt
//   node tools/build_stage.mjs
// Veröffentlichen (Seite + Server in einem): cd worker && npx wrangler deploy --env stage
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGE_WORKER = "https://bringfrisch-test.bringfrisch-worker.workers.dev";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "static"), out = path.join(root, "dist-stage");

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const edit = (f, fn) => {
  const p = path.join(out, f), before = readFileSync(p, "utf8"), after = fn(before);
  if (after === before) throw new Error(`build_stage: nichts geändert in ${f}`);
  writeFileSync(p, after);
};

edit("app.js", s => s.replace(/const DEFAULT_SYNC_URL = "[^"]*";/, `const DEFAULT_SYNC_URL = "${STAGE_WORKER}";`));
edit("index.html", s => s
  .replace("<title>BringFrisch</title>", "<title>BringFrisch Test</title>")
  .replace('content="BringFrisch">', 'content="BringFrisch Test">')
  .replace("</body>", `<div aria-hidden="true" style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;padding:1px 10px 2px;border-radius:0 0 8px 8px;background:#e8590c;color:#fff;font:700 10px/1.4 system-ui,sans-serif;letter-spacing:.1em;pointer-events:none">TEST · Bring!-Liste «Home-test»</div>\n</body>`));
edit("manifest.json", s => s.replace(/"name": "BringFrisch"/, '"name": "BringFrisch Test"').replace(/"short_name": "BringFrisch"/, '"short_name": "BF Test"'));
edit("sw.js", s => s.replace(/bringfrisch-cache-/, "bringfrisch-stage-cache-"));
console.log(`dist-stage/ gebaut (Server: ${STAGE_WORKER})`);
