// Rezept-Link importieren (schema.org) und Vorschaubild zum Rezept
import { BLOCKED_HOSTS, httpError, json, safeFetch } from "./http.js";

// ---------------------------------------------------------------------------------------------
// Bild zum Rezept (Wochenwahl): einmal von der Rezeptseite holen (og:image bzw. schema.org image) und im
// WG-Server ablegen – nur für verbundene WGs (PIN), nie im öffentlichen Repo. Pro Rezept-Link genau ein Abruf,
// danach aus dem Speicher; gibt es kein Bild, merkt sich der Server das 7 Tage (kein erneutes Anfragen).
export const IMG_MAX = 1_600_000;
export const IMG_V = 2; // «kein Bild» aus älteren Versionen (z.B. Betty Bossi zu gross) wird neu geprüft
// kleinere Fassung des Vorschaubilds, wo die Seite das anbietet (Betty Bossi liefert sonst bis 1.2 MB)
export function smallerImage(u) {
  const s = u.toString();
  if (u.hostname === "media.bettybossi.ch" && /\/-FJPG$/.test(s)) return s.replace(/\/-FJPG$/, "/-B640-FJPG");
  if (u.hostname === "res.cloudinary.com") return s.replace(/\/w_1200,h_630,/, "/w_640,h_400,");
  return s;
}
export async function recipeImage(env, link) {
  let u;
  try { u = new URL(String(link || "")); } catch { throw httpError(400, "Kein Link"); }
  if (u.protocol !== "https:" || BLOCKED_HOSTS.test(u.hostname)) throw httpError(400, "Nur normale Webseiten (https://…)");
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(u.toString()));
  const key = "img:" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const kv = env.RAW || env.WG;
  const send = (buf, type) => new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=2592000" } });
  const hit = await kv.getWithMetadata(key, "arrayBuffer");
  if (hit && hit.value != null) {
    // kein Bild = 204 (kein Fehler: der Browser meldet 404 sonst als Fehler in der Konsole)
    if (hit.metadata && hit.metadata.none) { if (hit.metadata.v === IMG_V) return new Response(null, { status: 204 }); }
    else return send(hit.value, (hit.metadata && hit.metadata.type) || "image/jpeg");
  }
  const none = async () => { await kv.put(key, "", { metadata: { none: true, v: IMG_V }, expirationTtl: 7 * 86400 }); return new Response(null, { status: 204 }); };
  const UA = { "User-Agent": "Mozilla/5.0 (compatible; BringFrisch-RecipeImport/1.1; private WG meal planner)" };
  let html = "";
  try {
    const res = await safeFetch(u.toString(), { ...UA, Accept: "text/html" });
    if (!res.ok) return none();
    html = (await res.text()).slice(0, 2_000_000);
  } catch { return none(); }
  const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i")); return m ? m[1] : ""; };
  let src = "";
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (/(property|name)\s*=\s*["'](og:image|og:image:url|twitter:image)["']/i.test(tag)) { src = attr(tag, "content"); if (src) break; }
  }
  if (!src) { const m = html.match(/"image"\s*:\s*(?:\[\s*)?(?:\{[^}]*?"url"\s*:\s*)?"(https:[^"]+)"/); if (m) src = m[1]; }
  if (!src) return none();
  let imgUrl;
  try { imgUrl = new URL(src.replace(/&amp;/g, "&"), u); } catch { return none(); }
  if (imgUrl.protocol !== "https:" || BLOCKED_HOSTS.test(imgUrl.hostname)) return none();
  const getImg = async url => {
    try {
      const res = await safeFetch(url, { ...UA, Accept: "image/avif,image/webp,image/jpeg,image/png,image/*" });
      const type = (res.headers.get("Content-Type") || "").split(";")[0].trim();
      if (!res.ok || !/^image\/(jpeg|png|webp|avif|gif)$/.test(type)) return null;
      const buf = await res.arrayBuffer();
      return buf.byteLength && buf.byteLength <= IMG_MAX ? { buf, type } : null;
    } catch { return null; }
  };
  const small = smallerImage(imgUrl);
  const got = (small !== imgUrl.toString() && await getImg(small)) || await getImg(imgUrl.toString());
  if (!got) return none();
  const { buf, type } = got;
  await kv.put(key, buf, { metadata: { type, from: imgUrl.hostname } });
  return send(buf, type);
}

// ---------------------------------------------------------------------------------------------
// Rezept-Link importieren (schema.org Recipe aus JSON-LD)
export async function importRecipe(link) {
  // auch geteilter Text wie «Schau mal: https://… 😋» geht – der erste Link zählt
  const found = String(link || "").match(/https?:\/\/[^\s<>"']+/);
  let u;
  try {
    u = new URL(found ? found[0].replace(/[),.!?]+$/, "") : link);
  } catch {
    throw httpError(400, "Kein Link gefunden");
  }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:" || BLOCKED_HOSTS.test(u.hostname)) throw httpError(400, "Nur normale Webseiten (https://…)");
  let res;
  try {
    res = await safeFetch(u.toString(), { "User-Agent": "Mozilla/5.0 (compatible; BringFrisch-RecipeImport/1.1; private WG meal planner)", Accept: "text/html" });
  } catch (e) {
    throw e.status === 400 ? e : httpError(502, "Seite nicht erreichbar");
  }
  if (!res.ok) throw httpError(502, `Seite nicht erreichbar (${res.status}) – Zutaten von Hand einfügen`);
  const html = (await res.text()).slice(0, 3_000_000);
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
    // Microdata (z.B. Swissmilk: Tabellenzeilen <tr itemprop="recipeIngredient">, Menge und Zutat in eigenen Zellen)
    const text = h => h.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let ingredients = [...html.matchAll(/<tr[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/tr>/g)]
      .filter(m => /amount/i.test(m[1])) // Zeilen ohne Menge sind Geräte («Bratpfanne»)
      .map(m => text(m[1])).filter(Boolean);
    if (!ingredients.length) {
      ingredients = [...html.matchAll(/<(li|span|div|p)[^>]*itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/\1>/g)].map(m => text(m[2])).filter(Boolean);
    }
    if (!ingredients.length) throw httpError(422, "Keine Rezeptdaten auf der Seite gefunden – Zutaten von Hand einfügen");
    const og = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/) || [])[1];
    const title = og ? og.replace(/\s*[-|–].*$/, "") : (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
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

export function decodeEntities(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
