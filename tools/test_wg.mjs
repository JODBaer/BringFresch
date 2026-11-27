// Wegwerf-WG auf dem TEST-Server (nie auf dem WG-Server): «neue WG» einmal von Anfang an durchspielen und wieder wegräumen.
//   node tools/test_wg.mjs neu OBtest --pin 4711   -> WG anlegen (PIN gleich gesetzt), Bring!-Liste «Home-test» verbinden
//   node tools/test_wg.mjs weg OBtest              -> alles dieser WG löschen (Daten, Einladungen, geteilte Rezepte, Meldungen)
// Danach in der Test-App: WG-Name «obtest» + PIN (oder Einladungslink von einem Handy, das schon drin ist).
// «Gemerkt» auf dem Handy (WG, PIN, «Ich bin») bleibt im Browser des Handys – das kann der Server nicht löschen:
// für einen ganz neuen Start auf dem Handy die Website-Daten der Test-App löschen (Chrome: Schloss/ⓘ → Website-Einstellungen → Daten löschen).
// Braucht wrangler-Login (npx wrangler login) oder CLOUDFLARE_API_TOKEN.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = "https://bringfrisch-test.bringfrisch-worker.workers.dev";
const workerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "worker");
const [cmd, name] = process.argv.slice(2);
const pinArg = (process.argv.find(a => a.startsWith("--pin=")) || "").slice(6) || process.argv[process.argv.indexOf("--pin") + 1];
const slug = String(name || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
if (!["neu", "weg"].includes(cmd) || !slug) { console.log('Aufruf: node tools/test_wg.mjs neu|weg "WG-Name" [--pin 1234]'); process.exit(1); }
if (["allmen", "wg1", "test", "main"].includes(slug)) { console.log(`«${slug}» ist reserviert.`); process.exit(1); }

// immer --env stage: dieses Werkzeug fasst den WG-Server nie an
const wrangler = (...a) => spawnSync("npx", ["--yes", "wrangler@4.159.0", ...a, "--binding", "WG", "--remote", "--env", "stage"],
  { cwd: workerDir, encoding: "utf8", shell: process.platform === "win32" });
const get = k => { const r = wrangler("kv", "key", "get", k); return r.status === 0 && r.stdout.trim() && !/not found/i.test(r.stdout) ? r.stdout.trim() : null; };
const keys = prefix => { const r = wrangler("kv", "key", "list", "--prefix", prefix); try { return JSON.parse(r.stdout).map(k => k.name); } catch { return []; } };
const tmp = mkdtempSync(path.join(tmpdir(), "obtest-"));
const put = (k, v) => { const f = path.join(tmp, "v"); writeFileSync(f, v); const r = wrangler("kv", "key", "put", k, "--path", f); if (r.status) throw new Error(`${k}: ${r.stderr || r.stdout}`); };
const del = k => wrangler("kv", "key", "delete", k);

try {
  if (cmd === "neu") {
    if (get(`wgs:${slug}`)) { console.log(`WG «${slug}» gibt es schon – zuerst: node tools/test_wg.mjs weg ${name}`); process.exit(1); }
    const pin = pinArg && pinArg.length >= 4 ? pinArg : String(randomInt(100000, 999999));
    const salt = randomBytes(16).toString("hex");
    const calToken = randomBytes(24).toString("base64url");
    put(`wgs:${slug}`, JSON.stringify({ name: String(name).trim(), salt, pinHash: createHash("sha256").update(`${salt}:${pin}`).digest("hex"), calToken, created: Date.now(), wegwerf: true }));
    put(`cal:${calToken}`, slug);
    // Bring!: die Spielwiese «Home-test» wählen (gehört nie einer WG, darum für jede WG ohne eigene Liste wählbar)
    const api = async (p, init = {}) => {
      const r = await fetch(SERVER + p, { ...init, headers: { "X-WG": slug, "X-WG-PIN": pin, "Content-Type": "application/json" }, body: init.body && JSON.stringify(init.body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${p}: ${d.error || r.status}`);
      return d;
    };
    let list = "";
    for (let i = 0; i < 5 && !list; i++) { // KV liest kurz nach dem Schreiben manchmal noch alt
      try { const { lists } = await api("/bring/lists"); const t = lists.find(l => l.test); if (t) { await api("/bring/target", { method: "PUT", body: { uuid: t.uuid } }); list = t.name; } }
      catch (e) { if (i === 4) console.log(`Bring! nicht verbunden: ${e.message}`); await new Promise(r => setTimeout(r, 3000)); }
    }
    console.log(`
Wegwerf-WG «${name}» auf dem Test-Server angelegt.
  Test-App:  ${SERVER}/
  WG-Name:   ${slug}
  PIN:       ${pin}
  Bring!:    ${list ? `«${list}» verbunden` : "noch nicht verbunden (in der App unter Einstellungen wählen)"}
Wegräumen: node tools/test_wg.mjs weg ${name}`);
  } else {
    const reg = get(`wgs:${slug}`);
    if (!reg) { console.log(`WG «${slug}» gibt es nicht (schon weg?).`); process.exit(0); }
    const own = keys(`w:${slug}:`);
    let cal = null; try { cal = JSON.parse(reg).calToken; } catch { /* altes Format */ }
    // Einladungen dieser WG (inv:<id> enthält { wg }), Erinnerungs-Kurzbefehle (remind:<token> enthält { slug })
    const inv = keys("inv:").filter(k => { try { return JSON.parse(get(k) || "{}").wg === slug; } catch { return false; } });
    const rem = keys("remind:").filter(k => { try { return JSON.parse(get(k) || "{}").slug === slug; } catch { return false; } });
    for (const k of [...own, ...inv, ...rem, `shared:${slug}`, ...(cal ? [`cal:${cal}`] : []), `wgs:${slug}`]) del(k);
    // Verzeichnisse ohne diese WG zurückschreiben
    const idx = JSON.parse(get("shared:index") || "[]");
    if (idx.includes(slug)) put("shared:index", JSON.stringify(idx.filter(s => s !== slug)));
    const pidx = JSON.parse(get("push:index") || "{}");
    if (pidx[slug]) { delete pidx[slug]; put("push:index", JSON.stringify(pidx)); }
    console.log(`WG «${slug}» weggeräumt: ${own.length} Daten-Einträge, ${inv.length} Einladungen, ${rem.length} Erinnerungen, geteilte Rezepte, Kalender, Anmeldung.
Auf den Handys: Website-Daten der Test-App löschen (Chrome: ⓘ → Website-Einstellungen → Daten löschen), dann startet sie wie neu.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
