// Einladungslink (Schritt 1 «Erster Start», Joshua 25.11.): statt WG-Name + PIN abtippen ein Link `…/#join=<wg>.<code>`.
// Das Handy, das einlädt, verschlüsselt den PIN selbst (AES-GCM, Schlüssel aus dem Code) und schickt nur
// { id = SHA-256("obsonare-id:" + code), iv, box }. Der Server kennt weder Code noch PIN; nach 7 Tagen ist die Einladung weg.
// Wer den Link öffnet, holt mit der id die Box (ohne PIN, ohne WG-Header) und entschlüsselt sie auf dem Handy.
import { httpError, json } from "./http.js";

export const INVITE_TTL = 7 * 86400;

export async function createInvite(env, b) {
  const { id, iv, box } = b || {};
  if (!/^[a-f0-9]{64}$/.test(String(id)) || typeof iv !== "string" || typeof box !== "string" || iv.length > 40 || box.length > 400) {
    throw httpError(400, "Einladung ungültig");
  }
  const exp = Date.now() + INVITE_TTL * 1000;
  await env.RAW.put(`inv:${id}`, JSON.stringify({ wg: env.WG_CTX.main ? ((env.WG_CTX.aliases || [])[0] || "") : env.WG_CTX.slug, iv, box, exp }), { expirationTtl: INVITE_TTL });
  return { ok: true, exp };
}

export async function joinInvite(env, id) {
  const inv = await env.WG.get(`inv:${id}`, "json");
  if (!inv || !(inv.exp > Date.now())) throw httpError(404, "Einladung abgelaufen oder ungültig – bitte um einen neuen Link");
  return json({ wg: inv.wg, iv: inv.iv, box: inv.box, exp: inv.exp });
}
