// BringFrisch Worker: kleine Brücke zwischen der Handy-App und Bring! + gemeinsamer WG-Speicher.
//
// Mehrere WGs: Header X-WG (Kurzname) + X-WG-PIN. Ohne X-WG oder mit X-WG = MAIN_WG ist es die erste WG
// (PIN = Secret WG_PIN, Daten ohne Präfix wie bisher). Weitere WGs stehen in KV unter wgs:<name>
// (PIN nur als Hash, angelegt mit tools/new_wg.mjs), ihre Daten unter w:<name>:… – jede WG sieht nur ihre eigenen.
//   GET  /wg                          -> { name, main }  (Name der verbundenen WG)
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
//   GET/PUT /plan/:week               -> Plan einer bestimmten Woche (ab Donnerstag: nächste Woche planen)
//   GET  /recipe?url=…                -> { title, servings, ingredients[], minutes }  (Rezept-Link importieren)
//   GET/PUT /vorrat                   -> gemeinsamer Grundvorrat der WG
//   GET/PUT /settings                 -> WG-Einstellungen (Mitbewohner, Znacht-Zeit, Rezept-Webseiten, eigene Rezepte)
//   GET  /cal-link                    -> { url } Abo-Link für den Kalender
//   GET  /cal/:token.ics              -> Kalender-Abo (iCal) mit allen Znacht der Woche
//        ?me=<id>                     -> nur die Abende, an denen diese Person mitisst (persönliches Abo)
//        ?week=2026-W47&dl=1          -> einmal herunterladen: nur diese Woche, eigene UIDs, als Datei
//   GET  /backup                      -> { days: ["2026-11-10", ...] }  (tägliche Sicherung, 30 Tage)
//   GET  /backup/:day                 -> { day, keys: { plan: …, vorrat: …, … } }
//
// Cron (täglich, wrangler.toml [triggers]): Sicherung aller WG-Daten nach backup:<Tag>, läuft 30 Tage.
// Zurückholen von Hand: worker/README.md «Sicherung».
//
// Secrets (npx wrangler secret put …): BRING_EMAIL, BRING_PASSWORD, WG_PIN, CAL_TOKEN
// Optional: BRING_LIST_UUID (sonst die Standardliste des Bot-Kontos)
// Test-Server (wrangler --env stage): ONLY_LIST_NAME = "Home-test,Home" -> schreibt nur in diese Liste des Bots (alter Name «Home» geht weiter), nie in die WG-Liste
// WG-Server: «Home-test» (TEST_LIST_NAME) gehört immer der Test-Version und ist für keine WG wählbar
// KV-Binding: WG

import { body, corsHeaders, httpError, json } from "./http.js";
import { requireWg, scoped } from "./auth.js";
import { backup, getWeek, putDoc } from "./speicher.js";
import { bringList, bringLists, bringRemove, bringSetTarget, bringSync } from "./bring.js";
import { calendar } from "./kalender.js";
import { importRecipe, recipeImage } from "./rezept.js";
// Für Tests und Werkzeuge
export { backup } from "./speicher.js";
export { pinHash, wgSlug } from "./auth.js";

// ---------------------------------------------------------------------------------------------
export default {
  async scheduled(event, env) { await backup(env, new Date(event.scheduledTime || Date.now())); },
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
  if (cal && method === "GET") return calendar(env, cal[1], url.searchParams);

  const wg = await requireWg(request, env);
  env = { ...env, WG: scoped(env.WG, wg.prefix), RAW: env.WG, WG_CTX: wg };

  if (path === "/img" && method === "GET") return recipeImage(env, url.searchParams.get("url"));
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
    return putDoc(env, "plan", { week: data.week, plan: data.plan, members: data.members || [], dinnerTime: data.dinnerTime || "18:30" }, data.base);
  }

  // Plan einer bestimmten Woche (die nächste Woche wird ab Donnerstag schon geplant)
  const planWeek = path.match(/^\/plan\/(\d{4}-W\d{2})$/);
  if (planWeek && method === "GET") return json((await env.WG.get(`plan:${planWeek[1]}`, "json")) || { plan: null });
  if (planWeek && method === "PUT") {
    const data = await body(request);
    if (!Array.isArray(data.plan) || data.plan.length !== 7) throw httpError(400, "plan ungültig");
    return putDoc(env, `plan:${planWeek[1]}`, { week: planWeek[1], plan: data.plan, members: data.members || [], dinnerTime: data.dinnerTime || "18:30" }, data.base, { expirationTtl: 60 * 60 * 24 * 35 });
  }

  // Grundvorrat der WG – Wahrheit liegt in BringFrisch (Bring! sagt nur, was auf der Liste steht)
  if (path === "/vorrat" && method === "GET") return json((await env.WG.get("vorrat", "json")) || { staples: null, updated: 0 });
  if (path === "/vorrat" && method === "PUT") {
    const data = await body(request);
    if (!Array.isArray(data.staples) || data.staples.length > 300) throw httpError(400, "Vorrat ungültig");
    return putDoc(env, "vorrat", { staples: data.staples }, data.base);
  }

  // WG-Einstellungen für alle Handys: Mitbewohner, Znacht-Zeit, Rezept-Webseiten, eigene Rezepte (neuerer Stand gewinnt)
  if (path === "/settings" && method === "GET") return json((await env.WG.get("settings", "json")) || { settings: null, updated: 0 });
  if (path === "/settings" && method === "PUT") {
    const data = await body(request);
    const st = data.settings;
    if (!st || typeof st !== "object" || Array.isArray(st) || !Array.isArray(st.members) || !st.members.length || st.members.length > 20
      || st.members.some(m => !m || typeof m.id !== "string" || typeof m.name !== "string")) throw httpError(400, "Einstellungen ungültig");
    const raw = JSON.stringify(st);
    if (raw.length > 400000) throw httpError(400, "Einstellungen zu gross");
    return putDoc(env, "settings", { settings: st }, data.base);
  }

  if (path === "/recipe" && method === "GET") return json(await importRecipe(url.searchParams.get("url")));

  // Kalender-Link für die App (nur mit PIN sichtbar)
  if (path === "/backup" && method === "GET") {
    const { keys } = await env.WG.list({ prefix: "backup:" });
    return json({ days: keys.map(k => k.name.slice(7)).sort().reverse() });
  }
  const bk = path.match(/^\/backup\/(\d{4}-\d{2}-\d{2})$/);
  if (bk && method === "GET") {
    const snap = await env.WG.get("backup:" + bk[1], "json");
    if (!snap) return json({ ok: false, error: "Keine Sicherung für diesen Tag" }, 404);
    return json(snap);
  }
  if (path === "/cal-link" && method === "GET") {
    if (!wg.calToken) throw httpError(500, "CAL_TOKEN nicht eingerichtet");
    return json({ url: `${url.origin}/cal/${wg.calToken.trim()}.ics` });
  }
  if (path === "/wg" && method === "GET") return json({ name: wg.name, main: wg.main });

  throw httpError(404, "Unbekannter Endpunkt");
}
