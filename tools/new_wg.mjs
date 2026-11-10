// Neue WG auf dem WG-Server anlegen (eigener Name + PIN, eigene Daten, eigene Bring!-Liste, gleicher Bot).
//   node tools/new_wg.mjs "Sonnenhof"            -> WG-Server (bringfrisch)
//   node tools/new_wg.mjs "Sonnenhof" --stage    -> Test-Version (bringfrisch-test)
// Fragt den PIN verdeckt ab (mind. 6 Zeichen). Gespeichert wird nur ein Hash, nie der PIN selbst.
// Danach: In Bring! die WG-Liste mit dem Bot-Konto teilen, in der App WG-Name + PIN eingeben,
// unter Einstellungen die Bring!-Liste wählen. Braucht wrangler-Login (npx wrangler login) oder CLOUDFLARE_API_TOKEN.
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
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
if (["wg1", "test", "main"].includes(slug)) {
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
if (existing.status === 0 && existing.stdout.trim() && !/not found/i.test(existing.stdout)) {
  console.log(`WG «${slug}» gibt es schon. Abbruch (nichts geändert).`);
  process.exit(1);
}

const pin = await askHidden(`PIN für «${name}» (mind. 6 Zeichen, wird nicht angezeigt): `);
const pin2 = await askHidden("PIN nochmals: ");
if (pin.length < 6 || pin !== pin2) {
  console.log(pin !== pin2 ? "PINs ungleich. Abbruch." : "PIN zu kurz (mind. 6). Abbruch.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const pinHash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
const calToken = randomBytes(24).toString("base64url");
const reg = JSON.stringify({ name: String(name).trim(), salt, pinHash, calToken, created: Date.now() });

for (const [k, v] of [[`wgs:${slug}`, reg], [`cal:${calToken}`, slug]]) {
  const r = wrangler("kv", "key", "put", k, v, "--binding", "WG", "--remote");
  if (r.status !== 0) {
    console.log(`FEHLER beim Speichern von ${k.split(":")[0]}:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
}
const host = stage ? "bringfrisch-test" : "bringfrisch";
console.log(`
WG «${name}» angelegt${stage ? " (Test-Version)" : ""}.
  In der App eingeben:  WG-Name ${slug}  +  den PIN
  Bring!: WG-Liste mit dem Bot-Konto teilen, dann in der App unter Einstellungen die Liste wählen
  Kalender:             https://${host}.bringfrisch-worker.workers.dev/cal/${calToken}.ics  (auch in der App unter «Mehr»)`);
