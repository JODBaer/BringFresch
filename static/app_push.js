// Obsonare – Benachrichtigungen (Joshua 19.11.): Karte unter Einstellungen (pro Handy) und «Anstupsen» in der Wochenwahl.
//   - Jemand hat gewählt / Alle haben gewählt, Anstupser (höchstens 1× pro Tag, Ruhezeit 21–8 macht der WG-Server)
//   - Markt / Hof einmal pro Woche: Ort aus der Hofläden-Liste (Name des Bauern oder Ortschaft) oder selbst eingetragen,
//     Tag + Zeitpunkt (Vorabend 19:00, 30 Min. vor Öffnung, feste Uhrzeit); nur wenn auf Bring! etwas steht
//   - Kurzbefehl (iPhone): Adresse, die höchstens 1× pro Woche einen Text liefert
// Versand: WG-Server (worker/src/push.js). iPhone: nur mit Obsonare auf dem Home-Bildschirm (iOS 16.4+).
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { state, $, esc, toast, CORE, load, save, STORE, ME_KEY, copyText } = app;
  const KEY = STORE.KEYS.PUSH_KEY;
  const WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const RAPPERSWIL = { lat: 47.2267, lon: 8.8184 };
  const HOF = () => (window.BF_HOF && window.BF_HOF.items) || [];

  // market = gewählter Ort (auch unvollständig), marketOn = Schalter; an den Server geht der Ort nur vollständig und eingeschaltet
  const defaults = () => ({ on: false, id: null, prefs: { voted: true, nudge: true }, market: null, marketOn: false, remind: null });
  const P = () => { const p = { ...defaults(), ...(load(KEY, null) || {}) }; p.prefs = { ...defaults().prefs, ...(p.prefs || {}) }; return p; };
  const put = p => save(KEY, p);

  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  const meChosen = () => state.members.some(m => m.id === load(ME_KEY, null));
  const b64ToBytes = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));

  // ---------------------------------------------------------------------------
  // Abo beim WG-Server
  async function currentSub() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }
  async function sendPrefs() {
    const p = P();
    if (!p.on || !app.connected()) return;
    const sub = await currentSub();
    if (!sub) return;
    const market = p.marketOn && p.market && p.market.name && p.market.day != null ? p.market : null;
    await app.api("/push", { method: "PUT", body: { id: p.id, member: load(ME_KEY, null), sub: sub.toJSON(), prefs: { ...p.prefs, market } } });
  }
  let sendTimer = null;
  const sendSoon = () => { clearTimeout(sendTimer); sendTimer = setTimeout(() => sendPrefs().catch(e => toast(e.message)), 600); };

  async function enable() {
    if (!app.connected()) return toast("Zuerst mit der WG verbinden (Einstellungen → Mehr)");
    if (!meChosen()) return toast("Zuerst oben «Du bist» wählen");
    if (!supported()) return render();
    let key;
    try { ({ key } = await app.api("/push/key")); } catch (e) { return toast(e.message); }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { render(); return toast("Benachrichtigungen sind in den Einstellungen des Handys blockiert"); }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const p = P();
      p.on = true;
      p.id = p.id || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      put(p);
      await sendPrefs();
      toast("Benachrichtigungen eingeschaltet ✓");
    } catch (e) {
      toast(`Einschalten ging nicht: ${e.message}`);
    }
    render();
  }
  async function disable() {
    const p = P();
    p.on = false;
    put(p);
    render();
    try {
      if (app.connected() && p.id) await app.api("/push/off", { method: "POST", body: { id: p.id } });
      const sub = await currentSub();
      if (sub) await sub.unsubscribe();
    } catch (e) { /* offline: Server räumt beim nächsten Senden auf (410) */ }
    toast("Benachrichtigungen ausgeschaltet");
  }

  // ---------------------------------------------------------------------------
  // Karte unter Einstellungen
  function render() {
    if (!$("pushCard")) return;
    const p = P();
    const hint = $("pushHint");
    let why = "";
    if (isIos() && !standalone()) why = "iPhone: Benachrichtigungen kommen nur, wenn Obsonare auf dem Home-Bildschirm liegt (in Safari Teilen → «Zum Home-Bildschirm») und von dort geöffnet wird.";
    else if (!supported()) why = "Dieser Browser kann keine Benachrichtigungen empfangen.";
    else if (Notification.permission === "denied") why = "Benachrichtigungen sind für Obsonare in den Einstellungen des Handys blockiert.";
    else if (!app.connected()) why = "Benachrichtigungen gehen nur mit WG-Server (Einstellungen → Mehr → PIN).";
    hint.textContent = why;
    hint.hidden = !why;
    const on = p.on && !why;
    $("pushState").textContent = on ? "an · für dich" : "aus";
    $("pushToggle").textContent = on ? "Ausschalten" : "Einschalten";
    $("pushToggle").classList.toggle("dark", !on);
    $("pushToggle").disabled = !!why && !p.on;
    $("pushOpts").classList.toggle("off", !on);
    $("pushVoted").checked = p.prefs.voted !== false;
    $("pushNudge").checked = p.prefs.nudge !== false;
    $("pushMarketOn").checked = !!p.marketOn;
    $("pushMarket").hidden = !p.marketOn;
    renderMarket(p.market);
    renderRemind(p);
  }

  // Ort + Tag + Zeitpunkt. Entwurf (draft) bleibt, bis er vollständig ist; erst dann geht er als prefs.market an den Server.
  function renderMarket(m) {
    m = m || {};
    const own = !!m.own;
    $("pushSel").hidden = !m.name;
    $("pushSel").innerHTML = m.name ? `<b>${esc(m.name)}</b>${m.oh ? `<small>${esc(CORE.hoursText(m.oh, new Date()))}</small>` : own ? "<small>selbst eingetragen</small>" : "<small>Zeiten unbekannt</small>"}<button class="icon-btn" type="button" id="pushSelClear" aria-label="Ort entfernen">✕</button>` : "";
    $("pushOwnRow").hidden = !own;
    if (own && document.activeElement !== $("pushOwnName")) $("pushOwnName").value = m.name || "";
    $("pushOwnBtn").hidden = own;
    const days = m.oh ? CORE.openDays(m.oh, new Date()) : null;
    const allowed = days && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
    $("pushDay").innerHTML = allowed.map(d => `<option value="${d}"${+m.day === d ? " selected" : ""}>${WD[d]}</option>`).join("");
    const pre = !!m.oh && !!days;
    const when = m.when === "pre" && !pre ? "eve" : m.when || "eve";
    $("pushWhen").querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", b.dataset.w === when); b.hidden = b.dataset.w === "pre" && !pre; });
    $("pushTimeRow").hidden = when !== "fix";
    $("pushTime").value = m.time || "09:00";
    $("pushPreview").textContent = m.name ? previewText({ ...m, day: m.day != null ? m.day : allowed[0], when }) : "Ort wählen: Hofladen, Markt oder selbst eintragen.";
  }
  function previewText(m) {
    const prev = WD[(m.day + 6) % 7], day = WD[m.day];
    const at = m.when === "eve" ? `${prev} 19:00` : m.when === "pre" ? `${day} 30 Min. vor Öffnung` : `${day} ${m.time || "09:00"}`;
    return `Jede Woche ${at}: «${m.when === "eve" ? "Morgen" : "Heute"} ${m.name}» – nur wenn auf Bring! etwas steht. Hat der Ort zu (Winterpause), kommt nichts.`;
  }
  // Änderung am Ort/Tag/Zeitpunkt: gilt, sobald Name + Tag da sind
  function updateMarket(change) {
    const p = P();
    const m = { ...(p.market || {}), ...change };
    if (m.name && m.day == null) {
      const days = m.oh ? CORE.openDays(m.oh, new Date()) : null;
      m.day = days && days.length ? days[0] : 5;
    }
    p.market = m;
    put(p);
    render();
    sendSoon();
  }

  function renderHits() {
    const q = $("pushPlaceQ").value;
    const hits = CORE.searchFarms(HOF(), q, { ref: (state.hof && state.hof.ref) || RAPPERSWIL, favs: load(STORE.KEYS.FAV_KEY, []) || [], limit: 6 });
    $("pushHits").innerHTML = hits.map((h, i) => `<button type="button" role="option" data-hit="${i}">${h.fav ? "★ " : ""}<b>${esc(h.n)}</b><small>${esc([h.ort, h.oh ? CORE.hoursText(h.oh, new Date()) : "Zeiten unbekannt"].filter(Boolean).join(" · "))}</small></button>`).join("")
      + (q.trim() && !hits.length ? `<p class="hint">Nichts gefunden – unten «Selbst eintragen».</p>` : "");
    $("pushHits")._hits = hits;
  }

  function renderRemind(p) {
    $("pushRemindUrl").hidden = !p.remind;
    $("pushRemindUrl").textContent = p.remind || "";
    $("pushRemindCopy").hidden = !p.remind;
    $("pushRemindBtn").textContent = p.remind ? "Neue Adresse" : "Adresse erstellen";
  }

  if ($("pushCard")) {
    $("pushToggle").onclick = () => (P().on ? disable() : enable());
    const pref = (k, v) => { const p = P(); p.prefs[k] = v; put(p); sendSoon(); };
    $("pushVoted").onchange = e => pref("voted", e.target.checked);
    $("pushNudge").onchange = e => pref("nudge", e.target.checked);
    $("pushMarketOn").onchange = e => {
      const p = P();
      p.marketOn = e.target.checked;
      put(p);
      render();
      sendSoon();
      if (p.marketOn && !(p.market && p.market.name)) $("pushPlaceQ").focus();
    };
    $("pushPlaceQ").oninput = renderHits;
    $("pushHits").onclick = e => {
      const b = e.target.closest("[data-hit]");
      if (!b) return;
      const h = $("pushHits")._hits[+b.dataset.hit];
      $("pushPlaceQ").value = "";
      $("pushHits").innerHTML = "";
      updateMarket({ name: h.n, oh: h.oh || "", key: h.key, own: false, day: null });
    };
    $("pushSel").onclick = e => { if (e.target.closest("#pushSelClear")) { const p = P(); p.market = null; put(p); render(); sendSoon(); } };
    $("pushOwnBtn").onclick = () => { updateMarket({ own: true, name: $("pushPlaceQ").value.trim() || "", oh: "", key: null }); $("pushOwnName").focus(); };
    $("pushOwnName").oninput = e => updateMarket({ own: true, name: e.target.value.trim(), oh: "" });
    $("pushDay").onchange = e => updateMarket({ day: +e.target.value });
    $("pushTime").onchange = e => updateMarket({ time: e.target.value });
    $("pushWhen").onclick = e => { const b = e.target.closest("[data-w]"); if (b) updateMarket({ when: b.dataset.w }); };
    $("pushRemindBtn").onclick = async () => {
      if (!app.connected()) return toast("Zuerst mit der WG verbinden (Einstellungen → Mehr)");
      const p = P();
      try {
        const { url } = await app.api("/erinnerung", { method: "POST", body: { old: p.remind ? p.remind.split("/").pop() : undefined } });
        p.remind = url;
        put(p);
        render();
        toast("Adresse erstellt – im Kurzbefehl einfügen");
      } catch (e) { toast(e.message); }
    };
    $("pushRemindCopy").onclick = () => copyText(P().remind);
  }

  // ---------------------------------------------------------------------------
  // Wochenwahl: wer fehlt noch? «👋 Lukas & Jo anstupsen»
  function renderNudge() {
    const box = $("voteNudge");
    if (!box || !state.vote) return;
    const info = state.votePush || { pushers: [], nudged: [] };
    const me = app.myId();
    const voted = id => (((state.vote.votes || {})[id] || {}).likes || []).length > 0;
    const open = state.members.filter(m => m.id !== me && !voted(m.id));
    if (!app.connected() || !open.length) { box.hidden = true; return; }
    const can = open.filter(m => info.pushers.includes(m.id) && !info.nudged.includes(m.id));
    const done = open.filter(m => info.nudged.includes(m.id));
    const without = open.filter(m => !info.pushers.includes(m.id));
    const names = list => list.map(m => esc(m.name)).join(" &amp; ");
    box.hidden = false;
    box.innerHTML = `<span class="muted">Noch offen: ${open.map(m => esc(m.name)).join(", ")}</span>`
      + (can.length ? `<button class="btn" type="button" id="nudgeBtn">👋 ${names(can)} anstupsen</button>` : "")
      + (done.length ? `<small class="muted">Heute angestupst: ${names(done)}</small>` : "")
      + (without.length ? `<small class="muted">Ohne Benachrichtigungen: ${names(without)}</small>` : "");
    const btn = $("nudgeBtn");
    if (btn) btn.onclick = async () => {
      btn.disabled = true;
      try {
        const r = await app.api(`/week/${state.vote.week}/nudge`, { method: "POST", body: { from: me, to: can.map(m => m.id) } });
        info.nudged = [...new Set([...info.nudged, ...(r.sent || []), ...(r.skipped || [])])];
        state.votePush = info;
        const sent = state.members.filter(m => (r.sent || []).includes(m.id));
        toast(sent.length ? `${sent.map(m => m.name).join(" & ")} angestupst 👋` : "Heute schon angestupst");
      } catch (e) { toast(e.message); }
      renderNudge();
    };
  }

  // Antippen einer Meldung öffnet Obsonare an der passenden Stelle (sw.js: ?open=… oder Nachricht ans offene Fenster)
  function openFrom(what) {
    if (what === "wahl") app.openVoteFor();
    else if (what === "einkauf") { const b = document.querySelector('.bnav [data-tab="shop"]'); if (b) b.click(); }
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "bf-open") openFrom(e.data.open); });
  function openFromUrl() {
    const u = new URL(location.href), what = u.searchParams.get("open");
    if (!what) return false;
    u.searchParams.delete("open");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
    setTimeout(() => openFrom(what), 300);
    return true;
  }

  Object.assign(app, { renderPush: render, renderNudge, pushSendPrefs: sendPrefs, openFromUrl });
  app.subscribe(render);
})();
