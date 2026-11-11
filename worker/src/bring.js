// Bring!: Anmeldung (gemerkt), Listen, Artikel setzen und wegnehmen – der Bot nimmt nur Eigenes weg
import { httpError } from "./http.js";
import { pinHash } from "./auth.js";

export const BRING = "https://api.getbring.com/rest/v2/";
// Öffentlicher Schlüssel der Bring!-Web-App (aus python-bring-api übernommen)
export const BRING_HEADERS = {
  "X-BRING-API-KEY": "cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp",
  "X-BRING-CLIENT": "webApp",
  "X-BRING-CLIENT-SOURCE": "webApp",
  "X-BRING-COUNTRY": "CH",
};
export const MAX_ITEMS = 45; // Free-Plan: 50 Unteranfragen pro Aufruf (1 Login + 1 Liste + Artikel)

// ---------------------------------------------------------------------------------------------
// Bring!
// Anmeldung bei Bring! merken statt bei jedem Aufruf neu anmelden: im Speicher der laufenden Worker-Instanz und in KV
// (`bringtoken`, läuft mit der Anmeldung ab, nicht in der Sicherung). Lehnt Bring! die gemerkte Anmeldung ab (401),
// meldet sich der Worker einmal frisch an (bringFetch). Neues Passwort/Konto = andere Kennung = neue Anmeldung.
export let memToken = null;
export async function bringAuth(env, fresh) {
  if (!env.BRING_EMAIL || !env.BRING_PASSWORD) throw httpError(500, "Bring!-Zugang im Worker nicht eingerichtet");
  const kv = env.RAW || env.WG, now = Date.now();
  const id = await pinHash(env.BRING_EMAIL.trim(), env.BRING_PASSWORD);
  if (!fresh) {
    if (memToken && memToken.id === id && memToken.exp > now) return memToken;
    const t = await kv.get("bringtoken", "json");
    if (t && t.id === id && t.exp > now) return (memToken = t);
  }
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
  if (!data.uuid || !data.access_token) throw httpError(502, "Bring!-Antwort unvollständig");
  const ttl = Math.min(Math.max(+data.expires_in || 3600, 300), 6 * 86400); // Sekunden; ohne Angabe eine Stunde
  memToken = { id, uuid: data.uuid, access_token: data.access_token, bringListUUID: data.bringListUUID, exp: now + (ttl - 120) * 1000 };
  await kv.put("bringtoken", JSON.stringify(memToken), { expirationTtl: ttl });
  return memToken;
}
export const authHeaders = t => ({ ...BRING_HEADERS, "X-BRING-USER-UUID": t.uuid, Authorization: `Bearer ${t.access_token}` });
// Aufruf an Bring! mit gemerkter Anmeldung; bei 401 einmal frisch anmelden und wiederholen
export async function bringFetch(s, url, init = {}) {
  const go = () => fetch(url, { ...init, headers: { ...s.headers, ...(init.headers || {}) } });
  let res = await go();
  if (res.status === 401 && s.env && !s.renewed) {
    s.renewed = true;
    s.headers = authHeaders(await bringAuth(s.env, true));
    res = await go();
  }
  return res;
}

export async function bringLogin(env, allowNoList = false) {
  const data = await bringAuth(env);
  const headers = authHeaders(data);
  const who = { env, userUuid: data.uuid, headers };
  if (env.ONLY_LIST_NAME) {
    // Test-Server: immer genau diese Liste (per Name), egal was gespeichert ist
    const lists = await fetchLists(who);
    // mehrere Namen erlaubt («Home-test,Home»): der erste vorhandene gilt (Liste kann in Bring! umbenannt werden)
    const hit = testListNames(env.ONLY_LIST_NAME).map(n => lists.find(l => sameListName(l.name, n))).find(Boolean);
    if (!hit) throw httpError(502, `Test-Server: Liste «${env.ONLY_LIST_NAME}» im Bot-Konto nicht gefunden (Bot sieht ${lists.length} Listen) – ist sie mit dem Bot geteilt?`);
    return { ...who, listUuid: hit.uuid, lists };
  }
  const chosen = await env.WG.get("bringList");
  const mainList = (env.RAW ? await env.RAW.get("bringList") : chosen) || env.BRING_LIST_UUID || data.bringListUUID;
  const extra = !!(env.WG_CTX && !env.WG_CTX.main);
  // Weitere WGs: nie still in die Liste der ersten WG schreiben – erst wählen
  const listUuid = extra ? chosen : chosen || mainList;
  if (!listUuid && extra && allowNoList) return { ...who, listUuid: null, mainList };
  if (!listUuid && extra) throw httpError(409, "Noch keine Bring!-Liste gewählt – unter Einstellungen die WG-Liste wählen");
  if (!listUuid) throw httpError(502, "Bring!-Antwort unvollständig");
  return { ...who, listUuid, mainList };
}

// Namen der Test-Liste (gehört der Test-Version). «Home» = alter Name, solange die Liste in Bring! nicht umbenannt ist
export const testListNames = v => String(v || "Home-test,Home").split(",").map(s => s.trim()).filter(Boolean);
// «Home-test», «Home-Test», «Home test», «hometest» gelten als gleich
export const sameListName = (a, b) => String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "");

export async function fetchLists(s) {
  const res = await bringFetch(s, `${BRING}bringusers/${s.userUuid}/lists`);
  if (!res.ok) throw httpError(502, `Bring!-Listen nicht lesbar (${res.status})`);
  const data = await res.json();
  return (data.lists || []).map(l => ({ uuid: l.listUuid, name: l.name }));
}

// Alle Listen des Bot-Kontos (zum Einrichten: welche ist die WG-Liste?)
export async function bringLists(env) {
  const s = await bringLogin(env, true);
  let lists = s.lists || (await fetchLists(s));
  // WG-Server: die Test-Liste («Home-test») ist eine gemeinsame Spielwiese zum Ausprobieren. Wählbar nur, solange eine WG
  // noch keine eigene Liste mit dem Bot verknüpft hat (oder gerade auf der Test-Liste ist); sie gehört nie einer WG.
  const isTest = l => testListNames(env.TEST_LIST_NAME).some(n => sameListName(l.name, n));
  const ownList = s.listUuid && !lists.some(l => l.uuid === s.listUuid && isTest(l));
  if (!env.ONLY_LIST_NAME && ownList) lists = lists.filter(l => !isTest(l));
  // Test-Server zeigt nur seine eine Liste, damit niemand aus Versehen die WG-Liste wählt
  if (env.ONLY_LIST_NAME) lists = lists.filter(l => l.uuid === s.listUuid);
  // Gleicher Bot für mehrere WGs: Listen, die schon eine andere WG benutzt, sind nicht wählbar
  else if (env.RAW && env.WG_CTX) {
    const me = env.WG_CTX.slug;
    const taken = await Promise.all(lists.map(async l => {
      if (isTest(l)) return false; // Spielwiese: für alle (ohne eigene Liste) wählbar
      const owner = await env.RAW.get(`listowner:${l.uuid}`);
      if (owner) return owner !== me && !(env.WG_CTX.aliases || []).includes(owner);
      return !env.WG_CTX.main && l.uuid === s.mainList; // Liste der ersten WG (auch ohne Eintrag)
    }));
    lists = lists.filter((l, i) => !taken[i]);
  }
  return { active: s.listUuid, lists };
}

// WG wählt in der App, in welche Bring!-Liste geschrieben wird (gilt für alle Handys)
export async function bringSetTarget(env, { uuid }) {
  const { lists } = await bringLists(env);
  const hit = lists.find(l => l.uuid === uuid);
  if (!hit) throw httpError(400, "Liste nicht gefunden – ist sie mit dem Bot-Konto geteilt?");
  if (env.RAW && env.WG_CTX && !env.ONLY_LIST_NAME) {
    const old = await env.WG.get("bringList");
    if (old && old !== hit.uuid && (await env.RAW.get(`listowner:${old}`)) === env.WG_CTX.slug) await env.RAW.delete(`listowner:${old}`);
    // die Test-Liste gehört nie einer WG (bleibt Spielwiese für alle)
    if (!testListNames(env.TEST_LIST_NAME).some(n => sameListName(hit.name, n))) await env.RAW.put(`listowner:${hit.uuid}`, env.WG_CTX.slug);
  }
  await env.WG.put("bringList", hit.uuid);
  return { ok: true, active: hit.uuid, name: hit.name };
}

// Liste mit Mengenangaben: [{ name, spec }]
export async function bringDetails(s) {
  const res = await bringFetch(s, `${BRING}bringlists/${s.listUuid}`);
  if (!res.ok) throw httpError(502, `Bring!-Liste nicht lesbar (${res.status})`);
  const data = await res.json();
  const purchase = (data.items && data.items.purchase) || data.purchase || [];
  return purchase.map(p => ({ name: p.name || p.itemId, spec: p.specification || "" }));
}
export async function bringPurchase(s) {
  return (await bringDetails(s)).map(p => p.name);
}

// Was hat der Bot selbst auf die Liste gesetzt? Nur das darf er wieder wegnehmen.
export const ownKey = s => `bot:${s.listUuid}`;
// own: { "rahm": { name: "Rahm", spec: "4 dl" } } – Menge, die der Bot zuletzt gesendet hat
export async function loadOwn(env, s) {
  const raw = (await env.WG.get(ownKey(s), "json")) || {};
  for (const k of Object.keys(raw)) if (typeof raw[k] === "string") raw[k] = { name: raw[k], spec: "" }; // altes Format
  return raw;
}

export async function bringList(env) {
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

export function bringPut(s, params) {
  return bringFetch(s, `${BRING}bringlists/${s.listUuid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams(params),
  });
}

export async function bringSync(env, { items }) {
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
export async function bringRemove(env, { names }) {
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
