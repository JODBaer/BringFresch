// Rezept-Link importieren (schema.org) und Vorschaubild zum Rezept
import { BLOCKED_HOSTS, httpError, json, safeFetch } from "./http.js";
import "../../static/core.js"; // cleanNutrition: Nährwerte der Rezeptseite säubern (gleiche Regel wie in der App)
const { cleanNutrition } = globalThis.BF_CORE;

// ---------------------------------------------------------------------------------------------
// Bild zum Rezept (Wochenwahl): einmal von der Rezeptseite holen (og:image bzw. schema.org image) und im
// WG-Server ablegen – nur für verbundene WGs (PIN), nie im öffentlichen Repo. Pro Rezept-Link genau ein Abruf,
// danach aus dem Speicher; gibt es kein Bild, merkt sich der Server das 7 Tage (kein erneutes Anfragen).
export const IMG_MAX = 1_600_000;
export const IMG_V = 3; // «kein Bild» aus älteren Versionen wird neu geprüft (v3: Joël & Muriel http-Bild, gemuese.ch ohne og:image – Issue #9)
// kleinere Fassung des Vorschaubilds, wo die Seite das anbietet (Betty Bossi liefert sonst bis 1.2 MB)
export function smallerImage(u) {
  const s = u.toString();
  if (u.hostname === "media.bettybossi.ch" && /\/-FJPG$/.test(s)) return s.replace(/\/-FJPG$/, "/-B640-FJPG");
  if (u.hostname === "res.cloudinary.com") return s.replace(/\/w_1200,h_630,/, "/w_640,h_400,");
  if (u.hostname === "recipecontent.fooby.ch") return s.replace(/\/3_2_1200_800\.jpeg$/, "/3_2_480_320.jpeg"); // ~95 statt ~490 KB
  // Shopify (z.B. Joël & Muriel: PNG-Screenshots ~200 KB) und gemuese.ch (Umbraco) verkleinern über ?width=
  if (/\/cdn\/shop\//.test(u.pathname) || (/(^|\.)gemuese\.ch$/.test(u.hostname) && u.pathname.startsWith("/media/"))) {
    const x = new URL(s);
    x.searchParams.set("width", "640");
    if (x.searchParams.has("height")) x.searchParams.set("height", "360");
    return x.toString();
  }
  return s;
}
async function imageKey(link) {
  let u;
  try { u = new URL(String(link || "")); } catch { throw httpError(400, "Kein Link"); }
  if (u.protocol !== "https:" || BLOCKED_HOSTS.test(u.hostname)) throw httpError(400, "Nur normale Webseiten (https://…)");
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(u.toString()));
  return { u, key: "img:" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("") };
}
// Verkleinerte Fassung vom Handy (Joshua 19.11.: Bilder komprimiert auf Cloudflare): ersetzt das gespeicherte Original,
// aber nur wenn es schon eines gibt und die neue Fassung kleiner ist und wirklich ein JPEG/WebP ist – so kann niemand
// fremde Bilder unterschieben oder grösser machen. Danach laden alle Handys gleich die kleine Fassung.
export const IMG_SMALL_MAX = 250_000;
export async function storeSmallImage(env, link, request) {
  const { key } = await imageKey(link);
  const kv = env.RAW || env.WG;
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  if (!/^image\/(webp|jpeg)$/.test(type)) throw httpError(400, "Nur WebP oder JPEG");
  const buf = await request.arrayBuffer();
  const b = new Uint8Array(buf);
  const isJpeg = b[0] === 0xff && b[1] === 0xd8, isWebp = b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (!buf.byteLength || buf.byteLength > IMG_SMALL_MAX || !(isJpeg || isWebp)) throw httpError(400, "Kein gültiges Bild");
  const hit = await kv.getWithMetadata(key, "arrayBuffer");
  if (!hit || hit.value == null || (hit.metadata && hit.metadata.none)) return new Response(null, { status: 204 }); // nichts zu ersetzen
  if (hit.metadata && hit.metadata.small) return new Response(null, { status: 204 }); // schon verkleinert
  if (buf.byteLength >= hit.value.byteLength) return new Response(null, { status: 204 });
  await kv.put(key, buf, { metadata: { type, from: (hit.metadata && hit.metadata.from) || "", small: true } });
  return new Response(null, { status: 204 });
}
// Vorschaubild auf der Rezeptseite finden: og:image (die https-Fassung zuerst), twitter:image, schema.org image;
// sonst das erste Foto (JPEG/WebP) in <img>/<source> – gemuese.ch hat kein og:image (Issue #9)
export function pickImage(html) {
  const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i")); return m ? m[1] : ""; };
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const prop of ["og:image:secure_url", "og:image", "og:image:url", "twitter:image"]) {
    const tag = metas.find(t => new RegExp(`(property|name)\\s*=\\s*["']${prop}["']`, "i").test(t) && attr(t, "content"));
    if (tag) return attr(tag, "content");
  }
  const m = html.match(/"image"\s*:\s*(?:\[\s*)?(?:\{[^}]*?"url"\s*:\s*)?"(https:[^"]+)"/);
  if (m) return m[1];
  for (const tag of html.match(/<(img|source)\b[^>]*>/gi) || []) {
    for (const name of ["srcset", "data-srcset", "data-src", "src"]) {
      const v = attr(tag, name).trim().split(/\s+/)[0];
      if (v && !v.startsWith("data:") && /\.(jpe?g|webp)(\?|$)/i.test(v)) return v;
    }
  }
  return "";
}
export async function recipeImage(env, link) {
  const { u, key } = await imageKey(link);
  const kv = env.RAW || env.WG;
  const send = (buf, type, small) => new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=2592000", ...(small ? { "X-Img-Small": "1" } : {}) } });
  const hit = await kv.getWithMetadata(key, "arrayBuffer");
  if (hit && hit.value != null) {
    // kein Bild = 204 (kein Fehler: der Browser meldet 404 sonst als Fehler in der Konsole)
    if (hit.metadata && hit.metadata.none) { if (hit.metadata.v === IMG_V) return new Response(null, { status: 204 }); }
    else return send(hit.value, (hit.metadata && hit.metadata.type) || "image/jpeg", hit.metadata && hit.metadata.small);
  }
  const none = async () => { await kv.put(key, "", { metadata: { none: true, v: IMG_V }, expirationTtl: 7 * 86400 }); return new Response(null, { status: 204 }); };
  const UA = { "User-Agent": "Mozilla/5.0 (compatible; Obsonare-RecipeImport/1.1; private WG meal planner)" };
  let html = "";
  try {
    const res = await safeFetch(u.toString(), { ...UA, Accept: "text/html" });
    if (!res.ok) return none();
    html = (await res.text()).slice(0, 2_000_000);
  } catch { return none(); }
  const src = pickImage(html);
  if (!src) return none();
  let imgUrl;
  try { imgUrl = new URL(src.replace(/&amp;/g, "&"), u); } catch { return none(); }
  if (imgUrl.protocol === "http:") imgUrl.protocol = "https:"; // Joël & Muriel (Shopify) nennt das Bild mit http://
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
    res = await safeFetch(u.toString(), { "User-Agent": "Mozilla/5.0 (compatible; Obsonare-RecipeImport/1.1; private WG meal planner)", Accept: "text/html" });
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
    // gemuese.ch: keine schema.org-Daten, Zutaten nur im HTML (gleiche Regel wie tools/import_recipes.py)
    if (!ingredients.length) recipe = recipeFromGemuese(html);
    if (!ingredients.length && !recipe) throw httpError(422, "Keine Rezeptdaten auf der Seite gefunden – Zutaten von Hand einfügen");
    if (!recipe) {
      const og = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/) || [])[1];
      const title = og ? og.replace(/\s*[-|–].*$/, "") : (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
      const yieldText = (html.match(/itemprop="recipeYield"[^>]*>([^<]*)/) || [])[1] || "";
      // Nährwerte als Microdata (itemprop="calories" …), z.B. Swissmilk
      const micro = p => { const m = html.match(new RegExp(`itemprop="${p}"[^>]*?(?:content="([^"]*)"[^>]*>|>([\\s\\S]*?)<\\/)`)); return m ? text(m[1] || m[2] || "") : ""; };
      const nutrition = { calories: micro("calories"), proteinContent: micro("proteinContent"), fatContent: micro("fatContent"), carbohydrateContent: micro("carbohydrateContent") };
      recipe = { name: title.replace(/<[^>]+>/g, "").trim(), recipeIngredient: ingredients, recipeYield: yieldText, nutrition };
    }
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
    // schema.org NutritionInformation gilt pro Portion (servingSize); nur Zahlen, nur wenn plausibel – sonst schätzt die App
    nutrition: cleanNutrition([].concat(recipe.nutrition || [])[0]),
  };
}

// gemuese.ch (VSGP): <li class="list__ingredient"> mit Menge + Produkt, «Zutatenliste für 4 Personen», Zeit in .time__time
export function recipeFromGemuese(html) {
  if (!html.includes("c-recipe-ingredients")) return null;
  const strip = x => decodeEntities(x.replace(/<span class="brush">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const lines = [];
  for (const [, li] of html.matchAll(/<li class="list__ingredient">([\s\S]*?)<\/li>/g)) {
    const q = li.match(/ingredient__quantity">([\s\S]*?)<\/span>/);
    const p = li.indexOf('ingredient__product">');
    const name = p < 0 ? "" : strip(li.slice(p + 'ingredient__product">'.length));
    if (name) lines.push(`${q ? strip(q[1]) : ""} ${name}`.trim());
  }
  if (!lines.length) return null;
  const n = html.match(/Zutatenliste f(?:&#xFC;|ü)r (\d+) Personen/i);
  const t = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const min = html.match(/time__global">\s*<span class="time__time">\s*(\d+)\s*Min/);
  return { name: t ? strip(t[1]).split(" | ")[0].replace(/\s+Rezept$/, "") : "", recipeYield: n ? `${n[1]} Personen` : "", recipeIngredient: lines, totalTime: min ? `PT${min[1]}M` : "" };
}

export function decodeEntities(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
