// WG-Dokumente im KV-Speicher: speichern mit Abgleich, tägliche Sicherung, Wochenwahl lesen
import { json } from "./http.js";

// Tägliche Sicherung: alle WG-Daten (ausser alten Sicherungen) als ein Eintrag, läuft nach 30 Tagen ab.
export async function backup(env, now = new Date()) {
  const day = now.toISOString().slice(0, 10), keys = {};
  let cursor;
  do {
    const page = await env.WG.list({ cursor });
    for (const k of page.keys) if (!/^(backup|fail|lock|img):|^bringtoken$/.test(k.name)) keys[k.name] = await env.WG.get(k.name);
    cursor = page.list_complete === false ? page.cursor : undefined;
  } while (cursor);
  await env.WG.put("backup:" + day, JSON.stringify({ day, keys }), { expirationTtl: 30 * 86400 });
  return { day, count: Object.keys(keys).length };
}

// Dokument der WG speichern. Schickt die App «base» mit (Stempel des Standes, auf dem ihre Änderung aufbaut) und hat
// inzwischen jemand anderes gespeichert, wird nichts überschrieben: 409 mit dem aktuellen Stand, die App führt zusammen
// und sendet nochmals. Ohne «base» (ältere App) wie bisher: der neue Stand ersetzt den alten. Stempel steigen immer.
export async function putDoc(env, key, doc, base, opts) {
  const cur = base != null ? await env.WG.get(key, "json") : null;
  if (cur && cur.updated && cur.updated !== +base) return json({ ok: false, conflict: true, error: "Inzwischen von jemand anderem geändert", ...cur }, 409);
  doc.updated = Math.max(Date.now(), ((cur && cur.updated) || 0) + 1);
  await env.WG.put(key, JSON.stringify(doc), opts);
  return json({ ok: true, updated: doc.updated });
}

// ---------------------------------------------------------------------------------------------
// Wochenwahl
export async function getWeek(env, key) {
  // Stimmen direkt pro Mitbewohner lesen statt die Schlüssel aufzulisten: «list» ist im Gratis-Tarif auf
  // 1000 pro Tag begrenzt (und die Wochenwahl fragt alle 30 s nach). Nur ohne bekannte Mitbewohner wird gelistet.
  const [candidates, settings, plan] = await Promise.all([
    env.WG.get(`week:${key}:candidates`, "json"),
    env.WG.get("settings", "json"),
    env.WG.get("plan", "json"),
  ]);
  const ids = new Set([...(((settings || {}).settings || {}).members || []), ...((plan || {}).members || [])].map(m => m && m.id).filter(Boolean));
  const names = ids.size
    ? [...ids].map(id => `week:${key}:vote:${id}`)
    : (await env.WG.list({ prefix: `week:${key}:vote:` })).keys.map(k => k.name);
  const votes = {};
  await Promise.all(names.map(async n => {
    const v = await env.WG.get(n, "json");
    if (v) votes[n.split(":").pop()] = v;
  }));
  return { week: key, candidates: candidates || null, votes };
}
