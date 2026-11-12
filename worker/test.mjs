// Offline-Test für den Worker: Bring! und KV werden simuliert. Start: node worker/test.mjs
import worker, { backup, pinHash } from "./src/index.js";

let fails = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

// --- KV-Attrappe
const store = new Map(), kvOpts = new Map();
const KV = {
  async get(k, type) { const v = store.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
  async getWithMetadata(k) { const v = store.get(k); return { value: v == null ? null : v, metadata: v == null ? null : (kvOpts.get(k) || {}).metadata || null }; },
  async put(k, v, opts) { store.set(k, v); if (opts) kvOpts.set(k, opts); },
  async delete(k) { store.delete(k); },
  async list({ prefix = "" } = {}) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
};
const env = { WG: KV, WG_PIN: "1234", CAL_TOKEN: "cal-secret", BRING_EMAIL: "bot@example.ch", BRING_PASSWORD: "pw" };

// --- Bring!-Attrappe
const bringCalls = [];
// Bring!-Attrappe wie die echte Liste: jeder Eintrag hat eine uuid; die Batch-Schnittstelle ändert/entfernt nur Einträge,
// deren uuid passt – mit fremder uuid antwortet sie 204 und tut nichts (so beobachtet im Live-Test 12.11.2026).
let uuidNo = 0;
const bringList = [{ name: "Milch", specification: "", uuid: "u-milch" }];
const wgPuts = [];
let batchIgnore = false, batchFail = false, tokenNo = 0, expireToken = false;
let imgFetches = 0;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  bringCalls.push({ url, init });
  if (url.endsWith("/bringauth")) {
    const p = new URLSearchParams(init.body);
    if (p.get("password") !== "pw") return new Response("", { status: 401 });
    tokenNo++;
    return Response.json({ uuid: "u1", access_token: "tok", bringListUUID: "list-1", expires_in: 604800 });
  }
  if (expireToken && url.includes("getbring.com")) { expireToken = false; return new Response("", { status: 401 }); }
  if (url.endsWith("/bringusers/u1/lists")) return Response.json({ lists: [{ listUuid: "list-1", name: "Home-test" }, { listUuid: "list-wg", name: "WG" }, { listUuid: "list-sh", name: "Sonnenhof" }] });
  if (url.endsWith("/bringlists/list-1/items") && init.method === "PUT") { // Batch
    if (batchFail) return new Response("kaputt", { status: 500 });
    if (!batchIgnore) for (const c of JSON.parse(init.body).changes) {
      const i = bringList.findIndex(x => x.uuid === c.uuid);
      const sameName = bringList.some(x => x.name === c.itemId);
      if (c.operation === "REMOVE") { if (i >= 0) bringList.splice(i, 1); }
      else if (i >= 0) bringList[i].specification = c.spec;
      else if (!sameName) bringList.push({ name: c.itemId, specification: c.spec, uuid: c.uuid });
    }
    return new Response(null, { status: 204 });
  }
  if (url.endsWith("/bringlists/list-wg/items") && init.method === "PUT") { for (const c of JSON.parse(init.body).changes) if (c.operation !== "REMOVE") wgPuts.push(c.itemId); return new Response(null, { status: 204 }); }
  if (url.includes("/bringlists/list-wg") && (init.method || "GET") === "GET") return Response.json({ items: { purchase: wgPuts.map(n => ({ itemId: n })) } });
  if (url.includes("/bringlists/list-wg") && init.method === "PUT") { wgPuts.push(new URLSearchParams(init.body).get("purchase")); return new Response(null, { status: 204 }); }
  if (url.includes("/bringlists/list-1") && (init.method || "GET") === "GET") return Response.json({ purchase: bringList });
  if (url.includes("/bringlists/list-1") && init.method === "PUT") {
    const p = new URLSearchParams(init.body);
    if (p.get("remove")) { const i = bringList.findIndex(x => x.name === p.get("remove")); if (i >= 0) bringList.splice(i, 1); return new Response(null, { status: 204 }); }
    const ex = bringList.find(x => x.name === p.get("purchase"));
    if (ex) ex.specification = p.get("specification"); else bringList.push({ name: p.get("purchase"), specification: p.get("specification"), uuid: "u-single-" + ++uuidNo });
    return new Response(null, { status: 204 });
  }
  if (url === "https://fooby.ch/de/weiter") return new Response(null, { status: 302, headers: { Location: "https://fooby.ch/de/rezepte/2/ohne" } });
  if (url === "https://fooby.ch/de/intern") return new Response(null, { status: 302, headers: { Location: "https://192.168.1.1/admin" } });
  if (url.startsWith("https://192.168.")) { internFetches++; return new Response("geheim"); }
  if (url === "https://fooby.ch/de/rezepte/1/bild") return new Response(`<html><head><meta property="og:image" content="/img/bild.jpg?w=1200&amp;q=80"></head></html>`);
  if (url === "https://fooby.ch/img/bild.jpg?w=1200&q=80") { imgFetches++; return new Response(new Uint8Array([255, 216, 255, 1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } }); }
  if (url === "https://fooby.ch/de/rezepte/2/ohne") { imgFetches++; return new Response("<html><head><title>ohne Bild</title></head></html>"); }
  if (url === "https://www.bettybossi.ch/de/rezepte/rezept/gross-1/") return new Response(`<html><head><meta property="og:image" content="https://media.bettybossi.ch/image/1/image_x/-FJPG"></head></html>`);
  if (url === "https://media.bettybossi.ch/image/1/image_x/-B640-FJPG") { imgFetches++; return new Response(new Uint8Array([255, 216, 255, 9]), { headers: { "Content-Type": "image/jpeg" } }); }
  if (url === "https://media.bettybossi.ch/image/1/image_x/-FJPG") { imgFetches++; return new Response(new Uint8Array(2_000_000), { headers: { "Content-Type": "image/jpeg" } }); }
  if (url.startsWith("https://www.swissmilk.ch/")) {
    return new Response(`<html><head><meta property="og:title" content="Auberginenrollen - Rezept | Swissmilk"></head><body><h1>Navigieren</h1><table>
      <tr itemprop="recipeIngredient"><td colspan="2" class="Ingredient--text">Bratpfanne</td></tr>
      <tr itemprop="recipeIngredient" class="Ingredient"><td class="Ingredient--amount"><span><!----><span>50</span><span> g</span></span></td><td class="Ingredient--text">Ingwer</td></tr>
      <tr itemprop="recipeIngredient" class="Ingredient"><td class="Ingredient--amount"><span>2</span></td><td class="Ingredient--text">Auberginen</td></tr></table><span itemprop="recipeYield">4 Personen</span></body></html>`);
  }
  if (url.startsWith("https://blog.example.ch/")) {
    return new Response(`<html><script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Omas R&#246;sti","recipeYield":["2"],"recipeIngredient":["800 g Kartoffeln","2 EL Butter"]}]}</script></html>`);
  }
  if (url.startsWith("https://www.bettybossi.ch/")) {
    return new Response(`<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Recipe","name":"Zwiebelsuppe","recipeYield":"4 Personen","totalTime":"PT46M","recipeIngredient":["5 Zwiebeln","2 EL Butter"]}</script></html>`);
  }
  return new Response("not mocked", { status: 599 });
};

let internFetches = 0;
const ORIGIN = "https://jodbaer.github.io";
const call = (path, { method = "GET", pin = "1234", body, origin = ORIGIN, wg } = {}) =>
  worker.fetch(new Request("https://bf.example.workers.dev" + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", ...(pin ? { "X-WG-PIN": pin } : {}), ...(wg ? { "X-WG": wg } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env);

// 1. Basis & Sicherheit
let r = await call("/health", { pin: null });
check(r.status === 200, "/health ohne PIN erreichbar");
r = await call("/bring/list", { pin: "0000" });
check(r.status === 401, "falscher PIN -> 401");
check(r.headers.get("Access-Control-Allow-Origin") === ORIGIN, "CORS für GitHub Pages");
r = await call("/health", { pin: null, origin: "https://evil.example" });
check(!r.headers.get("Access-Control-Allow-Origin"), "kein CORS für fremde Seiten");
r = await worker.fetch(new Request("https://x/bring/sync", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
check(r.status === 204 && /X-WG-PIN/.test(r.headers.get("Access-Control-Allow-Headers")), "CORS-Preflight erlaubt X-WG-PIN");

// 2. Bring!
r = await call("/bring/list");
check((await r.json()).items.join() === "Milch", "Bring!-Liste lesen");
r = await call("/bring/sync", { method: "POST", body: { items: [{ name: "Rüebli", spec: "500 g" }, { name: "Lauch", spec: "2 Stk" }] } });
const sync = await r.json();
check(sync.ok && sync.pushed === 2, "2 Artikel an Bring! gesendet");
const put = bringCalls.find(c => c.init.method === "PUT");
const pj = JSON.parse(put.init.body);
check(sync.mode === "batch" && put.url.endsWith("/bringlists/list-1/items") && put.init.headers.Authorization === "Bearer tok" && /json/.test(put.init.headers["Content-Type"]), "Batch: PUT .../items mit JSON und Token");
check(pj.changes.length === 2 && pj.changes[0].itemId === "Rüebli" && pj.changes[0].spec === "500 g" && pj.changes[0].operation === "TO_PURCHASE" && pj.changes[0].uuid && pj.changes[0].uuid !== pj.changes[1].uuid, "Batch enthält Name, Menge, Operation und je eine neue uuid");
check(bringCalls.filter(c => c.init.method === "PUT").length === 1 && bringList.some(x => x.name === "Rüebli" && x.specification === "500 g"), "zwei Artikel = ein einziger PUT");
// Menge eines bestehenden Eintrags ändern: Batch mit dessen uuid (wie der Live-Test 1 Stk -> 3 Stk)
const rUuid = bringList.find(x => x.name === "Rüebli").uuid;
bringCalls.length = 0;
r = await call("/bring/sync", { method: "POST", body: { items: [{ name: "Rüebli", spec: "800 g" }] } });
let upd = await r.json();
const updPut = bringCalls.find(c => c.init.method === "PUT");
check(upd.mode === "batch" && JSON.parse(updPut.init.body).changes[0].uuid === rUuid, "Menge ändern: Batch mit der uuid des bestehenden Eintrags");
check(bringList.filter(x => x.name === "Rüebli").length === 1 && bringList.find(x => x.name === "Rüebli").specification === "800 g", "Menge auf Bring! geändert (500 g -> 800 g), kein doppelter Eintrag");
// Bring! antwortet 2xx, ändert aber nichts -> nachsehen und einzeln hinterher
batchIgnore = true; bringCalls.length = 0;
r = await call("/bring/sync", { method: "POST", body: { items: [{ name: "Rüebli", spec: "1 kg" }, { name: "Ign", spec: "1 Stk" }] } });
let ign = await r.json();
check(ign.ok && ign.pushed === 2 && ign.mode === "mixed" && bringList.find(x => x.name === "Rüebli").specification === "1 kg" && bringList.some(x => x.name === "Ign"), "Batch still ignoriert -> nachgesehen, einzeln nachgeschickt");
r = await call("/bring/remove", { method: "POST", body: { names: ["Ign"] } });
check((await r.json()).removed === 1 && !bringList.some(x => x.name === "Ign"), "Wegnehmen still ignoriert -> einzeln nachgeschickt");
batchIgnore = false;
await call("/bring/sync", { method: "POST", body: { items: [{ name: "Rüebli", spec: "500 g" }] } });
bringCalls.length = 0;
r = await call("/bring/sync", { method: "POST", body: { items: Array.from({ length: 60 }, (_, i) => ({ name: "x" + i })) } });
let big = await r.json();
check(r.status === 200 && big.pushed === 60 && big.mode === "batch" && bringCalls.filter(c => c.init.method === "PUT").length === 1, "60 Artikel (mehr als das alte Limit von 45) in einem einzigen Aufruf");
bringCalls.length = 0;
r = await call("/bring/remove", { method: "POST", body: { names: Array.from({ length: 60 }, (_, i) => "x" + i) } });
const bigRm = await r.json();
check(r.status === 200 && bigRm.removed === 60 && bringCalls.filter(c => c.init.method === "PUT").length === 1 && !bringList.some(x => /^x\d+$/.test(x.name)), "60 eigene Artikel in einem Aufruf wieder weg (Batch REMOVE)");
// Rückfall: lehnt Bring! den Batch ab, geht es wie früher einzeln
batchFail = true; bringCalls.length = 0;
r = await call("/bring/sync", { method: "POST", body: { items: [{ name: "Fa1", spec: "1" }, { name: "Fa2", spec: "2" }] } });
let fb = await r.json();
check(fb.ok && fb.pushed === 2 && fb.mode === "single" && bringList.some(x => x.name === "Fa2" && x.specification === "2"), "Batch abgelehnt (500) -> Rückfall auf Einzelversand, alles angekommen");
check(bringCalls.filter(c => c.init.method === "PUT" && !c.url.endsWith("/items")).length === 2, "Rückfall: je ein Aufruf pro Artikel");
r = await call("/bring/remove", { method: "POST", body: { names: ["Fa1", "Fa2"] } });
check((await r.json()).removed === 2 && !bringList.some(x => /^Fa/.test(x.name)), "Wegnehmen fällt ebenso zurück");
batchFail = false;
const own0 = (await (await call("/bring/list")).json()).mine;
check(!own0.includes("Fa1") && !own0.includes("x1"), "Bot vergisst Weggenommenes (Bot-Merkliste sauber)");
env.BRING_PASSWORD = "falsch";
r = await call("/bring/list");
check(r.status === 502 && /Bot-Kontos/.test((await r.json()).error), "verständlicher Fehler bei falschem Bot-Passwort");
env.BRING_PASSWORD = "pw";

// 2a. Nur eigene Artikel wegnehmen
r = await call("/bring/list");
let lst = await r.json();
check(lst.mine.includes("Rüebli") && !lst.mine.includes("Milch"), "Bot kennt seine eigenen Artikel (Rüebli ja, Milch nein)");
bringList.splice(bringList.findIndex(x => x.name === "Lauch"), 1); // jemand hat Lauch in Bring! abgehakt
r = await call("/bring/remove", { method: "POST", body: { names: ["Rüebli", "Milch", "Lauch"] } });
const rm = await r.json();
check(rm.removed === 1 && rm.notMine.join() === "Milch" && rm.gone.join() === "Lauch", "entfernt nur Eigenes, lässt Milch (von jemand anderem), Lauch schon weg");
check(!bringList.some(x => x.name === "Rüebli") && bringList.some(x => x.name === "Milch"), "Rüebli weg, Milch bleibt");
await call("/bring/sync", { method: "POST", body: { items: [{ name: "Milch", spec: "2 l" }] } });
r = await call("/bring/remove", { method: "POST", body: { names: ["Milch"] } });
check((await r.json()).notMine.join() === "Milch", "Milch bleibt fremd, auch wenn der Bot die Menge ergänzt");

// 2c. Gemeinsamer Grundvorrat
r = await call("/vorrat");
check((await r.json()).staples === null, "Vorrat anfangs leer");
r = await call("/vorrat", { method: "PUT", body: { staples: [{ id: "salz", name: "Salz", in_stock: false }] } });
const vu = (await r.json()).updated;
r = await call("/vorrat");
const vr = await r.json();
check(vr.staples[0].in_stock === false && vr.updated === vu, "Vorrat gespeichert (für alle Handys)");
r = await call("/vorrat", { method: "PUT", body: { staples: "kaputt" } });
check(r.status === 400, "ungültiger Vorrat abgelehnt");

// 2d. WG-Einstellungen
r = await call("/settings");
check((await r.json()).settings === null, "Einstellungen anfangs leer");
const five = ["Joshua", "Lukas", "Leonie", "Jo", "Mia"].map(n => ({ id: n.toLowerCase(), name: n, diet: n === "Jo" ? "vegi" : "fleisch" }));
r = await call("/settings", { method: "PUT", body: { settings: { members: five, dinnerTime: "19:00", recipeSites: [{ name: "Blog", url: "https://blog.example.ch" }], customRecipes: [] } } });
const su = (await r.json()).updated;
r = await call("/settings");
const sg = await r.json();
check(sg.settings.members.length === 5 && sg.settings.dinnerTime === "19:00" && sg.updated === su, "WG-Einstellungen gespeichert (5 Mitbewohner, Znacht 19:00)");
r = await call("/settings", { method: "PUT", body: { settings: { members: [] } } });
check(r.status === 400, "Einstellungen ohne Mitbewohner abgelehnt");

// 2b. Liste wählen
r = await call("/bring/lists");
let ls = await r.json();
check(ls.lists.length === 3 && ls.active === "list-1" && ls.lists.some(l => l.name === "Home-test"), "ohne eigene Liste: alle Listen des Bots, «Home-test» als Spielwiese");
r = await call("/bring/target", { method: "PUT", body: { uuid: "gibts-nicht" } });
check(r.status === 400, "unbekannte Liste wird abgelehnt");
r = await call("/bring/target", { method: "PUT", body: { uuid: "list-wg" } });
check((await r.json()).name === "WG", "WG-Liste gewählt");
await call("/bring/sync", { method: "POST", body: { items: [{ name: "Zwiebeln", spec: "1 kg" }] } });
check(wgPuts.includes("Zwiebeln"), "Artikel landen danach in der gewählten Liste");
ls = await (await call("/bring/lists")).json();
check(!ls.lists.some(l => l.name === "Home-test"), "mit eigener Liste: «Home-test» nicht mehr wählbar");
r = await call("/bring/target", { method: "PUT", body: { uuid: "list-1" } });
check(r.status === 400, "mit eigener Liste: zurück auf «Home-test» abgelehnt");
store.delete("bringList");

// 3. Wochenwahl
await call("/week/2026-W46/candidates", { method: "PUT", body: { candidates: ["a", "b", "c"] } });
await call("/week/2026-W46/vote/joshua", { method: "PUT", body: { likes: ["a"], days: { a: 4 } } });
await call("/week/2026-W46/vote/jo", { method: "PUT", body: { likes: ["a", "b"] } });
const wk = await (await call("/week/2026-W46")).json();
check(wk.candidates.join() === "a,b,c" && wk.votes.joshua.days.a === 4 && wk.votes.jo.likes.length === 2, "Stimmen pro Person getrennt gespeichert");

// 4. Plan + Kalender
const plan = Array.from({ length: 7 }, (_, i) => ({ title: i === 2 ? "Lauchwähe, mit Käseguss" : `Gericht ${i}`, eaters: i === 6 ? [] : ["joshua", "jo"], leftover_buffer: 2, source_url: i === 2 ? "https://www.bettybossi.ch/x" : "" }));
r = await call("/plan", { method: "PUT", body: { week: "2026-W46", plan, members: [{ id: "joshua", name: "Joshua" }, { id: "jo", name: "Jo" }] } });
check(r.status === 200, "Plan gespeichert");
r = await call("/cal/falsch.ics", { pin: null });
check(r.status === 404, "Kalender mit falschem Token -> 404");
r = await call("/cal/cal-secret.ics", { pin: null });
const ics = await r.text();
check(r.headers.get("Content-Type").startsWith("text/calendar"), "Kalender als text/calendar");
check((ics.match(/BEGIN:VEVENT/g) || []).length === 6, "6 Znacht-Termine (Sonntag niemand zuhause)");
check(ics.includes("DTSTART;TZID=Europe/Zurich:20261111T183000"), "Mittwoch KW46 = 11.11.2026 um 18:30");
check(ics.includes("SUMMARY:🍲 Lauchwähe\\, mit Käseguss"), "Titel korrekt escaped");
check(ics.includes("Es essen: Joshua\\, Jo"), "wer isst steht in der Beschreibung");
check(ics.split("\r\n").every(l => new TextEncoder().encode(l).length <= 75), "Zeilen nach RFC 5545 gefaltet");

// 4b. Nächste Woche (ab Donnerstag geplant): eigener Plan, im Kalender dabei, offene Tage ohne Termin
const nextPlan = plan.map((d, i) => (i < 2 ? { ...d, title: `Nächste ${i}` } : { title: "noch offen", empty: true, eaters: ["joshua"] }));
r = await call("/plan/2026-W47", { method: "PUT", body: { plan: nextPlan, members: [{ id: "joshua", name: "Joshua" }] } });
check(r.status === 200, "Plan für KW 47 gespeichert");
const got = await (await call("/plan/2026-W47")).json();
check(got.week === "2026-W47" && got.plan[0].title === "Nächste 0", "Plan KW 47 lesbar");
check((await (await call("/plan")).json()).week === "2026-W46", "laufender Plan bleibt KW 46");
const ics2 = await (await call("/cal/cal-secret.ics", { pin: null })).text();
check((ics2.match(/BEGIN:VEVENT/g) || []).length === 8 && ics2.includes("DTSTART;TZID=Europe/Zurich:20261116T183000"), "Kalender zeigt auch die nächste Woche (nur geplante Tage)");
// 4b2. Persönliches Abo (?me=), Zeit pro Tag, «Diese Woche herunterladen» (?week=&dl=1)
const plan3 = plan.map((d, i) => (i === 0 ? { ...d, eaters: ["joshua"], time: "20:15", time_by: "Joshua" } : d));
await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: plan3, members: [{ id: "joshua", name: "Joshua" }, { id: "jo", name: "Jo" }] } });
const icsJo = await (await call("/cal/cal-secret.ics?me=jo", { pin: null })).text();
check((icsJo.match(/BEGIN:VEVENT/g) || []).length === 7 && icsJo.includes("X-WR-CALNAME:BringFrisch Znacht (Jo)"), `persönliches Abo: nur Jos Abende (${(icsJo.match(/BEGIN:VEVENT/g) || []).length})`);
const icsJoshua = await (await call("/cal/cal-secret.ics?me=joshua", { pin: null })).text();
check(icsJoshua.includes("DTSTART;TZID=Europe/Zurich:20261109T201500") && icsJoshua.replace(/\r\n /g, "").includes("Zeit geändert von Joshua"), "Zeit pro Tag: 20:15 im Kalender, mit wer sie geändert hat");
r = await call("/cal/cal-secret.ics?me=jo&week=2026-W47&dl=1", { pin: null });
const icsDl = await r.text();
check((icsDl.match(/BEGIN:VEVENT/g) || []).length === 2 && /attachment; filename="BringFrisch-2026-W47.ics"/.test(r.headers.get("Content-Disposition")) && icsDl.includes("UID:bringfrisch-dl-2026-W47-0-jo@"), "herunterladen: nur diese Woche, nur meine Abende, als Datei mit eigenen Termin-IDs");

// 4c. Test-Server: schreibt nur in die Liste «Home-test», nie in die WG-Liste
const stageEnv = { ...env, ONLY_LIST_NAME: "Neu-test,home test" }; // erster Name fehlt -> zweiter gilt (Liste noch nicht umbenannt)
const stageCall = (path, opts = {}) => worker.fetch(new Request("https://stage.example" + path, {
  method: opts.method || "GET",
  headers: { Origin: "https://bringfrisch-test.bringfrisch-worker.workers.dev", "Content-Type": "application/json", "X-WG-PIN": "1234" },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
}), stageEnv);
store.set("bringList", "list-wg"); // selbst wenn die WG-Liste gespeichert ist …
r = await stageCall("/bring/lists");
check(r.headers.get("Access-Control-Allow-Origin") === "https://bringfrisch-test.bringfrisch-worker.workers.dev", "CORS für die Test-Seite");
ls = await r.json();
check(ls.active === "list-1" && ls.lists.length === 1 && ls.lists[0].name === "Home-test", "Test-Server zeigt nur «Home-test»");
r = await stageCall("/bring/target", { method: "PUT", body: { uuid: "list-wg" } });
check(r.status === 400, "Test-Server kann nicht auf die WG-Liste umgestellt werden");
const wgBefore = wgPuts.length;
await stageCall("/bring/sync", { method: "POST", body: { items: [{ name: "Stage Test", spec: "1 Stk" }] } });
check(wgPuts.length === wgBefore && bringList.some(x => x.name === "Stage Test"), "Test-Server schreibt in «Home-test», nicht in die WG-Liste");
store.delete("bringList");

// 4d. Rezeptbild für die Wochenwahl: einmal von der Seite holen, im Server ablegen, nur mit PIN
const IMG_PAGE = "https://fooby.ch/de/rezepte/1/bild";
r = await call("/img?url=" + encodeURIComponent(IMG_PAGE), { pin: "falsch" });
check(r.status === 401, "Bild nur mit WG-PIN");
r = await call("/img?url=" + encodeURIComponent(IMG_PAGE));
const img1 = new Uint8Array(await r.arrayBuffer());
check(r.status === 200 && r.headers.get("Content-Type") === "image/jpeg" && img1.length === 6 && imgFetches === 1, `Bild von der Rezeptseite geholt (og:image, relativ + &amp;) (${r.status})`);
r = await call("/img?url=" + encodeURIComponent(IMG_PAGE));
check(r.status === 200 && (await r.arrayBuffer()).byteLength === 6 && imgFetches === 1, "zweites Mal aus dem Speicher (kein neuer Abruf)");
r = await call("/img?url=" + encodeURIComponent("https://fooby.ch/de/rezepte/2/ohne"));
await call("/img?url=" + encodeURIComponent("https://fooby.ch/de/rezepte/2/ohne"));
check(r.status === 204 && imgFetches === 2, "Seite ohne Bild: 204 (leer, kein Fehler), und der Server fragt nicht nochmals");
check((await call("/img?url=" + encodeURIComponent("http://localhost/x"))).status === 400, "nur normale https-Seiten");
const BB = "https://www.bettybossi.ch/de/rezepte/rezept/gross-1/";
const bbKey = "img:" + [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(BB)))].map(b => b.toString(16).padStart(2, "0")).join("");
store.set(bbKey, ""); kvOpts.set(bbKey, { metadata: { none: true } }); // «kein Bild» aus der alten Version (Bild war zu gross)
r = await call("/img?url=" + encodeURIComponent(BB));
check(r.status === 200 && (await r.arrayBuffer()).byteLength === 4 && imgFetches === 3, `Betty Bossi: kleine Fassung (-B640) statt 2 MB; altes «kein Bild» wird neu geprüft (${r.status}, ${imgFetches})`);
await backup(env, new Date("2026-11-10T03:00:00Z"));
check(!Object.keys(JSON.parse(store.get("backup:2026-11-10")).keys).some(k => k.startsWith("img:")), "Bilder nicht in der täglichen Sicherung");

// 5. Rezept-Link
r = await call("/recipe?url=" + encodeURIComponent("https://www.bettybossi.ch/de/rezepte/rezept/zwiebelsuppe-10010500/"));
const rec = await r.json();
check(rec.title === "Zwiebelsuppe" && rec.servings === 4 && rec.minutes === 46 && rec.ingredients.length === 2, "Rezept-Link wird ausgelesen");
r = await call("/recipe?url=" + encodeURIComponent("https://www.swissmilk.ch/de/rezepte/x/"));
const sm = await r.json();
check(sm.title === "Auberginenrollen" && sm.ingredients.join("|") === "50 g Ingwer|2 Auberginen", `Swissmilk: Titel und Zutaten aus den Tabellenzeilen, ohne Bratpfanne (${sm.title}: ${sm.ingredients})`);
r = await call("/recipe?url=" + encodeURIComponent("Schau mal: https://blog.example.ch/roesti 😋"));
const bl = await r.json();
check(bl.title === "Omas Rösti" && bl.servings === 2 && bl.ingredients.length === 2, "jede Rezeptseite geht, Link aus geteiltem Text, &#246; wird ö");
r = await call("/recipe?url=" + encodeURIComponent("http://localhost:8787/x"));
check(r.status === 400, "interne Adressen werden abgelehnt");
r = await call("/recipe?url=" + encodeURIComponent("nur Text ohne Link"));
check(r.status === 400, "Text ohne Link: klare Meldung");

// 6. Tägliche Sicherung (Cron)
const b1 = await backup(env, new Date("2026-11-10T03:00:00Z"));
const snap = JSON.parse(store.get("backup:2026-11-10"));
check(b1.count > 0 && snap.keys.plan && snap.keys.vorrat, `Sicherung enthält Plan und Vorrat (${b1.count} Einträge)`);
check(kvOpts.get("backup:2026-11-10").expirationTtl === 30 * 86400, "Sicherung läuft nach 30 Tagen ab");
await worker.scheduled({ scheduledTime: Date.parse("2026-11-11T03:00:00Z") }, env);
check(!JSON.parse(store.get("backup:2026-11-11")).keys["backup:2026-11-10"], "Sicherung sichert keine alten Sicherungen");
r = await call("/backup");
check((await r.json()).days.join() === "2026-11-11,2026-11-10", "/backup listet die Tage, neueste zuerst");
r = await call("/backup/2026-11-10");
check(r.status === 200 && (await r.json()).keys.vorrat, "/backup/:tag liefert die Sicherung");
r = await call("/backup/2026-11-10", { pin: "falsch" });
check(r.status === 401, "Sicherung nur mit PIN");

// 7. Zweite WG (gleicher Server, eigene Daten, gleicher Bot mit eigener Bring!-Liste)
store.set("wgs:sonnenhof", JSON.stringify({ name: "Sonnenhof", salt: "s1", pinHash: await pinHash("s1", "9876"), calToken: "cal-sonnenhof-0123456789" }));
store.set("cal:cal-sonnenhof-0123456789", "sonnenhof");
const sh = (path, o = {}) => call(path, { wg: "Sonnenhof", pin: "9876", ...o });
r = await sh("/wg");
check(r.status === 200 && (await r.json()).name === "Sonnenhof", "zweite WG: WG-Name (gross/klein egal) + PIN verbindet");
r = await call("/wg", { wg: "sonnenhof", pin: "1234" });
check(r.status === 401, "zweite WG: PIN der ersten WG passt nicht");
r = await call("/wg", { wg: "gibtsnicht", pin: "9876" });
check(r.status === 401, "unbekannte WG -> 401");
r = await sh("/settings");
check((await r.json()).settings === null, "zweite WG sieht die Einstellungen der ersten nicht");
const mainPlanBefore = store.get("plan");
r = await sh("/plan", { method: "PUT", body: { week: "2026-W46", plan: Array.from({ length: 7 }, (_, i) => ({ title: i ? "" : "Sonnenhof-Risotto", eaters: ["mia"] })), members: [{ id: "mia", name: "Mia" }] } });
check(r.status === 200 && store.get("plan") === mainPlanBefore && JSON.parse(store.get("w:sonnenhof:plan")).plan[0].title === "Sonnenhof-Risotto", "Plan der zweiten WG liegt getrennt");
await sh("/week/2026-W46/vote/mia", { method: "PUT", body: { likes: ["x"] } });
check(!(await (await call("/week/2026-W46")).json()).votes.mia && (await (await sh("/week/2026-W46")).json()).votes.mia, "Stimmen getrennt pro WG");
r = await sh("/bring/list");
check(r.status === 409, "zweite WG ohne gewählte Liste schreibt nirgends hin (409)");
r = await sh("/bring/lists");
ls = await r.json();
check(ls.active === null && ls.lists.map(l => l.uuid).join() === "list-1,list-sh", `zweite WG sieht die Liste der ersten nicht, aber die Spielwiese (${ls.lists.map(l => l.name)})`);
r = await sh("/bring/target", { method: "PUT", body: { uuid: "list-wg" } });
check(r.status === 400, "zweite WG kann die Liste der ersten nicht wählen");
r = await sh("/bring/target", { method: "PUT", body: { uuid: "list-1" } });
check(r.status === 200 && store.get("w:sonnenhof:bringList") === "list-1" && !store.has("listowner:list-1"), "zweite WG ohne eigene Liste: «Home-test» zum Ausprobieren, gehört ihr nicht");
r = await sh("/bring/target", { method: "PUT", body: { uuid: "list-sh" } });
check(r.status === 200 && store.get("w:sonnenhof:bringList") === "list-sh" && store.get("listowner:list-sh") === "sonnenhof", "zweite WG wählt ihre Liste");
ls = await (await call("/bring/lists")).json();
check(!ls.lists.some(l => l.uuid === "list-sh"), "erste WG sieht die Liste der zweiten nicht mehr");
r = await call("/cal/cal-sonnenhof-0123456789.ics", { pin: null });
check(r.status === 200 && (await r.text()).includes("Sonnenhof-Risotto"), "Kalender-Abo der zweiten WG zeigt ihren Plan");
check((await (await sh("/cal-link")).json()).url.endsWith("/cal/cal-sonnenhof-0123456789.ics"), "Kalender-Link pro WG");

// 7b. Geteilte Rezepte: eigene Rezepte sind für alle WGs sichtbar (ausser abgewählt), Stimmen bleiben pro WG
{
const smem = [{ id: "a", name: "A" }];
const srec = (id, title, extra = {}) => ({ id, title, diet: "vegi", servings: 4, ingredients: [{ name: "Lauch", amount: "500", unit: "g" }], ...extra });
r = await call("/settings", { method: "PUT", body: { settings: { members: smem, customRecipes: [srec("custom-1", "Mamas Lauchgratin", { instructions: "Ofen 200°" }), srec("custom-2", "Geheimrezept", { shared: false })] } } });
check(r.status === 200, "erste WG speichert zwei eigene Rezepte (eins nicht geteilt)");
let shr = await (await sh("/recipes/shared")).json();
const got = shr.recipes.find(x => x.title === "Mamas Lauchgratin");
check(!!got && got.id.startsWith("x-") && got.id.endsWith("-custom-1") && got.shared_from === true && got.ingredients[0].name === "Lauch" && got.instructions === "Ofen 200°", `zweite WG sieht das geteilte Rezept der ersten (${got && got.id}), ohne WG-Namen`);
check(!shr.recipes.some(x => x.title === "Geheimrezept"), "abgewähltes Rezept bleibt in der eigenen WG");
check((await (await call("/recipes/shared")).json()).recipes.length === 0, "eigene Rezepte kommen nicht doppelt zurück");
r = await sh("/settings", { method: "PUT", body: { settings: { members: smem, customRecipes: [srec("custom-1", "Sonnenhof-Curry")] } } });
const fromMain = (await (await call("/recipes/shared")).json()).recipes;
check(fromMain.length === 1 && fromMain[0].title === "Sonnenhof-Curry" && fromMain[0].shared_from === true && !JSON.stringify(fromMain).includes("Sonnenhof\""), "erste WG sieht das Rezept der zweiten (gleiche eigene id, trotzdem getrennt)");
check((await (await sh("/recipes/shared")).json()).recipes.some(x => x.title === "Mamas Lauchgratin"), "zweite WG überschreibt die Rezepte der ersten nicht");
r = await call("/settings", { method: "PUT", body: { settings: { members: smem, customRecipes: [] } } });
check(!(await (await sh("/recipes/shared")).json()).recipes.some(x => x.title === "Mamas Lauchgratin"), "gelöschtes Rezept verschwindet auch bei den anderen");
r = await call("/recipes/shared", { pin: "0000" });
check(r.status === 401, "geteilte Rezepte nur mit PIN");
}
env.MAIN_WG = "Bärenhaus";
r = await call("/wg", { wg: "barenhaus" });
check(r.status === 200 && (await r.json()).main, "erste WG geht auch mit ihrem Namen (Umlaute egal)");
env.MAIN_WG = "allmen,wg1";
r = await call("/wg", { wg: "WG1" });
check(r.status === 200 && (await r.json()).main, "erste WG: alter Name (wg1) geht weiter");
r = await call("/wg", { wg: "Allmen" });
check(r.status === 200 && (await r.json()).name === "allmen", "erste WG: neuer Name (Allmen) geht");
store.set("listowner:list-wg", "wg1");
ls = await (await call("/bring/lists", { wg: "allmen" })).json();
check(ls.lists.some(l => l.uuid === "list-wg"), "Liste, die unter altem Namen gewählt wurde, bleibt wählbar");
delete env.MAIN_WG;
await call("/wg", { wg: "Gibtsnicht", pin: "0000" });
const snap0 = { has: p => [...store.keys()].some(k => k.startsWith(p)) };
for (let i = 0; i < 10; i++) await call("/wg", { wg: "Sonnenhof", pin: "0000" });
r = await sh("/wg");
check(r.status === 429, "nach 10 falschen PINs ist die WG kurz gesperrt");
// Bring!-Anmeldung wird gemerkt: kein neuer Login pro Aufruf; lehnt Bring! sie ab (401), einmal frisch anmelden
{
  const logins = () => bringCalls.filter(c => c.url.endsWith("/bringauth")).length;
  await call("/bring/list");
  const n = logins();
  await call("/bring/list"); await call("/bring/list");
  check(logins() === n, `zwei weitere Aufrufe ohne neuen Bring!-Login (${logins() - n})`);
  expireToken = true; // Bring! kennt die gemerkte Anmeldung nicht mehr
  r = await call("/bring/list");
  check(r.status === 200 && logins() === n + 1, `abgelaufene Anmeldung: einmal neu angemeldet, Aufruf klappt (${r.status}, ${logins() - n})`);
  const snapT = JSON.parse(store.get("backup:" + (await backup(env, new Date("2026-11-13T03:00:00Z"))).day)).keys;
  check(store.has("bringtoken") && !("bringtoken" in snapT), "gemerkte Anmeldung liegt im Speicher, aber nicht in der Sicherung");
}
// Abgleich: «base» = Stempel, auf dem die Änderung aufbaut
{
  const week7 = t => Array.from({ length: 7 }, (_, i) => ({ title: t + i, eaters: [] }));
  let p = await (await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: week7("a") } })).json();
  const first = p.updated;
  p = await (await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: week7("b"), base: first } })).json();
  check(p.ok && p.updated > first, "Plan mit passendem «base» wird gespeichert, Stempel steigt");
  r = await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: week7("c"), base: first } });
  const conflict = await r.json();
  check(r.status === 409 && conflict.conflict && conflict.plan[0].title === "b0" && conflict.updated === p.updated, "veraltetes «base»: 409 mit dem aktuellen Stand, nichts überschrieben");
  r = await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: week7("d") } });
  check(r.status === 200 && (await (await call("/plan")).json()).plan[0].title === "d0", "ohne «base» (ältere App) wie bisher: neuer Stand ersetzt den alten");
  r = await call("/vorrat", { method: "PUT", body: { staples: [{ name: "x" }], base: 1 } });
  check(r.status === 409 || r.status === 200, "Vorrat nimmt «base» an");
  r = await call("/settings", { method: "PUT", body: { settings: { members: [{ id: "a", name: "A" }] }, base: 12345 } });
  check(r.status === 409, "Einstellungen: veraltetes «base» wird abgelehnt");
  // Die App kennt schon einen neueren Stand als der Speicher gerade liefert (KV liest kurz nach dem Speichern alt): kein Konflikt
  const cur = await (await call("/plan")).json();
  r = await call("/plan", { method: "PUT", body: { week: "2026-W46", plan: week7("e"), base: cur.updated + 5000 } });
  const later = await r.json();
  check(r.status === 200 && later.updated > cur.updated + 5000, "«base» neuer als der gelesene Stand: wird gespeichert, Stempel liegt darüber");
}
check(!snap0.has("fail:gibtsnicht:"), "unbekannter WG-Name schreibt nichts in den Speicher (Gratis-Kontingent)");
// Sperre gilt pro Absender: ein anderes Handy (andere IP) kommt weiter rein
const from = (ip, pin) => worker.fetch(new Request("https://bf.example.workers.dev/wg", { headers: { Origin: ORIGIN, "X-WG-PIN": pin, "CF-Connecting-IP": ip } }), env);
for (let i = 0; i < 10; i++) await from("203.0.113.9", "0000");
r = await from("203.0.113.9", "1234");
check(r.status === 429, "erste WG: nach 10 falschen PINs ist dieser Absender gesperrt (auch mit richtigem PIN)");
r = await from("198.51.100.7", "1234");
check(r.status === 200, "erste WG: andere Absender sind nicht mitgesperrt");
// Rezept-Link: Weiterleitungen werden geprüft
r = await call("/recipe?url=" + encodeURIComponent("https://fooby.ch/de/intern"));
check(r.status === 400 && internFetches === 0, `Weiterleitung auf eine interne Adresse wird nicht abgerufen (${r.status})`);
r = await call("/img?url=" + encodeURIComponent("https://fooby.ch/de/weiter"));
check(r.status === 204, `normale Weiterleitung wird gefolgt, Seite ohne Bild = 204 (${r.status})`);
const b3 = await backup(env, new Date("2026-11-12T03:00:00Z"));
const snap3 = JSON.parse(store.get("backup:2026-11-12")).keys;
check(snap3["w:sonnenhof:plan"] && !snap3["lock:sonnenhof"], `Sicherung enthält die zweite WG, keine Sperren (${b3.count})`);

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
