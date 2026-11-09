// Layout-Prüfung der Plan-Ansicht in einem echten Browser (Edge/Chrome, headless).
//   node layout_check.mjs            -> prüft 390×844, 375×667, 390×600 in iPhone- und Android-Stil, hell und dunkel
//   node layout_check.mjs --shots    -> legt zusätzlich Bildschirmfotos in tests/shots/ ab
// Regeln (BringFrisch-Plan-Redesign.md §5): Mit einem offenen Tag bleiben alle 7 Tage sichtbar;
// beim Aufklappen bewegt sich nichts ausser dem geöffneten Tag (Zeilen darüber, Kopfzeile, Schrift bleiben stehen).
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const page0 = pathToFileURL(path.join(here, "..", "static", "index.html")).href;
const shots = process.argv.includes("--shots");
const browserPath = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(p => p && existsSync(p));
if (!browserPath) { console.log("Kein Chromium-Browser gefunden (BROWSER=… setzen)"); process.exit(1); }
if (shots) mkdirSync(path.join(here, "shots"), { recursive: true });

let fails = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ["--allow-file-access-from-files", "--no-first-run", "--no-default-browser-check", "--disable-gpu"], userDataDir: path.join(process.env.TEMP || here, "bf-layout-profile") });
const sizes = [[390, 844], [375, 667], [390, 600]];
for (const os of ["ios", "android"]) {
  for (const scheme of ["light", "dark"]) {
    for (const [w, h] of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      await page.evaluateOnNewDocument(() => {
        try { localStorage.setItem("bringfrisch_wahl_" + "x", "true"); } catch (e) {}
      });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`${page0}?os=${os}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await new Promise(r => setTimeout(r, 900));
      // Wochenwahl-Pop-up wegklicken, falls es erscheint
      await page.evaluate(() => { const p = document.getElementById("wpop"); if (!p.hidden) document.getElementById("wlater").click(); });
      await new Promise(r => setTimeout(r, 700));

      const tag = `${os}/${scheme} ${w}×${h}`;
      const res = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const rows = () => [...document.querySelectorAll("#days .prow")];
        const navTop = document.querySelector(".bnav").getBoundingClientRect().top;
        const barBottom = document.getElementById("appbar").getBoundingClientRect().bottom;
        const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
        const out = { density: [...document.documentElement.classList].filter(c => /^d\d$/.test(c)).join("") || "d0", perDay: [], hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
        const closed = rows().map(r => rect(r));
        const closedFont = getComputedStyle(rows()[0].querySelector(".t")).fontSize;
        for (let i = 0; i < 7; i++) {
          rows()[i].querySelector(".pday").click();
          await wait(450);
          const rs = rows();
          const last = rs[6].getBoundingClientRect();
          const head = rs[i].querySelector(".phead").getBoundingClientRect();
          const aboveStill = rs.slice(0, i).every((r, k) => Math.abs(r.getBoundingClientRect().top - closed[k].top) < 0.5 && Math.abs(r.getBoundingClientRect().height - closed[k].height) < 0.5);
          const belowSameSize = rs.slice(i + 1).every((r, k) => Math.abs(r.getBoundingClientRect().height - closed[i + 1 + k].height) < 0.5);
          out.perDay.push({
            i,
            fits: last.bottom <= navTop + 0.5 && rs[0].getBoundingClientRect().top >= barBottom - 0.5,
            lastBottom: Math.round(last.bottom), navTop: Math.round(navTop),
            headTopStill: Math.abs(head.top - closed[i].top) < 0.5,
            aboveStill, belowSameSize,
            fontSame: getComputedStyle(rs[i].querySelector(".t")).fontSize === closedFont,
            scrolled: document.getElementById("scroller").scrollTop,
          });
          rows()[i].querySelector(".pday").click();
          await wait(450);
        }
        return out;
      });
      const bad = res.perDay.filter(d => !d.fits);
      check(bad.length === 0, `${tag} [${res.density}]: alle 7 Tage sichtbar mit offenem Tag${bad.length ? " – nicht bei " + bad.map(d => `${d.i} (${d.lastBottom} > ${d.navTop})`).join(", ") : ""}`);
      check(res.perDay.every(d => d.headTopStill && d.aboveStill && d.belowSameSize && d.fontSame && d.scrolled === 0), `${tag}: Aufklappen bewegt nur den offenen Tag`);
      check(!res.hScroll, `${tag}: kein seitliches Scrollen`);
      check(errors.length === 0, `${tag}: keine JS-Fehler ${errors.join(" | ")}`);
      if (shots) {
        await page.evaluate(() => document.querySelectorAll("#days .prow")[2].querySelector(".pday").click());
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(here, "shots", `${os}-${scheme}-${w}x${h}.png`) });
      }
      await page.close();
    }
  }
}
await browser.close();
console.log(fails ? `\n${fails} FEHLER` : "\nALLES OK");
process.exit(fails ? 1 : 0);
