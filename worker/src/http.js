// Antworten, Fehler, CORS und sicheres Abrufen fremder Seiten

export const ALLOWED_ORIGINS = [
  /^https:\/\/jodbaer\.github\.io$/,
  /^https:\/\/bringfrisch-test\.bringfrisch-worker\.workers\.dev$/, // Test-Seite (tools/build_stage.mjs)
  /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];
// Rezept-Link: jede https-Seite mit Rezeptdaten (schema.org). Nur auf Knopfdruck, eine Seite, nur Fakten.
export const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[|\d+$)|\.(local|internal)$/;
// Fremde Seite holen: nur https und nur normale Hosts – auch nach jeder Weiterleitung geprüft (höchstens 3)
export async function safeFetch(link, headers) {
  let u = new URL(link);
  for (let hop = 0; hop < 4; hop++) {
    if (u.protocol !== "https:" || BLOCKED_HOSTS.test(u.hostname)) throw httpError(400, "Nur normale Webseiten (https://…)");
    const res = await fetch(u.toString(), { headers, redirect: "manual" });
    const to = res.status >= 300 && res.status < 400 && res.headers.get("Location");
    if (!to) return res;
    u = new URL(to, u);
  }
  throw httpError(502, "Zu viele Weiterleitungen");
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function body(request) {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "JSON erwartet");
  }
}

export function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.some(re => re.test(origin));
  return ok
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-WG-PIN, X-WG",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}
