// Benachrichtigungen (Web Push) – ohne fremden Dienst und ohne Abhängigkeiten (Joshua 19.11.):
//   - Wochenwahl: hat jemand gewählt, bekommen alle anderen eine Meldung; mit der letzten Stimme alle «Alle haben gewählt»
//   - Anstupsen: wer noch nicht gewählt hat, höchstens 1× pro Tag
//   - Markt / Hof: einmal pro Woche an einem gewählten Tag, nur wenn auf Bring! etwas steht (Zeitplan im Worker)
//   - Kurzbefehl (iPhone, «Ankommen bei …»): GET /erinnerung/:token antwortet höchstens 1× pro Woche mit einem Text
// Ruhezeit 21–8 Uhr: Wahl-Meldungen und Anstupser warten in «pushq» bis 8:00.
//
// Verschlüsselung RFC 8291 (aes128gcm) und Absender-Ausweis VAPID RFC 8292 (ES256), alles mit WebCrypto.
// Secrets: VAPID_PUBLIC + VAPID_PRIVATE (node tools/vapid.mjs), WG-Server und Test-Server je eigene. Ohne Secrets: 501.
//
// KV (pro WG, mit Präfix): push = { subs: [{ id, member, endpoint, p256dh, auth, prefs, sentMarket }] }, pushq = [{ ids, msg }],
//   week:<w>:notified = { member: true }, nudge:<w> = { member: "2026-11-20" }
// KV (gemeinsam): push:index = { <wg>: { prefix, main } } (für den Zeitplan), remind:<token> = { slug, prefix, main, last }
import { body, httpError, json } from "./http.js";
import { scoped, wgSlug } from "./auth.js";
import { bringList } from "./bring.js";
import { getWeek } from "./speicher.js";
import "../../static/core.js";
const C = globalThis.BF_CORE;

const te = new TextEncoder();
export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
// Nur die Push-Dienste der Browser (Google/Chrome, Apple, Mozilla, Microsoft) – kein Abrufen beliebiger Adressen
export const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
const MAX_SUBS = 40;
// Uhr: in Tests fest (env.TEST_NOW), sonst jetzt. Regeln rechnen mit der Zürcher Wanduhr (core.js wallClock).
export const nowOf = env => new Date(env.TEST_NOW ? +new Date(env.TEST_NOW) : Date.now());
const wall = env => C.wallClock(nowOf(env));
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------------------------------------------------------------------------------------------
// Verschlüsseln und senden
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
export async function encryptPayload(text, p256dh, auth) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(te.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21 + asPub.length);
  head.set(salt);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  head.set(asPub, 21);
  return concat(head, ct);
}
export async function vapidHeader(env, endpoint) {
  const pubTxt = String(env.VAPID_PUBLIC).trim(), pub = unb64u(pubTxt);
  const jwk = { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: String(env.VAPID_PRIVATE).trim(), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = o => b64u(te.encode(JSON.stringify(o)));
  // exp immer mit der echten Uhr (die Push-Dienste lehnen abgelaufene Ausweise ab)
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "https://github.com/JODBaer/BringFresch" })}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${pubTxt}`;
}
// Eine Meldung an ein Handy. Antwort: HTTP-Status des Push-Dienstes (404/410 = Abo gibt es nicht mehr)
export async function sendOne(env, sub, msg) {
  if (!PUSH_HOSTS.test(new URL(sub.endpoint).hostname)) return 400;
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(env, sub.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal" },
    body: await encryptPayload(JSON.stringify(msg), sub.p256dh, sub.auth),
  });
  return res.status;
}
const ready = env => !!(env.VAPID_PUBLIC && env.VAPID_PRIVATE);
const loadSubs = async env => (await env.WG.get("push", "json")) || { subs: [] };
// An mehrere Handys; verschwundene Abos werden aufgeräumt
async function sendMany(env, doc, targets, msg) {
  if (!ready(env) || !targets.length) return 0;
  const status = await Promise.all(targets.map(s => sendOne(env, s, msg).catch(() => 0)));
  const gone = new Set(targets.filter((s, i) => status[i] === 404 || status[i] === 410).map(s => s.id));
  if (gone.size) {
    doc.subs = doc.subs.filter(s => !gone.has(s.id));
    await env.WG.put("push", JSON.stringify(doc));
  }
  return status.filter(s => s >= 200 && s < 300).length;
}
// Wahl-Meldungen und Anstupser: in der Ruhezeit (21–8) in die Warteschlange, sonst sofort
async function deliver(env, doc, targets, msg) {
  if (!targets.length) return { sent: 0, queued: 0 };
  if (C.isQuiet(wall(env))) {
    const q = (await env.WG.get("pushq", "json")) || [];
    q.push({ ids: targets.map(s => s.id), msg });
    await env.WG.put("pushq", JSON.stringify(q.slice(-30)), { expirationTtl: 2 * 86400 });
    return { sent: 0, queued: targets.length };
  }
  return { sent: await sendMany(env, doc, targets, msg), queued: 0 };
}
// Im Hintergrund weiterlaufen lassen (Antwort an die App wartet nicht), in Tests direkt abwarten
const later = (env, p) => (env.CTX && env.CTX.waitUntil ? env.CTX.waitUntil(p.catch(() => {})) : p.catch(() => {}));

// ---------------------------------------------------------------------------------------------
// Endpunkte (mit PIN)
//   GET  /push/key                       -> { key } öffentlicher VAPID-Schlüssel (501 ohne Secrets)
//   PUT  /push  { id, member, sub: { endpoint, keys: { p256dh, auth } }, prefs } -> Abo dieses Handys (neu oder ändern)
//   POST /push/off { id }                -> Abo löschen
//   POST /week/:week/nudge { from, to:[ids] } -> { sent:[ids], skipped:[ids], noDevice:[ids] }
//   POST /erinnerung { old? }            -> { url } Adresse für den iPhone-Kurzbefehl (alte wird ungültig)
export async function pushRoute(request, env, path, url) {
  const method = request.method;
  if (path === "/push/key" && method === "GET") {
    if (!ready(env)) throw httpError(501, "Benachrichtigungen sind auf dem WG-Server noch nicht eingerichtet");
    return json({ key: String(env.VAPID_PUBLIC).trim() });
  }
  if (path === "/push" && method === "PUT") {
    const { id, member, sub, prefs = {} } = await body(request);
    const endpoint = sub && sub.endpoint, keys = (sub && sub.keys) || {};
    if (!/^[\w-]{8,64}$/.test(id || "") || typeof member !== "string" || member.length > 40) throw httpError(400, "Abo ungültig");
    let host = "";
    try { host = new URL(endpoint).protocol === "https:" ? new URL(endpoint).hostname : ""; } catch { /* keine Adresse */ }
    if (!PUSH_HOSTS.test(host) || !keys.p256dh || !keys.auth || String(keys.p256dh).length > 120 || String(keys.auth).length > 40) throw httpError(400, "Abo ungültig");
    const doc = await loadSubs(env);
    const old = doc.subs.find(s => s.id === id);
    const entry = { id, member, endpoint, p256dh: keys.p256dh, auth: keys.auth, prefs: cleanPrefs(prefs), sentMarket: old ? old.sentMarket || null : null };
    doc.subs = [...doc.subs.filter(s => s.id !== id && s.endpoint !== endpoint), entry].slice(-MAX_SUBS);
    await env.WG.put("push", JSON.stringify(doc));
    await indexWg(env, true);
    return json({ ok: true });
  }
  if (path === "/push/off" && method === "POST") {
    const { id } = await body(request);
    const doc = await loadSubs(env);
    const left = doc.subs.filter(s => s.id !== id);
    if (left.length !== doc.subs.length) { doc.subs = left; await env.WG.put("push", JSON.stringify(doc)); }
    if (!left.length) await indexWg(env, false);
    return json({ ok: true });
  }
  const nudge = path.match(/^\/week\/(\d{4}-W\d{2})\/nudge$/);
  if (nudge && method === "POST") return json(await nudgeWeek(env, nudge[1], await body(request)));
  if (path === "/erinnerung" && method === "POST") {
    const { old } = await body(request).catch(() => ({}));
    const ctx = env.WG_CTX;
    if (old && /^[\w-]{16,64}$/.test(old)) {
      const rec = await env.RAW.get(`remind:${old}`, "json");
      if (rec && rec.slug === ctx.slug) await env.RAW.delete(`remind:${old}`);
    }
    const token = b64u(crypto.getRandomValues(new Uint8Array(18)));
    await env.RAW.put(`remind:${token}`, JSON.stringify({ slug: ctx.slug, prefix: ctx.prefix, main: !!ctx.main, last: null }));
    return json({ url: `${url.origin}/erinnerung/${token}` });
  }
  return null;
}
function cleanPrefs(p) {
  const m = p.market;
  const market = m && typeof m === "object" && m.day >= 0 && m.day <= 6
    ? { name: String(m.name || "Markt").slice(0, 60), oh: String(m.oh || "").slice(0, 200), day: +m.day, when: ["eve", "pre", "fix"].includes(m.when) ? m.when : "eve", time: /^\d{1,2}:\d\d$/.test(m.time || "") ? m.time : "09:00" }
    : null;
  return { voted: p.voted !== false, nudge: p.nudge !== false, market };
}
// Liste der WGs mit Abos, damit der Zeitplan nicht alle Schlüssel durchsuchen muss (schreibt nur bei Änderung)
async function indexWg(env, on) {
  const ctx = env.WG_CTX;
  if (!ctx || !env.RAW) return;
  const idx = (await env.RAW.get("push:index", "json")) || {};
  if (!!idx[ctx.slug] === on) return;
  if (on) idx[ctx.slug] = { prefix: ctx.prefix, main: !!ctx.main };
  else delete idx[ctx.slug];
  await env.RAW.put("push:index", JSON.stringify(idx));
}

// Für die Wochenwahl: wer kann Meldungen bekommen, wer wurde heute schon angestupst
export async function weekPushInfo(env, week) {
  const [doc, nudged] = await Promise.all([loadSubs(env), env.WG.get(`nudge:${week}`, "json")]);
  const today = isoDay(wall(env));
  return { pushers: [...new Set(doc.subs.filter(s => s.prefs.nudge !== false).map(s => s.member))], nudged: Object.keys(nudged || {}).filter(k => nudged[k] === today) };
}

const members = async env => (((await env.WG.get("settings", "json")) || {}).settings || {}).members || ((await env.WG.get("plan", "json")) || {}).members || [];

// Nach einer Stimme (PUT /week/:week/vote/:member): nur die erste Stimme pro Person und Woche meldet sich
export async function afterVote(env, week, member, likes) {
  if (!likes.length) return;
  const seen = (await env.WG.get(`week:${week}:notified`, "json")) || {};
  if (seen[member]) return;
  seen[member] = true;
  await env.WG.put(`week:${week}:notified`, JSON.stringify(seen), { expirationTtl: 60 * 60 * 24 * 21 });
  const doc = await loadSubs(env);
  if (!doc.subs.length) return;
  const { votes } = await getWeek(env, week);
  const msg = C.voteMessage(await members(env), votes, member, week);
  const targets = doc.subs.filter(s => s.prefs.voted !== false && (msg.all || s.member !== member));
  await later(env, deliver(env, doc, targets, { title: msg.title, body: msg.body, tag: `wahl-${week}`, open: "wahl" }));
}

async function nudgeWeek(env, week, { from, to }) {
  if (!Array.isArray(to) || to.length > 20) throw httpError(400, "Wen anstupsen?");
  const [doc, wk, list, nudged] = await Promise.all([loadSubs(env), env.WG.get(`week:${week}:notified`, "json"), members(env), env.WG.get(`nudge:${week}`, "json")]);
  const today = isoDay(wall(env)), done = nudged || {};
  const name = (list.find(m => m.id === from) || {}).name || "Jemand";
  const res = { sent: [], skipped: [], noDevice: [] };
  const targets = [];
  for (const id of [...new Set(to.map(String))]) {
    if (id === from || done[id] === today || (wk || {})[id]) { res.skipped.push(id); continue; }
    const subs = doc.subs.filter(s => s.member === id && s.prefs.nudge !== false);
    if (!subs.length) { res.noDevice.push(id); continue; }
    done[id] = today;
    res.sent.push(id);
    targets.push(...subs);
  }
  if (res.sent.length) {
    await env.WG.put(`nudge:${week}`, JSON.stringify(done), { expirationTtl: 60 * 60 * 24 * 21 });
    const kw = `KW ${+week.split("-W")[1]}`;
    await deliver(env, doc, targets, { title: `${name} stupst dich an 👋`, body: `Die Wochenwahl für ${kw} wartet noch auf dich.`, tag: `nudge-${week}`, open: "wahl" });
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// Ohne PIN: Kurzbefehl «Ankommen bei …» fragt hier. Text höchstens 1× pro Woche und nur, wenn auf Bring! etwas steht.
export async function remindShortcut(env, token) {
  const text = s => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (!/^[\w-]{16,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const rec = await env.WG.get(`remind:${token}`, "json");
  if (!rec) return new Response("Not found", { status: 404 });
  const week = C.weekKey(wall(env));
  if (rec.last === week) return text("");
  const items = await bringItems(wgEnv(env, rec.slug, rec));
  if (!items.length) return text("");
  rec.last = week;
  await env.WG.put(`remind:${token}`, JSON.stringify(rec));
  return text(C.bringReminder(items));
}

// Umgebung einer WG für den Zeitplan (wie nach der PIN-Prüfung)
function wgEnv(env, slug, rec) {
  const aliases = rec.main ? String(env.MAIN_WG || "").split(",").map(wgSlug).filter(Boolean) : [];
  return { ...env, WG: scoped(env.WG, rec.prefix || ""), RAW: env.WG, WG_CTX: { slug, prefix: rec.prefix || "", main: !!rec.main, aliases } };
}
async function bringItems(wenv) {
  try { return (await bringList(wenv)).items || []; } catch { return []; }
}

// Zeitplan (alle 15 Min.): Warteschlange nach der Ruhezeit senden, Markt-/Hof-Erinnerungen
export async function pushCron(env) {
  if (!ready(env)) return { sent: 0 };
  const idx = (await env.WG.get("push:index", "json")) || {};
  const now = wall(env);
  let sent = 0;
  for (const [slug, rec] of Object.entries(idx)) {
    const wenv = wgEnv(env, slug, rec);
    let doc = null;
    if (!C.isQuiet(now)) {
      const q = await wenv.WG.get("pushq", "json");
      if (q && q.length) {
        await wenv.WG.delete("pushq");
        doc = await loadSubs(wenv);
        for (const { ids, msg } of q) sent += await sendMany(wenv, doc, doc.subs.filter(s => ids.includes(s.id)), msg);
      }
    }
    doc = doc || await loadSubs(wenv);
    const due = doc.subs.map(s => ({ s, d: s.prefs.market && C.marketDue(s.prefs.market, now, s.sentMarket) })).filter(x => x.d);
    if (!due.length) continue;
    const items = await bringItems(wenv); // einmal pro WG
    const body = C.bringReminder(items);
    due.forEach(({ s, d }) => { s.sentMarket = d.date; }); // leere Liste: diese Woche keine Erinnerung
    await wenv.WG.put("push", JSON.stringify(doc));
    if (body) for (const { s, d } of due) sent += await sendMany(wenv, doc, [s], { title: d.title, body, tag: `markt-${d.date}`, open: "einkauf" });
  }
  return { sent };
}
