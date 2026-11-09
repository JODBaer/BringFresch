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
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  bringCalls.push({ url, init });
  if (url.endsWith("/bringauth")) {
    const p = new URLSearchParams(init.body);
    if (p.get("password") !== "pw") return new Response("", { status: 401 });
    return Response.json({ uuid: "u1", access_token: "tok", bringListUUID: "list-1" });
  }
  if (url.includes("/bringlists/list-1") && (init.method || "GET") === "GET") return Response.json({ purchase: bringList });
  if (url.includes("/bringlists/list-1") && init.method === "PUT") {
    const p = new URLSearchParams(init.body);
    bringList.push({ name: p.get("purchase"), specification: p.get("specification") });
    return new Response(null, { status: 204 });
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

// 5. Rezept-Link
r = await call("/recipe?url=" + encodeURIComponent("https://www.bettybossi.ch/de/rezepte/rezept/zwiebelsuppe-10010500/"));
const rec = await r.json();
check(rec.title === "Zwiebelsuppe" && rec.servings === 4 && rec.minutes === 46 && rec.ingredients.length === 2, "Rezept-Link wird ausgelesen");
r = await call("/recipe?url=" + encodeURIComponent("https://example.com/x"));
check(r.status === 400, "fremde Rezept-Seiten werden abgelehnt");

console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
