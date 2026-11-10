// Offline-Test für den Worker: Bring! und KV werden simuliert. Start: node worker/test.mjs
import worker from "./src/index.js";

let fails = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

// --- KV-Attrappe
const store = new Map();
const KV = {
  async get(k, type) { const v = store.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); },
  async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
};
const env = { WG: KV, WG_PIN: "1234", CAL_TOKEN: "cal-secret", BRING_EMAIL: "bot@example.ch", BRING_PASSWORD: "pw" };

// --- Bring!-Attrappe
const bringCalls = [];
const bringList = [{ name: "Milch", specification: "" }];
const wgPuts = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  bringCalls.push({ url, init });
  if (url.endsWith("/bringauth")) {
    const p = new URLSearchParams(init.body);
    if (p.get("password") !== "pw") return new Response("", { status: 401 });
    return Response.json({ uuid: "u1", access_token: "tok", bringListUUID: "list-1" });
  }
  if (url.endsWith("/bringusers/u1/lists")) return Response.json({ lists: [{ listUuid: "list-1", name: "Home" }, { listUuid: "list-wg", name: "WG" }] });
  if (url.includes("/bringlists/list-wg") && (init.method || "GET") === "GET") return Response.json({ items: { purchase: wgPuts.map(n => ({ itemId: n })) } });
  if (url.includes("/bringlists/list-wg") && init.method === "PUT") { wgPuts.push(new URLSearchParams(init.body).get("purchase")); return new Response(null, { status: 204 }); }
  if (url.includes("/bringlists/list-1") && (init.method || "GET") === "GET") return Response.json({ purchase: bringList });
  if (url.includes("/bringlists/list-1") && init.method === "PUT") {
    const p = new URLSearchParams(init.body);
    if (p.get("remove")) { const i = bringList.findIndex(x => x.name === p.get("remove")); if (i >= 0) bringList.splice(i, 1); return new Response(null, { status: 204 }); }
    const ex = bringList.find(x => x.name === p.get("purchase"));
    if (ex) ex.specification = p.get("specification"); else bringList.push({ name: p.get("purchase"), specification: p.get("specification") });
    return new Response(null, { status: 204 });
  }
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

const ORIGIN = "https://jodbaer.github.io";
const call = (path, { method = "GET", pin = "1234", body, origin = ORIGIN } = {}) =>
  worker.fetch(new Request("https://bf.example.workers.dev" + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", ...(pin ? { "X-WG-PIN": pin } : {}) },
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
check(new URLSearchParams(put.init.body).get("specification") === "500 g" && put.init.headers.Authorization === "Bearer tok", "PUT mit Menge und Token");
r = await call("/bring/sync", { method: "POST", body: { items: Array.from({ length: 60 }, (_, i) => ({ name: "x" + i })) } });
check(r.status === 400, "mehr als 45 Artikel werden abgewiesen (Free-Plan-Limit)");
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

// 2b. Liste wählen
r = await call("/bring/lists");
let ls = await r.json();
check(ls.lists.length === 2 && ls.active === "list-1", "Listen des Bot-Kontos + aktive Liste");
r = await call("/bring/target", { method: "PUT", body: { uuid: "gibts-nicht" } });
check(r.status === 400, "unbekannte Liste wird abgelehnt");
r = await call("/bring/target", { method: "PUT", body: { uuid: "list-wg" } });
check((await r.json()).name === "WG", "WG-Liste gewählt");
await call("/bring/sync", { method: "POST", body: { items: [{ name: "Zwiebeln", spec: "1 kg" }] } });
check(wgPuts.includes("Zwiebeln"), "Artikel landen danach in der gewählten Liste");
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

// 4c. Test-Server: schreibt nur in die Liste «Home», nie in die WG-Liste
const stageEnv = { ...env, ONLY_LIST_NAME: "Home" };
const stageCall = (path, opts = {}) => worker.fetch(new Request("https://stage.example" + path, {
  method: opts.method || "GET",
  headers: { Origin: "https://bringfrisch-test.bringfrisch-worker.workers.dev", "Content-Type": "application/json", "X-WG-PIN": "1234" },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
}), stageEnv);
store.set("bringList", "list-wg"); // selbst wenn die WG-Liste gespeichert ist …
r = await stageCall("/bring/lists");
check(r.headers.get("Access-Control-Allow-Origin") === "https://bringfrisch-test.bringfrisch-worker.workers.dev", "CORS für die Test-Seite");
ls = await r.json();
check(ls.active === "list-1" && ls.lists.length === 1 && ls.lists[0].name === "Home", "Test-Server zeigt nur «Home»");
r = await stageCall("/bring/target", { method: "PUT", body: { uuid: "list-wg" } });
check(r.status === 400, "Test-Server kann nicht auf die WG-Liste umgestellt werden");
const wgBefore = wgPuts.length;
await stageCall("/bring/sync", { method: "POST", body: { items: [{ name: "Stage Test", spec: "1 Stk" }] } });
check(wgPuts.length === wgBefore && bringList.some(x => x.name === "Stage Test"), "Test-Server schreibt in «Home», nicht in die WG-Liste");
store.delete("bringList");

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

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
