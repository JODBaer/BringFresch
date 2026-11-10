// Neue WG auf dem WG-Server anlegen (eigener Name + PIN, eigene Daten, eigene Bring!-Liste, gleicher Bot).
//   node tools/new_wg.mjs "Sonnenhof"            -> WG-Server (bringfrisch)
//   node tools/new_wg.mjs "Sonnenhof" --stage    -> Test-Version (bringfrisch-test)
//   node tools/new_wg.mjs "Sonnenhof" --reparieren -> WG aus alter Version (kaputtes JSON, «Expected property name») reparieren
// Fragt den PIN verdeckt ab (mind. 4 Zeichen). Gespeichert wird nur ein Hash, nie der PIN selbst.
// Danach: In Bring! die WG-Liste mit dem Bot-Konto teilen, in der App WG-Name + PIN eingeben,
// unter Einstellungen die Bring!-Liste wählen. Braucht wrangler-Login (npx wrangler login) oder CLOUDFLARE_API_TOKEN.
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const workerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "worker");
const args = process.argv.slice(2);
const stage = args.includes("--stage");
const name = args.find(a => !a.startsWith("--"));
// gleich wie wgSlug() im Worker
const slug = String(name || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
if (!slug) {
  console.log('Aufruf: node tools/new_wg.mjs "WG-Name" [--stage]');
  process.exit(1);
}
if (["allmen", "wg1", "test", "main"].includes(slug)) {
  console.log(`«${slug}» ist reserviert (erste WG / Test). Bitte anderen Namen wählen.`);
  process.exit(1);
}

function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); });
  });
}

const wrangler = (...a) => spawnSync("npx", ["--yes", "wrangler@4.159.0", ...a, ...(stage ? ["--env", "stage"] : [])],
  { cwd: workerDir, encoding: "utf8", shell: process.platform === "win32" });

const existing = wrangler("kv", "key", "get", `wgs:${slug}`, "--binding", "WG", "--remote");

// --reparieren: WG, die mit der alten Version angelegt wurde ({name:…} ohne Anführungszeichen), in gültiges JSON umschreiben.
// Gleiche Werte (Name, PIN-Hash, Kalender-Link) – nichts sonst wird geändert.
if (args.includes("--reparieren")) {
  const raw = existing.stdout.trim();
  try { JSON.parse(raw); console.log(`WG «${slug}» ist schon in Ordnung.`); process.exit(0); } catch {}
  const o = {};
  raw.replace(/^\{|\}$/g, "").split(",").forEach(p => { const i = p.indexOf(":"); o[p.slice(0, i)] = p.slice(i + 1); });
  o.created = +o.created || Date.now();
  if (!o.name || !/^[0-9a-f]{32}$/.test(o.salt) || !/^[0-9a-f]{64}$/.test(o.pinHash) || !o.calToken) {
    console.log(`WG «${slug}» nicht gefunden oder unbekanntes Format. Nichts geändert.`);
    process.exit(1);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "bringfrisch-wg-"));
  const file = path.join(tmp, "value");
  writeFileSync(file, JSON.stringify(o));
  const r = wrangler("kv", "key", "put", `wgs:${slug}`, "--path", file, "--binding", "WG", "--remote");
  rmSync(tmp, { recursive: true, force: true });
  const back = wrangler("kv", "key", "get", `wgs:${slug}`, "--binding", "WG", "--remote");
  try { JSON.parse(back.stdout.trim()); } catch { console.log(`FEHLER:\n${r.stderr || r.stdout}`); process.exit(1); }
  console.log(`WG «${o.name}» repariert. In der App: WG-Name ${slug} + der bisherige PIN.`);
  process.exit(0);
}
if (existing.status === 0 && existing.stdout.trim() && !/not found/i.test(existing.stdout)) {
  console.log(`WG «${slug}» gibt es schon. Abbruch (nichts geändert).`);
  process.exit(1);
}

const pin = await askHidden(`PIN für «${name}» (mind. 4 Zeichen, wird nicht angezeigt): `);
const pin2 = await askHidden("PIN nochmals: ");
if (pin.length < 4 || pin !== pin2) {
  console.log(pin !== pin2 ? "PINs ungleich. Abbruch." : "PIN zu kurz (mind. 4). Abbruch.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const pinHash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
const calToken = randomBytes(24).toString("base64url");
const reg = JSON.stringify({ name: String(name).trim(), salt, pinHash, calToken, created: Date.now() });

// Werte über eine Datei (--path): unter Windows (shell) frisst cmd sonst die Anführungszeichen im JSON
// -> «{name:…}» ist kein JSON mehr, und die WG kann sich nie verbinden («Expected property name …»).
const tmp = mkdtempSync(path.join(tmpdir(), "bringfrisch-wg-"));
for (const [k, v] of [[`wgs:${slug}`, reg], [`cal:${calToken}`, slug]]) {
  const file = path.join(tmp, "value");
  writeFileSync(file, v);
  const r = wrangler("kv", "key", "put", k, "--path", file, "--binding", "WG", "--remote");
  if (r.status !== 0) {
    console.log(`FEHLER beim Speichern von ${k.split(":")[0]}:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
}
rmSync(tmp, { recursive: true, force: true });
// gegenlesen: gespeichert muss gültiges JSON sein
const back = wrangler("kv", "key", "get", `wgs:${slug}`, "--binding", "WG", "--remote");
try { JSON.parse(back.stdout.trim()); } catch {
  console.log(`FEHLER: gespeicherte WG ist kein gültiges JSON:\n${back.stdout}`);
  process.exit(1);
}
const host = stage ? "bringfrisch-test" : "bringfrisch";
console.log(`
WG «${name}» angelegt${stage ? " (Test-Version)" : ""}.
  In der App eingeben:  WG-Name ${slug}  +  den PIN
  Bring!: WG-Liste mit dem Bot-Konto teilen, dann in der App unter Einstellungen die Liste wählen
  Kalender:             https://${host}.bringfrisch-worker.workers.dev/cal/${calToken}.ics  (auch in der App unter «Mehr»)`);
