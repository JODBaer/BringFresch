// Feste Uhr + fester Zufall für jsdom-Fenster, damit jeder Testlauf gleich verläuft (lokal und in CI).
// STANDARD_NOW: Dienstag, 10.11.2026 12:00 (KW 46, November-Saison).
const STANDARD_NOW = "2026-11-10T12:00:00";

// Mulberry32: kleiner, fester Pseudo-Zufall statt Math.random
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// realNow: Date.now() läuft echt weiter (nötig, wo der Worker «neuerer Stand gewinnt» mit Date.now() vergleicht);
// das Kalenderdatum (new Date()) bleibt trotzdem fest.
function fixWindow(win, { now = STANDARD_NOW, seed = 46, realNow = false } = {}) {
  const Real = win.Date;
  const fixed = new Real(now).getTime();
  win.Date = class extends Real {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return realNow ? Real.now() : fixed; }
  };
  win.Math.random = seededRandom(seed);
}

module.exports = { STANDARD_NOW, seededRandom, fixWindow };
