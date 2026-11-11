// Welche WG fragt? PIN-Prüfung, Sperre nach Fehlversuchen, eigener Speicherbereich pro WG
import { httpError } from "./http.js";

// Welche WG fragt? Erste WG: Secret WG_PIN. Weitere: wgs:<name> in KV, PIN als SHA-256(salt:PIN).
// Nach 10 falschen Versuchen ist die WG für diesen Absender (IP) 15 Minuten gesperrt – auch die erste WG.
// Nur Fehlversuche bei bekannten WGs kosten Schreibzugriffe (unbekannte Namen schreiben nichts: Gratis-Kontingent).
export const wgSlug = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
export async function requireWg(request, env) {
  const pin = (request.headers.get("X-WG-PIN") || "").trim();
  const slug = wgSlug(request.headers.get("X-WG"));
  // MAIN_WG darf mehrere Namen haben («allmen,wg1»): der erste gilt, die anderen gehen weiter (alte Handys)
  const aliases = String(env.MAIN_WG || "").split(",").map(wgSlug).filter(Boolean);
  const main = aliases[0] || "";
  const ip = (request.headers.get("CF-Connecting-IP") || "").slice(0, 45);
  // Zähler pro WG und Absender: gesperrt -> 429, sonst eine Funktion, die den Fehlversuch festhält
  const guard = async id => {
    const key = `fail:${id}:${ip}`;
    const fails = +(await env.WG.get(key)) || 0;
    if (fails >= 10) throw httpError(429, "Zu viele falsche Versuche – in 15 Minuten nochmals");
    return () => env.WG.put(key, String(fails + 1), { expirationTtl: 900 });
  };
  if (!slug || aliases.includes(slug)) {
    const failed = await guard(main || "main");
    if (!env.WG_PIN || !timingSafeEqual(pin, env.WG_PIN.trim())) {
      if (env.WG_PIN) await failed();
      throw httpError(401, slug ? "Falscher WG-Name oder PIN" : "Falscher WG-PIN");
    }
    return { slug: main || "main", aliases, name: env.MAIN_WG_NAME || main || "WG", prefix: "", main: true, calToken: env.CAL_TOKEN };
  }
  const reg = await env.WG.get(`wgs:${slug}`, "json");
  if (!reg) throw httpError(401, "Falscher WG-Name oder PIN");
  const failed = await guard(slug);
  if (!pin || !timingSafeEqual(await pinHash(reg.salt, pin), reg.pinHash)) {
    await failed();
    throw httpError(401, "Falscher WG-Name oder PIN");
  }
  return { slug, name: reg.name || slug, prefix: `w:${slug}:`, main: false, calToken: reg.calToken };
}

export async function pinHash(salt, pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// KV nur mit den Schlüsseln einer WG (Präfix wird vorne angehängt und beim Auflisten wieder entfernt)
export function scoped(kv, prefix) {
  if (!prefix) return kv;
  return {
    get: (k, t) => kv.get(prefix + k, t),
    put: (k, v, o) => kv.put(prefix + k, v, o),
    delete: k => kv.delete(prefix + k),
    async list(o = {}) {
      const r = await kv.list({ ...o, prefix: prefix + (o.prefix || "") });
      return { ...r, keys: r.keys.map(k => ({ ...k, name: k.name.slice(prefix.length) })) };
    },
  };
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
