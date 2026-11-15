// BringFrisch – Hofläden & Märkte: Blatt mit OpenStreetMap-Karte und Liste (Öffnungszeiten, Entfernung).
// Daten: static/hoflaeden.js (tools/update_hoflaeden.mjs). Kartenbilder kommen erst beim Öffnen von tile.openstreetmap.org.
// Der Standort wird nur auf Knopfdruck gefragt und nie gespeichert. Regeln (Zeiten, Entfernung): core.js.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { state, $, esc, toast, CORE } = app;
  const DATA = () => (window.BF_HOF && window.BF_HOF.items) || [];
  const RAPPERSWIL = { lat: 47.2267, lon: 8.8184 }; // ohne Standort: von hier aus gemessen
  const KIND = { hof: "Hofladen", markt: "Markt", automat: "Hofautomat" };
  const TILE = 256, ZMIN = 9, ZMAX = 16;
  const H = () => state.hof;

  // Web-Mercator: Grad <-> Pixel der ganzen Welt bei Zoom z
  const toPx = (lat, lon, z) => {
    const n = TILE * 2 ** z, r = lat * Math.PI / 180;
    return { x: (lon + 180) / 360 * n, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n };
  };
  const toDeg = (x, y, z) => {
    const n = TILE * 2 ** z;
    return { lon: x / n * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI };
  };
  const ref = () => H().ref || RAPPERSWIL;
  const kmText = km => (km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);
  const list = () => CORE.farmList(DATA(), { kind: H().kind, openOnly: H().openOnly, ref: ref(), now: new Date() });

  function renderMap(items) {
    const box = $("hofMap"), W = box.clientWidth || 340, Hh = box.clientHeight || 240, z = H().z;
    const c = H().center || ref();
    const mid = toPx(c.lat, c.lon, z), x0 = mid.x - W / 2, y0 = mid.y - Hh / 2;
    const max = 2 ** z, html = [];
    for (let tx = Math.floor(x0 / TILE); tx * TILE < x0 + W; tx++) {
      for (let ty = Math.floor(y0 / TILE); ty * TILE < y0 + Hh; ty++) {
        if (ty < 0 || ty >= max) continue;
        html.push(`<img alt="" loading="lazy" src="https://tile.openstreetmap.org/${z}/${((tx % max) + max) % max}/${ty}.png" style="left:${Math.round(tx * TILE - x0)}px;top:${Math.round(ty * TILE - y0)}px">`);
      }
    }
    items.forEach((it, i) => {
      const p = toPx(it.lat, it.lon, z), x = p.x - x0, y = p.y - y0;
      if (x < -10 || y < -10 || x > W + 10 || y > Hh + 10) return;
      html.push(`<button type="button" class="hofpin ${it.k}${it.state && !it.state.open ? " closed" : ""}${H().sel === it.n + it.lat ? " sel" : ""}" data-hi="${i}" style="left:${Math.round(x)}px;top:${Math.round(y)}px" aria-label="${esc(it.n)}"></button>`);
    });
    if (H().ref) { const p = toPx(H().ref.lat, H().ref.lon, z); html.push(`<span class="hofpin me" style="left:${Math.round(p.x - x0)}px;top:${Math.round(p.y - y0)}px"></span>`); }
    $("hofTiles").innerHTML = html.join("");
  }

  function renderHof() {
    const all = DATA(), items = list(), h = H();
    const stand = window.BF_HOF && window.BF_HOF.stand ? ` · Stand ${window.BF_HOF.stand.split("-").reverse().join(".")}` : "";
    $("hofSub").textContent = `${all.length} Orte aus OpenStreetMap${stand} · ${h.ref ? "ab deinem Standort" : "ab Rapperswil"}`;
    document.querySelectorAll("#hofKind [data-hk]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.hk === h.kind)));
    $("hofOpen").setAttribute("aria-pressed", String(h.openOnly));
    const now = new Date();
    $("hofList").innerHTML = items.slice(0, h.n).map((it, i) => {
      const osm = `https://www.openstreetmap.org/?mlat=${it.lat}&mlon=${it.lon}#map=17/${it.lat}/${it.lon}`;
      const zeiten = it.oh ? CORE.hoursText(it.oh, now) : "Öffnungszeiten unbekannt";
      return `<div class="hofit${h.sel === it.n + it.lat ? " sel" : ""}" data-hi="${i}">
        <a class="nm" href="${esc(osm)}" target="_blank" rel="noopener">${esc(it.n)}</a>
        <span class="st${it.state && it.state.open ? " open" : ""}">${esc(it.state ? it.state.text : "")}</span>
        <small>${esc(KIND[it.k] || "")}${it.bio ? " · Bio" : ""}${it.adr || it.ort ? ` · ${esc([it.adr, it.ort].filter(Boolean).join(", "))}` : ""} · ${kmText(it.km)}</small>
        <small>${esc(zeiten)}${it.web ? ` · <a href="${esc(it.web)}" target="_blank" rel="noopener">Webseite</a>` : ""}</small>
      </div>`;
    }).join("") || `<div class="empty">${h.openOnly ? "Gerade hat nichts offen." : "Keine Orte gefunden."}</div>`;
    $("hofMore").hidden = items.length <= h.n;
    renderMap(items);
  }

  function openHof() {
    Object.assign(H(), { center: null, n: 30, sel: null });
    $("hofDialog").showModal();
    renderHof();
  }

  // Bedienung
  $("hofBtn").onclick = openHof;
  $("hofKind").addEventListener("click", e => {
    const b = e.target.closest("[data-hk]");
    if (!b) return;
    Object.assign(H(), { kind: b.dataset.hk, n: 30 });
    renderHof();
  });
  $("hofOpen").onclick = () => { H().openOnly = !H().openOnly; H().n = 30; renderHof(); };
  $("hofMore").onclick = () => { H().n += 30; renderHof(); };
  $("hofLocate").onclick = () => {
    if (!navigator.geolocation) return toast("Standort nicht verfügbar");
    $("hofLocate").disabled = true;
    navigator.geolocation.getCurrentPosition(pos => {
      $("hofLocate").disabled = false;
      Object.assign(H(), { ref: { lat: pos.coords.latitude, lon: pos.coords.longitude }, center: null, z: 12 });
      renderHof();
    }, () => { $("hofLocate").disabled = false; toast("Standort nicht erlaubt – Entfernung ab Rapperswil"); }, { timeout: 10000, maximumAge: 300000 });
  };
  document.querySelector("#hofMap .hofzoom").addEventListener("click", e => {
    const b = e.target.closest("[data-z]");
    if (!b) return;
    H().z = Math.max(ZMIN, Math.min(ZMAX, H().z + Number(b.dataset.z)));
    renderMap(list());
  });
  // Punkt antippen = Ort in der Liste zeigen; Ort antippen (nicht den Link) = auf der Karte zeigen
  function select(it) {
    H().sel = it.n + it.lat;
    const idx = list().findIndex(x => x.n + x.lat === H().sel);
    if (idx >= H().n) H().n = idx + 1;
    renderHof();
    const row = document.querySelector(`#hofList .hofit[data-hi="${idx}"]`);
    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  $("hofTiles").addEventListener("click", e => {
    const b = e.target.closest(".hofpin[data-hi]");
    if (b) select(list()[+b.dataset.hi]);
  });
  $("hofList").addEventListener("click", e => {
    if (e.target.closest("a")) return;
    const row = e.target.closest(".hofit");
    if (!row) return;
    const it = list()[+row.dataset.hi];
    Object.assign(H(), { center: { lat: it.lat, lon: it.lon }, z: Math.max(H().z, 13) });
    select(it);
  });
  // Karte verschieben (Finger/Maus ziehen)
  let drag = null;
  $("hofMap").addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    const c = H().center || ref(), p = toPx(c.lat, c.lon, H().z);
    drag = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, moved: false };
    $("hofMap").setPointerCapture(e.pointerId);
  });
  $("hofMap").addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    $("hofTiles").style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endDrag = e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    $("hofTiles").style.transform = "";
    if (drag.moved) { H().center = toDeg(drag.px - dx, drag.py - dy, H().z); renderMap(list()); }
    drag = null;
  };
  $("hofMap").addEventListener("pointerup", endDrag);
  $("hofMap").addEventListener("pointercancel", endDrag);

  Object.assign(app, { renderHof, openHof });
})();
