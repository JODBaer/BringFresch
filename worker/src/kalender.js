// Kalender-Abo (iCal) aus dem Wochenplan
import { scoped, timingSafeEqual } from "./auth.js";

// Reine Regeln, die auch die App benutzt (Wochenrechnung): dieselbe Datei wie im Browser, legt BF_CORE ab
import "../../static/core.js";
const { mondayOf, weekAfter } = globalThis.BF_CORE;

// ---------------------------------------------------------------------------------------------
// Kalender-Abo (iCal)
export const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function icsEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lange Zeilen nach RFC 5545 auf 75 Bytes falten
export function fold(line) {
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

export function stamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function calendar(env, token, params = new URLSearchParams()) {
  if (!env.CAL_TOKEN || !timingSafeEqual(token, env.CAL_TOKEN.trim())) {
    const slug = /^[\w-]{16,}$/.test(token) ? await env.WG.get(`cal:${token}`) : null;
    if (!slug) return new Response("Not found", { status: 404 });
    env = { ...env, WG: scoped(env.WG, `w:${slug}:`) };
  }
  const doc = (await env.WG.get("plan", "json")) || {};
  const nextKey = weekAfter(doc.week);
  const next = nextKey ? await env.WG.get(`plan:${nextKey}`, "json") : null;
  const me = String(params.get("me") || "").slice(0, 60);
  const week = /^\d{4}-W\d{2}$/.test(params.get("week") || "") ? params.get("week") : "";
  const dl = params.get("dl") === "1";
  const docs = week ? [doc.week === week ? doc : next && next.week === week ? next : await env.WG.get(`plan:${week}`, "json")] : [doc, next];
  const meName = me && ((doc.members || []).find(m => m.id === me) || {}).name;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BringFrisch//WG-Znacht//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:BringFrisch Znacht${meName ? ` (${icsEscape(meName)})` : ""}`, "X-WR-TIMEZONE:Europe/Zurich", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const d of docs) if (d) lines.push(...events(d, { me, dl }));
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": dl ? "no-store" : "max-age=300",
      ...(dl ? { "Content-Disposition": `attachment; filename="BringFrisch-${week || doc.week || "Woche"}.ics"` } : {}),
    },
  });
}

// KW nach der angegebenen ("2026-W46" -> "2026-W47")
// Termine einer Woche (noch offene Tage bekommen keinen)
export function events(doc, { me = "", dl = false } = {}) {
  const lines = [];
  const monday = mondayOf(doc.week);
  if (monday && Array.isArray(doc.plan)) {
    const names = Object.fromEntries((doc.members || []).map(m => [m.id, m.name]));
    const [hh, mm] = (doc.dinnerTime || "18:30").split(":").map(Number);
    doc.plan.forEach((day, i) => {
      if (!day || !day.title || day.empty) return; // noch offen: kein Termin
      const eaters = (day.eaters || []).map(id => names[id] || id);
      if (eaters.length === 0 && !day.extra_guests) return; // niemand zuhause
      if (me && !(day.eaters || []).includes(me)) return; // persönlich: nur meine Abende
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
        day.time && day.time_by ? `Zeit geändert von ${day.time_by}` : "",
        day.source_url ? `Rezept: ${day.source_url}` : "",
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:bringfrisch-${dl ? "dl-" : ""}${doc.week}-${i}${me ? `-${me}` : ""}@bringfrisch`,
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
  return lines;
}
