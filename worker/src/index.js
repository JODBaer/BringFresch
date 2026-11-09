// BringFrisch Worker: kleine Brücke zwischen der Handy-App und Bring! + gemeinsamer WG-Speicher.
//
// Endpunkte (alle ausser /health und /cal brauchen den Header X-WG-PIN):
//   GET  /health                      -> { ok: true }
//   GET  /bring/list                  -> { items: ["Rüebli", ...] }  (was schon auf der Bring!-Liste steht)
//   POST /bring/sync  {items:[{name,spec}]} -> { ok, pushed, errors }
//   GET  /week/:week                  -> { candidates, votes }      (Wochenwahl, week = "2026-W46")
//   PUT  /week/:week/candidates {candidates:[ids]}
//   PUT  /week/:week/vote/:member {likes:[ids], days:{id:dayIdx}}
//   GET  /plan                        -> { week, plan, members, updated }
//   PUT  /plan {week, plan, members}
//   GET  /recipe?url=…                -> { title, servings, ingredients[], minutes }  (Rezept-Link importieren)
//   GET/PUT /vorrat                   -> gemeinsamer Grundvorrat der WG
//   GET  /cal-link                    -> { url } Abo-Link für den Kalender
//   GET  /cal/:token.ics              -> Kalender-Abo (iCal) mit allen Znacht der Woche
//
// Secrets (npx wrangler secret put …): BRING_EMAIL, BRING_PASSWORD, WG_PIN, CAL_TOKEN
// Optional: BRING_LIST_UUID (sonst die Standardliste des Bot-Kontos)
// KV-Binding: WG

const BRING = "https://api.getbring.com/rest/v2/";
// Öffentlicher Schlüssel der Bring!-Web-App (aus python-bring-api übernommen)
const BRING_HEADERS = {
  "X-BRING-API-KEY": "cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp",
  "X-BRING-CLIENT": "webApp",
  "X-BRING-CLIENT-SOURCE": "webApp",
  "X-BRING-COUNTRY": "CH",
};
const ALLOWED_ORIGINS = [/^https:\/\/jodbaer\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const RECIPE_HOSTS = /(^|\.)(bettybossi\.ch|migros\.ch|fooby\.ch|swissmilk\.ch|chefkoch\.de)$/;
const MAX_ITEMS = 45; // Free-Plan: 50 Unteranfragen pro Aufruf (1 Login + 1 Liste + Artikel)

// ---------------------------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      const res = await route(request, env, url);
      Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    } catch (err) {
      const status = err.status || 500;
      return json({ ok: false, error: err.message || "Unbekannter Fehler" }, status, cors);
    }
  },
};

async function route(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  if (path === "/health") return json({ ok: true });

  const cal = path.match(/^\/cal\/([^/]+)\.ics$/);
  if (cal && method === "GET") return calendar(env, cal[1]);

  requirePin(request, env);

  if (path === "/bring/list" && method === "GET") return json(await bringList(env));
  if (path === "/bring/lists" && method === "GET") return json(await bringLists(env));
  if (path === "/bring/target" && method === "PUT") return json(await bringSetTarget(env, await body(request)));
  if (path === "/bring/remove" && method === "POST") return json(await bringRemove(env, await body(request)));
  if (path === "/bring/sync" && method === "POST") return json(await bringSync(env, await body(request)));

  const week = path.match(/^\/week\/(\d{4}-W\d{2})(?:\/(candidates|vote)(?:\/([\w-]+))?)?$/);
  if (week) {
    const [, key, part, member] = week;
    if (!part && method === "GET") return json(await getWeek(env, key));
    if (part === "candidates" && method === "PUT") {
      const { candidates } = await body(request);
      if (!Array.isArray(candidates) || candidates.length > 40) throw httpError(400, "candidates ungültig");
      await env.WG.put(`week:${key}:candidates`, JSON.stringify(candidates.map(String)), { expirationTtl: 60 * 60 * 24 * 21 });
      return json({ ok: true });
    }
    if (part === "vote" && member && method === "PUT") {
      const { likes = [], days = {} } = await body(request);
      await env.WG.put(`week:${key}:vote:${member}`, JSON.stringify({ likes: likes.map(String), days }), { expirationTtl: 60 * 60 * 24 * 21 });
      return json({ ok: true });
    }
  }

  if (path === "/plan" && method === "GET") return json((await env.WG.get("plan", "json")) || { plan: null });
  if (path === "/plan" && method === "PUT") {
    const data = await body(request);
    if (!Array.isArray(data.plan) || data.plan.length !== 7) throw httpError(400, "plan ungültig");
    const doc = { week: data.week, plan: data.plan, members: data.members || [], dinnerTime: data.dinnerTime || "18:30", updated: Date.now() };
    await env.WG.put("plan", JSON.stringify(doc));
    return json({ ok: true, updated: doc.updated });
  }

  // Grundvorrat der WG – Wahrheit liegt in BringFrisch (Bring! sagt nur, was auf der Liste steht)
  if (path === "/vorrat" && method === "GET") return json((await env.WG.get("vorrat", "json")) || { staples: null, updated: 0 });
  if (path === "/vorrat" && method === "PUT") {
    const data = await body(request);
    if (!Array.isArray(data.staples) || data.staples.length > 300) throw httpError(400, "Vorrat ungültig");
    const doc = { staples: data.staples, updated: Date.now() };
    await env.WG.put("vorrat", JSON.stringify(doc));
    return json({ ok: true, updated: doc.updated });
  }

  if (path === "/recipe" && method === "GET") return json(await importRecipe(url.searchParams.get("url")));

  // Kalender-Link für die App (nur mit PIN sichtbar)
  if (path === "/cal-link" && method === "GET") {
    if (!env.CAL_TOKEN) throw httpError(500, "CAL_TOKEN nicht eingerichtet");
    return json({ url: `${url.origin}/cal/${env.CAL_TOKEN.trim()}.ics` });
  }

  throw httpError(404, "Unbekannter Endpunkt");
}

// ---------------------------------------------------------------------------------------------
// Hilfen
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "JSON erwartet");
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.some(re => re.test(origin));
  return ok
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-WG-PIN",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

function requirePin(request, env) {
  const pin = request.headers.get("X-WG-PIN") || "";
  if (!env.WG_PIN || !timingSafeEqual(pin, env.WG_PIN)) throw httpError(401, "Falscher WG-PIN");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------------------------
// Bring!
async function bringLogin(env) {
  if (!env.BRING_EMAIL || !env.BRING_PASSWORD) throw httpError(500, "Bring!-Zugang im Worker nicht eingerichtet");
  const res = await fetch(BRING + "bringauth", {
    method: "POST",
    headers: { ...BRING_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: env.BRING_EMAIL.trim(), password: env.BRING_PASSWORD }),
  });
  if (res.status === 401 || res.status === 400) {
    const why = await res.json().then(d => d.message || "", () => "");
    throw httpError(502, `Bring!-Login abgelehnt (E-Mail/Passwort des Bot-Kontos prüfen)${why ? ": " + why : ""}`);
  }
  if (!res.ok) throw httpError(502, `Bring!-Login fehlgeschlagen (${res.status})`);
  const data = await res.json();
  const chosen = await env.WG.get("bringList");
  const listUuid = chosen || env.BRING_LIST_UUID || data.bringListUUID;
  if (!data.uuid || !data.access_token || !listUuid) throw httpError(502, "Bring!-Antwort unvollständig");
  return {
    listUuid,
    userUuid: data.uuid,
    headers: { ...BRING_HEADERS, "X-BRING-USER-UUID": data.uuid, Authorization: `Bearer ${data.access_token}` },
  };
}

// Alle Listen des Bot-Kontos (zum Einrichten: welche ist die WG-Liste?)
async function bringLists(env) {
  const s = await bringLogin(env);
  const res = await fetch(`${BRING}bringusers/${s.userUuid}/lists`, { headers: s.headers });
  if (!res.ok) throw httpError(502, `Bring!-Listen nicht lesbar (${res.status})`);
  const data = await res.json();
  return { active: s.listUuid, lists: (data.lists || []).map(l => ({ uuid: l.listUuid, name: l.name })) };
}

// WG wählt in der App, in welche Bring!-Liste geschrieben wird (gilt für alle Handys)
async function bringSetTarget(env, { uuid }) {
  const { lists } = await bringLists(env);
  const hit = lists.find(l => l.uuid === uuid);
  if (!hit) throw httpError(400, "Liste nicht gefunden – ist sie mit dem Bot-Konto geteilt?");
  await env.WG.put("bringList", hit.uuid);
  return { ok: true, active: hit.uuid, name: hit.name };
}

// Liste mit Mengenangaben: [{ name, spec }]
async function bringDetails(s) {
  const res = await fetch(`${BRING}bringlists/${s.listUuid}`, { headers: s.headers });
  if (!res.ok) throw httpError(502, `Bring!-Liste nicht lesbar (${res.status})`);
  const data = await res.json();
  const purchase = (data.items && data.items.purchase) || data.purchase || [];
  return purchase.map(p => ({ name: p.name || p.itemId, spec: p.specification || "" }));
}
async function bringPurchase(s) {
  return (await bringDetails(s)).map(p => p.name);
}

// Was hat der Bot selbst auf die Liste gesetzt? Nur das darf er wieder wegnehmen.
const ownKey = s => `bot:${s.listUuid}`;
// own: { "rahm": { name: "Rahm", spec: "4 dl" } } – Menge, die der Bot zuletzt gesendet hat
async function loadOwn(env, s) {
  const raw = (await env.WG.get(ownKey(s), "json")) || {};
  for (const k of Object.keys(raw)) if (typeof raw[k] === "string") raw[k] = { name: raw[k], spec: "" }; // altes Format
  return raw;
}

async function bringList(env) {
  const s = await bringLogin(env);
  const details = await bringDetails(s);
  const own = await loadOwn(env, s);
  const onList = new Set(details.map(d => d.name.toLowerCase()));
  // Gekauft/abgehakt = nicht mehr drauf -> vergessen; trägt es später jemand neu ein, gehört es ihm
  const gone = Object.keys(own).filter(k => !onList.has(k));
  if (gone.length) { gone.forEach(k => delete own[k]); await env.WG.put(ownKey(s), JSON.stringify(own)); }
  const mineDetails = Object.values(own);
  return { items: details.map(d => d.name), details, mine: mineDetails.map(o => o.name), mineDetails };
}

function bringPut(s, params) {
  return fetch(`${BRING}bringlists/${s.listUuid}`, {
    method: "PUT",
    headers: { ...s.headers, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams(params),
  });
}

async function bringSync(env, { items }) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, "Keine Artikel");
  if (items.length > MAX_ITEMS) throw httpError(400, `Maximal ${MAX_ITEMS} Artikel pro Aufruf`);
  const s = await bringLogin(env);
  const before = new Set((await bringPurchase(s)).map(n => n.toLowerCase()));
  const own = await loadOwn(env, s);
  const spec = it => String(it.spec || "").slice(0, 80);
  let pushed = 0;
  const errors = [];
  for (const it of items) {
    const name = String(it.name || "").trim().slice(0, 80);
    if (!name) continue;
    const res = await bringPut(s, { purchase: name, specification: spec(it) });
    if (res.ok) {
      pushed++;
      const k = name.toLowerCase();
      if (!before.has(k) || own[k]) own[k] = { name, spec: spec(it) }; // neu oder schon vom Bot -> gehört ihm, Menge merken
    } else errors.push(`${name}: ${res.status}`);
  }
  await env.WG.put(ownKey(s), JSON.stringify(own));
  return { ok: errors.length === 0, pushed, errors };
}

// Artikel wieder wegnehmen – aber nur, was der Bot selbst gesetzt hat und noch drauf ist.
// Von anderen Gesetztes bleibt; schon Weggenommenes (gekauft/gelöscht) wird nur vergessen.
async function bringRemove(env, { names }) {
  if (!Array.isArray(names) || names.length === 0 || names.length > MAX_ITEMS) throw httpError(400, "Keine Artikel");
  const s = await bringLogin(env);
  const onList = new Set((await bringPurchase(s)).map(n => n.toLowerCase()));
  const own = await loadOwn(env, s);
  let removed = 0;
  const notMine = [], gone = [];
  for (const n of names) {
    const name = String(n || "").trim().slice(0, 80);
    const k = name.toLowerCase();
    if (!name) continue;
    if (!onList.has(k)) { gone.push(name); delete own[k]; continue; }
    if (!own[k]) { notMine.push(name); continue; }
    const res = await bringPut(s, { remove: name });
    if (res.ok) { removed++; delete own[k]; }
  }
  await env.WG.put(ownKey(s), JSON.stringify(own));
  return { ok: true, removed, notMine, gone };
}

// ---------------------------------------------------------------------------------------------
// Wochenwahl
async function getWeek(env, key) {
  const [candidates, list] = await Promise.all([
    env.WG.get(`week:${key}:candidates`, "json"),
    env.WG.list({ prefix: `week:${key}:vote:` }),
  ]);
  const votes = {};
  await Promise.all(list.keys.map(async k => {
    votes[k.name.split(":").pop()] = await env.WG.get(k.name, "json");
  }));
  return { week: key, candidates: candidates || null, votes };
}

// ---------------------------------------------------------------------------------------------
// Kalender-Abo (iCal)
const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function mondayOf(weekKey) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey || "");
  if (!m) return null;
  const year = +m[1], week = +m[2];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

function icsEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lange Zeilen nach RFC 5545 auf 75 Bytes falten
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

async function calendar(env, token) {
  if (!env.CAL_TOKEN || !timingSafeEqual(token, env.CAL_TOKEN.trim())) return new Response("Not found", { status: 404 });
  const doc = (await env.WG.get("plan", "json")) || {};
  const monday = mondayOf(doc.week);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BringFrisch//WG-Znacht//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:BringFrisch Znacht", "X-WR-TIMEZONE:Europe/Zurich", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  if (monday && Array.isArray(doc.plan)) {
    const names = Object.fromEntries((doc.members || []).map(m => [m.id, m.name]));
    const [hh, mm] = (doc.dinnerTime || "18:30").split(":").map(Number);
    doc.plan.forEach((day, i) => {
      if (!day || !day.title) return;
      const eaters = (day.eaters || []).map(id => names[id] || id);
      if (eaters.length === 0 && !day.extra_guests) return; // niemand zuhause
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
      const [sh, sm] = (day.time || "").split(":").map(Number);
      const start = `${ymd}T${String(sh || hh).padStart(2, "0")}${String(isNaN(sm) ? mm : sm).padStart(2, "0")}00`;
      const endH = (sh || hh) + 1;
      const end = `${ymd}T${String(endH).padStart(2, "0")}${String(isNaN(sm) ? mm : sm).padStart(2, "0")}00`;
      const desc = [
        `Es essen: ${eaters.join(", ") || "–"}${day.extra_guests ? ` + ${day.extra_guests} Gäste` : ""}`,
        `Reste fürs Zmittag: +${day.leftover_buffer ?? 2} Portionen`,
        day.cook ? `Koch: ${day.cook}` : "",
        day.source_url ? `Rezept: ${day.source_url}` : "",
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:bringfrisch-${doc.week}-${i}@bringfrisch`,
        `DTSTAMP:${stamp(new Date(doc.updated || Date.now()))}`,
        `DTSTART;TZID=Europe/Zurich:${start}`,
        `DTEND;TZID=Europe/Zurich:${end}`,
        fold(`SUMMARY:${icsEscape(`🍲 ${day.title}`)}`),
        fold(`DESCRIPTION:${icsEscape(desc)}`),
        ...(day.source_url ? [fold(`URL:${day.source_url}`)] : []),
        `SEQUENCE:${Math.floor((doc.updated || 0) / 60000) % 2147483647}`,
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=300" },
  });
}

// ---------------------------------------------------------------------------------------------
// Rezept-Link importieren (schema.org Recipe aus JSON-LD)
async function importRecipe(link) {
  let u;
  try {
    u = new URL(link);
  } catch {
    throw httpError(400, "Ungültiger Link");
  }
  if (u.protocol !== "https:" || !RECIPE_HOSTS.test(u.hostname)) throw httpError(400, "Nur Betty Bossi, Migusto, Fooby, Swissmilk oder Chefkoch");
  const res = await fetch(u.toString(), { headers: { "User-Agent": "BringFrisch-RecipeImport/1.0 (private WG meal planner)" } });
  if (!res.ok) throw httpError(502, `Seite nicht erreichbar (${res.status})`);
  const html = await res.text();
  let recipe = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const stack = [JSON.parse(m[1].trim())];
      while (stack.length && !recipe) {
        const x = stack.pop();
        if (Array.isArray(x)) stack.push(...x);
        else if (x && typeof x === "object") {
          const t = [].concat(x["@type"]);
          if (t.includes("Recipe")) recipe = x;
          else stack.push(...Object.values(x).filter(v => v && typeof v === "object"));
        }
      }
    } catch { /* nächster Block */ }
    if (recipe) break;
  }
  if (!recipe) {
    // Microdata (Swissmilk)
    const ingredients = [...html.matchAll(/itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/(?:li|span|div|p)>/g)]
      .map(m => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!ingredients.length) throw httpError(422, "Keine Rezeptdaten auf der Seite gefunden");
    const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
    const yieldText = (html.match(/itemprop="recipeYield"[^>]*>([^<]*)/) || [])[1] || "";
    recipe = { name: title.replace(/<[^>]+>/g, "").trim(), recipeIngredient: ingredients, recipeYield: yieldText };
  }
  const yieldText = [].concat(recipe.recipeYield || "").join(" ");
  const servings = parseInt((yieldText.match(/\d+/) || ["4"])[0], 10);
  const time = String(recipe.totalTime || "");
  const t = time.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return {
    title: decodeEntities(String(recipe.name || "").trim()),
    servings: servings >= 1 && servings <= 20 ? servings : 4,
    minutes: t ? (+(t[1] || 0)) * 60 + (+(t[2] || 0)) : null,
    ingredients: [].concat(recipe.recipeIngredient || []).map(s => decodeEntities(String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())).filter(Boolean),
    url: u.toString(),
  };
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
