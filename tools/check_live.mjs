// Live-Check der ganzen Kette: App (GitHub Pages) -> Worker (Cloudflare) -> Bring!
//
//   node tools/check_live.mjs                 # fragt nach dem WG-PIN (wird nicht angezeigt)
//   node tools/check_live.mjs --out datei.txt # Ergebnis zusätzlich in eine Datei
//
// Setzt kurz einen Test-Artikel «BringFrisch Test» auf Bring! und entfernt ihn wieder.
// PIN und Kalender-Token werden nie ausgegeben.
import readline from "node:readline";
import { writeFileSync, readFileSync, readdirSync } from "node:fs";

const APP = "https://jodbaer.github.io/BringFresch/";
const ORIGIN = "https://jodbaer.github.io";
const appJsLocal = readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
const WORKER = (appJsLocal.match(/DEFAULT_SYNC_URL = "([^"]*)"/) || [])[1];
const TEST_ITEM = "BringFrisch Test";

const outIdx = process.argv.indexOf("--out");
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const lines = [];
let failed = 0;
const log = s => { console.log(s); lines.push(s); };
const pass = (name, info = "") => log(`PASS  ${name}${info ? "  – " + info : ""}`);
const fail = (name, info = "") => { failed++; log(`FAIL  ${name}${info ? "  – " + info : ""}`); };

function askHidden(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); });
  });
}

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

async function step(name, fn) {
  try {
    const info = await fn();
    pass(name, info);
    return true;
  } catch (e) {
    fail(name, e.message);
    return false;
  }
}

let PIN = process.env.WG_PIN || "";
async function api(path, { method = "GET", body, pin = PIN } = {}) {
  const res = await fetch(WORKER + path, {
    method,
    headers: { Origin: ORIGIN, "X-WG-PIN": pin, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

log(`BringFrisch Live-Check  ${new Date().toLocaleString("de-CH")}`);
log(`App:    ${APP}`);
log(`Server: ${WORKER || "(nicht gesetzt!)"}`);
log("");

// --- 1. App (GitHub Pages) ---------------------------------------------------------------
log("[App]");
await step("App-Seite erreichbar, neue Version (Wochenwahl)", async () => {
  const html = await (await fetch(APP + "static/index.html", { cache: "no-store" })).text();
  if (!html.includes("Wochenwahl")) throw new Error("alte Version online – Pages-Deploy abwarten");
});
await step("Live-app*.js = lokale app*.js", async () => {
  // app.js = Grundlage, app_*.js = Ansichten, Abgleich, Theme, Start (alle in index.html geladen)
  const files = readdirSync(new URL("../static/", import.meta.url)).filter(f => /^app(_[a-z]+)?\.js$/.test(f));
  const norm = s => s.replace(/\r\n/g, "\n");
  for (const f of files) {
    const live = await (await fetch(APP + "static/" + f, { cache: "no-store" })).text();
    const local = readFileSync(new URL("../static/" + f, import.meta.url), "utf8");
    if (norm(live) !== norm(local)) throw new Error(`${f} unterscheidet sich – noch nicht gepusht/deployt?`);
  }
});
await step("Live-App kennt die Server-Adresse", async () => {
  const live = await (await fetch(APP + "static/app.js", { cache: "no-store" })).text();
  if (!WORKER || !live.includes(WORKER)) throw new Error("DEFAULT_SYNC_URL fehlt in der Live-Version");
});
await step("Rezepte (recipes_imported.js) erreichbar", async () => {
  const r = await fetch(APP + "static/recipes_imported.js");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
});

// --- 2. Worker ohne PIN -------------------------------------------------------------------
log("");
log("[Server]");
if (!WORKER) { fail("Server-Adresse", "DEFAULT_SYNC_URL in static/app.js leer"); }
else {
  await step("/health", async () => {
    const d = await (await fetch(WORKER + "/health")).json();
    if (!d.ok) throw new Error(JSON.stringify(d));
  });
  await step("CORS: App darf den Server aufrufen", async () => {
    const r = await fetch(WORKER + "/bring/sync", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-wg-pin,content-type" },
    });
    const allow = r.headers.get("access-control-allow-origin");
    if (allow !== ORIGIN) throw new Error(`Allow-Origin = ${allow}`);
  });
  await step("Falscher PIN wird abgelehnt", async () => {
    try { await api("/plan", { pin: "falsch-123" }); } catch (e) {
      if (/PIN/.test(e.message)) return;
      throw e;
    }
    throw new Error("falscher PIN wurde akzeptiert!");
  });

  // --- 3. Mit PIN -----------------------------------------------------------------------
  if (!PIN) PIN = await askHidden("WG-PIN eingeben (wird nicht angezeigt): ");
  log("");
  log("[Mit WG-PIN]");
  const pinOk = await step("PIN stimmt", async () => { await api("/plan"); });

  if (pinOk) {
    await step("Gemeinsamer Plan lesbar", async () => {
      const d = await api("/plan");
      return d.plan ? `Plan vorhanden (Woche ${d.week || "?"})` : "noch kein Plan gespeichert (ok)";
    });
    await step(`Wochenwahl ${isoWeek()} lesbar`, async () => {
      const d = await api(`/week/${isoWeek()}`);
      const n = Object.keys(d.votes || {}).length;
      return `${(d.candidates || []).length} Gerichte, ${n} Stimmen`;
    });
    await step("Kalender-Abo liefert iCal", async () => {
      const { url } = await api("/cal-link");
      const ics = await (await fetch(url)).text();
      if (!ics.startsWith("BEGIN:VCALENDAR")) throw new Error("keine iCal-Antwort");
      const n = (ics.match(/BEGIN:VEVENT/g) || []).length;
      return `${n} Termine`;
    });

    // --- 4. Bring! ------------------------------------------------------------------------
    log("");
    log("[Bring!]");
    let active = null;
    const loginOk = await step("Bot-Login + Listen des Bot-Kontos", async () => {
      const d = await api("/bring/lists");
      active = d.lists.find(l => l.uuid === d.active);
      for (const l of d.lists) log(`        ${l.uuid === d.active ? "→" : " "} ${l.name}`);
      return `${d.lists.length} Liste(n), benutzt wird: «${active ? active.name : "unbekannt"}»`;
    });
    if (loginOk) {
      if (active && d_isDefaultName(active.name)) {
        log("        HINWEIS: das ist wohl die eigene Liste des Bots, nicht eure WG-Liste.");
      }
      let before = [];
      await step("Liste lesen", async () => {
        before = (await api("/bring/list")).items;
        return `${before.length} Artikel drauf`;
      });
      const pushed = await step(`Test-Artikel «${TEST_ITEM}» setzen`, async () => {
        const d = await api("/bring/sync", { method: "POST", body: { items: [{ name: TEST_ITEM, spec: "1 Stk" }] } });
        if (d.pushed !== 1) throw new Error(JSON.stringify(d));
      });
      if (pushed) {
        await step("Test-Artikel ist auf der Liste", async () => {
          const items = (await api("/bring/list")).items;
          if (!items.includes(TEST_ITEM)) throw new Error("nicht gefunden");
        });
        await step("Test-Artikel wieder entfernt", async () => {
          await api("/bring/remove", { method: "POST", body: { names: [TEST_ITEM] } });
          const items = (await api("/bring/list")).items;
          if (items.includes(TEST_ITEM)) throw new Error("noch drauf");
        });
      }
    }
  }
}

function d_isDefaultName(name) {
  return /^(zuhause|einkaufsliste|home|my list|meine liste)$/i.test(String(name).trim());
}

log("");
log(failed ? `${failed} PROBLEM(E) gefunden` : "ALLES OK");
if (outFile) writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
process.exitCode = failed ? 1 : 0;
