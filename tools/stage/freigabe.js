// Test-Freigabe – NUR in der Test-Version (tools/build_stage.mjs kopiert diese Datei nach dist-stage/ und
// macht aus dem «TEST»-Band einen Knopf). Die WG-App enthält davon nichts.
// Band antippen -> Blatt «Neu zum Testen»: Änderungen seit dem letzten Release (freigabe.json, beim Bau erzeugt),
// «Freigeben» (setzt über den Test-Server den nächsten Release-Tag) und «Problem melden» (GitHub-Issue).
(function () {
  "use strict";
  const band = document.getElementById("stageBand");
  if (!band) return;
  const conn = () => (window.BF_STORE && window.BF_STORE.load("bringfrisch_sync", {})) || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let info = { sha: "", base: "", version: "", changes: [] }, status = null;

  async function api(path, body) {
    const c = conn();
    if (!c.pin) throw new Error("Zuerst mit der Test-PIN verbinden (Einstellungen)");
    const res = await fetch((c.url || location.origin).replace(/\/$/, "") + path, {
      method: body ? "POST" : "GET",
      headers: { "X-WG-PIN": c.pin, ...(c.wg ? { "X-WG": c.wg } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    return data;
  }

  const css = document.createElement("style");
  css.textContent = `
#stageBand{pointer-events:auto!important;cursor:pointer;border:0}
#stageBand em{font-style:normal;font-weight:600;letter-spacing:0;margin-left:6px;background:rgba(0,0,0,.18);border-radius:99px;padding:0 7px}
.bfr-scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10000}
.bfr-sheet{position:fixed;left:0;right:0;bottom:0;z-index:10001;background:var(--surface,#fff);color:var(--fg,#1c1917);
  border-radius:22px 22px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));max-height:80vh;overflow:auto;
  font:15px/1.4 var(--font,system-ui);box-shadow:0 -8px 30px rgba(0,0,0,.2);max-width:560px;margin:0 auto}
.bfr-grip{width:36px;height:4px;border-radius:2px;background:var(--line,#ddd);margin:0 auto 12px}
.bfr-sheet h2{font-size:17px;margin:0 0 2px}.bfr-sheet small{color:var(--muted,#777);font-size:12px}
.bfr-sheet ul{margin:12px 0 14px;padding:0;list-style:none;display:grid;gap:8px}
.bfr-sheet li{display:flex;gap:8px;font-size:14px}.bfr-sheet li i{font-style:normal;color:var(--muted,#777);font-size:12px;min-width:26px}
.bfr-btns{display:flex;gap:8px;margin-top:4px}
.bfr-btn{flex:1;border:0;border-radius:999px;padding:11px 12px;font:600 14px var(--font,system-ui);cursor:pointer}
.bfr-ok{background:var(--primary,#93C572);color:var(--on-primary,#10210a)}
.bfr-no{background:transparent;color:#c2410c;border:1px solid var(--line,#ddd)}
.bfr-btn:disabled{opacity:.6}
.bfr-sheet textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);background:var(--bg,#fafafa);color:inherit;border-radius:12px;padding:10px;font:15px var(--font,system-ui);min-height:90px;margin:12px 0 8px}
.bfr-msg{font-size:14px;margin:10px 0 0}.bfr-msg a{color:inherit;font-weight:600}
.bfr-err{color:#c2410c}`;
  document.head.appendChild(css);

  function setBand() {
    const n = info.changes.length;
    const tag = status && status.released ? "freigegeben ✓" : n ? `${n} neu ›` : "";
    band.innerHTML = `TEST · Bring!-Liste «Home-test»${tag ? `<em>${esc(tag)}</em>` : ""}`;
  }

  let open = null;
  function close() { if (open) { open.remove(); open = null; } }
  function sheet(html) {
    close();
    open = document.createElement("div");
    open.innerHTML = `<div class="bfr-scrim"></div><div class="bfr-sheet" role="dialog" aria-modal="true" aria-label="Test-Freigabe"><div class="bfr-grip"></div>${html}</div>`;
    open.querySelector(".bfr-scrim").onclick = close;
    document.body.appendChild(open);
    return open.querySelector(".bfr-sheet");
  }

  function showList() {
    const n = info.changes.length;
    const done = status && status.released;
    const feats = info.changes.filter(c => c.feat).length; // nur neue Funktionen brauchen die Freigabe; Fixes gehen von selbst raus
    const el = sheet(`
      <h2>${done ? "Freigegeben" : n ? "Neu zum Testen" : "Nichts Neues"}</h2>
      <small>${done ? `Dieser Stand ist ${esc(status.tag)}` : `seit ${esc(info.base || "letztem Release")} · ${n} Änderung${n === 1 ? "" : "en"}`} · Version ${esc(info.version)}</small>
      ${n ? `<ul>${info.changes.map(c => `<li><i>${c.n ? "#" + esc(c.n) : "·"}</i>${c.feat ? "<b>neu</b> · " : ""}${esc(c.title)}</li>`).join("")}</ul>` : ""}
      ${n && !done && !feats ? `<p class="bfr-msg">Nur kleine Fixes: gehen nach der Release-Prüfung automatisch zur WG.</p>` : ""}
      ${n && !done && feats ? `<div class="bfr-btns"><button class="bfr-btn bfr-ok" type="button" data-a="ok">Freigeben</button><button class="bfr-btn bfr-no" type="button" data-a="no">Problem melden</button></div>` : `<div class="bfr-btns"><button class="bfr-btn bfr-no" type="button" data-a="no">Problem melden</button></div>`}
      <p class="bfr-msg" hidden></p>`);
    const msg = el.querySelector(".bfr-msg");
    const ok = el.querySelector('[data-a="ok"]');
    if (ok) ok.onclick = async () => {
      ok.disabled = true; ok.textContent = "Wird freigegeben …";
      try {
        const r = await api("/release/approve", { sha: info.sha });
        status = { released: true, tag: r.tag };
        setBand();
        el.querySelector("h2").textContent = "Freigegeben";
        el.querySelector(".bfr-btns").remove();
        msg.hidden = false;
        msg.innerHTML = `${esc(r.tag)} wird gebaut: Tests, dann WG-Server und WG-App. Dauert ca. 10 Min.<br><a href="${esc(r.url)}" target="_blank" rel="noopener">Stand ansehen ↗</a>`;
      } catch (e) {
        ok.disabled = false; ok.textContent = "Freigeben";
        msg.hidden = false; msg.className = "bfr-msg bfr-err"; msg.textContent = e.message;
      }
    };
    el.querySelector('[data-a="no"]').onclick = showProblem;
  }

  function showProblem() {
    const el = sheet(`
      <h2>Problem melden</h2>
      <small>geht als Notiz (Issue) an GitHub · es wird nichts freigegeben</small>
      <textarea id="bfrText" aria-label="Was stimmt nicht?" placeholder="Was stimmt nicht? Wo? Welches Handy?"></textarea>
      <div class="bfr-btns"><button class="bfr-btn bfr-ok" type="button" data-a="send">Senden</button><button class="bfr-btn bfr-no" type="button" data-a="back">Zurück</button></div>
      <p class="bfr-msg" hidden></p>`);
    const msg = el.querySelector(".bfr-msg"), send = el.querySelector('[data-a="send"]');
    el.querySelector('[data-a="back"]').onclick = showList;
    send.onclick = async () => {
      send.disabled = true;
      try {
        const r = await api("/release/issue", { text: el.querySelector("#bfrText").value, version: info.version, sha: info.sha });
        el.querySelector(".bfr-btns").remove();
        el.querySelector("textarea").disabled = true;
        msg.hidden = false; msg.className = "bfr-msg";
        msg.innerHTML = `Gemeldet als <a href="${esc(r.url)}" target="_blank" rel="noopener">#${esc(r.number)}</a>. Claude kann es von dort übernehmen.`;
      } catch (e) {
        send.disabled = false;
        msg.hidden = false; msg.className = "bfr-msg bfr-err"; msg.textContent = e.message;
      }
    };
    el.querySelector("textarea").focus();
  }

  band.addEventListener("click", showList);
  band.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showList(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  fetch("freigabe.json", { cache: "no-store" }).then(r => r.json()).then(d => { info = { ...info, ...d }; setBand(); })
    .then(() => conn().pin && info.sha ? api("/release/status?sha=" + encodeURIComponent(info.sha)) : null)
    .then(s => { if (s && s.enabled) { status = s; setBand(); } })
    .catch(() => { /* ohne Netz/ohne Datei: Band bleibt wie es ist */ });
})();
