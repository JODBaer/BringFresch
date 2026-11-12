// BringFrisch – Theme: Formen, Stil iPhone (Glas) / Android (Material 3), Farben (Akzent, Hintergrund), Hell/Dunkel.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { STORE, load, save, remove, OS_KEY, THEME_KEY, MODE_KEY, $, esc, toast } = app;

  // ---------------------------------------------------------------------------
  // Rahmen: Formen, Stil (iPhone/Android), Bring!-Chip, Wochenwahl-Pop-up, Navigation, Scrollbalken
  // ---------------------------------------------------------------------------
  // Ausdrucksstarke Formen: Keks (9 Wellen, «heute») und Blume (6 Blätter, Ladeanzeige)
  (function shapes() {
    const enc = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    const shape = (waves, amp) => {
      let d = "";
      for (let k = 0; k <= 200; k++) {
        const a = k / 200 * Math.PI * 2;
        const r = 50 - amp + amp * Math.cos(waves * a);
        d += (k ? "L" : "M") + (50 + r * Math.cos(a)).toFixed(2) + " " + (50 + r * Math.sin(a)).toFixed(2);
      }
      return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}Z"/></svg>`);
    };
    document.documentElement.style.setProperty("--cookie", shape(9, 4));
    document.documentElement.style.setProperty("--flower", shape(6, 9));
  })();

  function currentOs() { return document.documentElement.classList.contains("m3") ? "m3" : "glass"; }
  function setOs(v) {
    document.documentElement.classList.remove("m3", "glass");
    document.documentElement.classList.add(v);
    STORE.saveText(OS_KEY, v);
    osLabels();
    applyTheme();
    app.fitDensity();
  }
  function osLabels() {
    const v = currentOs();
    $("setOsBtn").textContent = v === "glass" ? "iPhone" : "Android";
  }
  osLabels();
  $("setOsBtn").onclick = () => setOs(currentOs() === "glass" ? "m3" : "glass");

  // ---------------------------------------------------------------------------
  // Farben: Akzent und Hintergrund pro Handy wählbar (je 3 Vorgaben + eigene Farbe).
  // «Standard» = die Farben aus index.html; sonst werden die Tokens aus der Wahl berechnet.
  // ---------------------------------------------------------------------------
  const ACCENTS = [["", "Hellgrün", "#90ee90"], ["#93c572", "Pistazie", "#93c572"], ["#8ecae6", "Himmelblau", "#8ecae6"]];
  const BGS = [["", "Standard", "#f3f9ee"], ["#f7f7f5", "Weiss", "#f7f7f5"], ["#f4ede1", "Sand", "#f4ede1"]];
  let theme = { accent: "", bg: "", ...(load(THEME_KEY, {}) || {}) };
  let themeProps = [];

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [(h + 360) % 360, s * 100, l * 100];
  }
  const hsl = (h, s, l) => `hsl(${Math.round((h + 360) % 360)} ${Math.round(Math.max(0, Math.min(100, s)))}% ${Math.round(Math.max(0, Math.min(100, l)))}%)`;

  // Tokens aus der Akzentfarbe (gleiche Rollen wie die Vorgabe: Hellgrün → Pistazie → dunkles Grün)
  function accentVars(hex, dark, os) {
    const [h, s0, l0] = hexToHsl(hex), s = Math.max(s0, 25), deepS = Math.min(45, Math.max(20, s * 0.35));
    const bright = hsl(h, s, Math.max(l0, 68));
    if (!dark) return {
      "--today": hsl(h, s, Math.max(l0, 72)), "--on-today": hsl(h, 40, 15),
      "--pist": hsl(h - 12, s * 0.5, 61), "--on-pist": hsl(h, 40, 14),
      "--primary": hsl(h, deepS, os === "m3" ? 42 : 30), "--on-primary": hsl(h, 70, 96),
      "--pc": hsl(h, Math.min(s, 80), 88), "--on-pc": hsl(h, 25, 15),
      "--sec-c": hsl(h - 20, 45, 88), "--on-sec-c": hsl(h - 20, 35, 16),
      "--accent": hsl(h, deepS, os === "m3" ? 42 : 30), "--on-accent": hsl(h, 70, 96),
      "--brand": hsl(h, Math.min(s, 45), 45),
    };
    return {
      "--today": os === "m3" ? hsl(h, deepS, 30) : bright, "--on-today": os === "m3" ? hsl(h, 70, 95) : hsl(h, 40, 15),
      "--pist": hsl(h - 12, s * 0.5, 58), "--on-pist": hsl(h, 40, 12),
      "--primary": bright, "--on-primary": hsl(h, 40, 15),
      "--pc": hsl(h, deepS, 30), "--on-pc": hsl(h, 70, 92),
      "--sec-c": hsl(h - 20, 25, 22), "--on-sec-c": hsl(h - 20, 50, 85),
      "--accent": bright, "--on-accent": hsl(h, 40, 15),
      "--brand": bright,
    };
  }

  // Tokens aus dem Hintergrund (Flächen leicht abgestuft; nachts derselbe Farbton, dunkel)
  function bgVars(hex, dark, os, accentHex) {
    const [h, s0] = hexToHsl(hex), l = Math.max(88, hexToHsl(hex)[2]), s = Math.min(s0, 60);
    const [ah, as] = hexToHsl(accentHex || "#90ee90");
    if (!dark) {
      const v = {
        "--bg": hsl(h, s, l), "--s0": hsl(h, s, l), "--s1": hsl(h, s, l - 3), "--s2": hsl(h, s, l - 6), "--s3": hsl(h, s, l - 9), "--s4": hsl(h, s, l - 12),
        "--line": hsl(h, s * 0.6, l - 14), "--outline": hsl(h, s * 0.5, l - 20),
      };
      if (os === "m3") v["--surface"] = hsl(h, s, Math.min(99, l + 2));
      else v["--mesh"] = `radial-gradient(60% 45% at 12% 8%, ${hsl(ah, Math.min(as, 80), 88)} 0%, transparent 70%), radial-gradient(55% 40% at 95% 22%, ${hsl(h, s, l - 6)} 0%, transparent 70%), radial-gradient(70% 45% at 18% 78%, ${hsl(ah - 20, 45, 90)} 0%, transparent 70%), radial-gradient(60% 40% at 92% 92%, ${hsl(h, s, l - 9)} 0%, transparent 70%), linear-gradient(${hsl(h, s, l)}, ${hsl(h, s, l - 2)})`;
      return v;
    }
    const ds = Math.min(s, 25);
    const v = {
      "--bg": hsl(h, ds, 7), "--s0": hsl(h, ds, 7), "--s1": hsl(h, ds, 10), "--s2": hsl(h, ds, 12), "--s3": hsl(h, ds, 16), "--s4": hsl(h, ds, 20),
      "--line": hsl(h, ds, 17), "--outline": hsl(h, ds, 26),
    };
    if (os === "m3") v["--surface"] = hsl(h, ds, 10);
    else v["--mesh"] = `radial-gradient(60% 45% at 12% 8%, ${hsl(ah, 30, 20)} 0%, transparent 70%), radial-gradient(55% 40% at 95% 22%, ${hsl(h, ds, 16)} 0%, transparent 70%), radial-gradient(70% 45% at 18% 78%, ${hsl(ah - 20, 30, 16)} 0%, transparent 70%), radial-gradient(60% 40% at 92% 92%, ${hsl(h, ds, 14)} 0%, transparent 70%), linear-gradient(${hsl(h, ds, 6)}, ${hsl(h, ds, 8)})`;
    return v;
  }

  // Hell / Dunkel / Automatisch (pro Handy). Das CSS hört nur auf html.dark; index.html setzt es schon vor dem ersten Bild.
  const darkMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const getMode = () => { const m = STORE.loadText(MODE_KEY); return m === "light" || m === "dark" ? m : "auto"; };
  const isDark = () => { const m = getMode(); return m === "dark" || (m === "auto" && !!(darkMq && darkMq.matches)); };
  function applyTheme() {
    document.documentElement.classList.toggle("dark", isDark());
    if ($("modeSelect")) $("modeSelect").value = getMode();
    const st = document.documentElement.style, dark = isDark(), os = currentOs();
    themeProps.forEach(k => st.removeProperty(k));
    const vars = { ...(theme.accent ? accentVars(theme.accent, dark, os) : {}), ...(theme.bg ? bgVars(theme.bg, dark, os, theme.accent) : {}) };
    for (const [k, v] of Object.entries(vars)) st.setProperty(k, v);
    themeProps = Object.keys(vars);
    renderThemePick();
    syncThemeColor();
  }
  // Statusleiste oben (Android/Chrome) und Taskwechsler in der Hintergrundfarbe des Designs
  function syncThemeColor() {
    const meta = document.getElementById("themeColor");
    if (!meta || !document.body) return;
    const c = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || getComputedStyle(document.body).backgroundColor;
    if (c) meta.setAttribute("content", c);
  }
  if (darkMq && darkMq.addEventListener) darkMq.addEventListener("change", applyTheme);
  $("modeSelect").onchange = () => {
    const v = $("modeSelect").value;
    if (v === "auto") remove(MODE_KEY); else STORE.saveText(MODE_KEY, v);
    applyTheme();
    toast(v === "auto" ? "Hell/Dunkel wie das Handy ✓" : v === "dark" ? "Dunkel ✓" : "Hell ✓");
  };

  function renderThemePick() {
    const pick = (id, key, list) => {
      const cur = theme[key], custom = cur && !list.some(([v]) => v === cur);
      $(id).innerHTML = list.map(([v, name, show]) => `<button type="button" class="swatch" data-${key}="${v}" aria-pressed="${cur === v}"><i style="background:${show}"></i>${name}</button>`).join("")
        + `<label class="swatch custom" aria-pressed="${!!custom}"><i${custom ? ` style="background:${esc(cur)}"` : ""}>＋<input type="color" data-custom="${key}" value="${custom ? esc(cur) : list[0][2]}" aria-label="Eigene Farbe"></i>Eigene</label>`;
    };
    pick("accentPick", "accent", ACCENTS);
    pick("bgPick", "bg", BGS);
  }
  function setTheme(key, value) {
    theme = { ...theme, [key]: value };
    save(THEME_KEY, theme);
    applyTheme();
  }
  for (const id of ["accentPick", "bgPick"]) {
    $(id).addEventListener("click", e => {
      const b = e.target.closest("button.swatch");
      if (!b) return;
      if (b.dataset.accent !== undefined) setTheme("accent", b.dataset.accent);
      if (b.dataset.bg !== undefined) setTheme("bg", b.dataset.bg);
    });
    $(id).addEventListener("change", e => {
      const c = e.target.closest("[data-custom]");
      if (c && /^#[0-9a-f]{6}$/i.test(c.value)) setTheme(c.dataset.custom, c.value.toLowerCase());
    });
  }
  applyTheme();
})();
