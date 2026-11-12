// BringFrisch – Einstellungen + Willkommen: Mitbewohner, Anwesenheit, «Du bist», Verbindung (WG + PIN),
// erster Start, Bring!-Liste, Znacht-Zeit, Kalender-Abo, Aktualisieren.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { portionsFor, DAYS, APP_VERSION, DONATE_URL, TEST_URL, LIVE_URL, DEFAULT_SYNC_URL, load, save, SYNC_KEY,
    PLAN_UPDATED_KEY, SETTINGS_UPDATED_KEY, DINNER_KEY, ME_KEY, WELCOME_KEY, TERMS_KEY, state, otherPlan, savePlan,
    saveMembers, $, esc, initialsMap, toast, copyText, DIET_LABEL, refresh, shownWeek } = app;

  // ---------------------------------------------------------------------------
  // Rendering: WG
  // ---------------------------------------------------------------------------
  function renderMembers() {
    if ($("meSelect")) {
      const me = load(ME_KEY, null);
      const cur = state.members.some(m => m.id === me) ? me : "";
      $("meSelect").innerHTML = (cur ? "" : `<option value="" selected>– wählen –</option>`) + state.members.map(m => `<option value="${esc(m.id)}"${m.id === cur ? " selected" : ""}>${esc(m.name)}</option>`).join("");
    }
    $("members").innerHTML = state.members.map(m => `
      <div class="member">
        <b>${esc(m.name)}</b>
        <select data-diet="${esc(m.id)}" aria-label="Ernährung von ${esc(m.name)}">
          ${Object.keys(DIET_LABEL).map(d => `<option value="${d}"${m.diet === d ? " selected" : ""}>${DIET_LABEL[d]}</option>`).join("")}
        </select>
        <button class="icon-btn" type="button" data-remove="${esc(m.id)}" aria-label="${esc(m.name)} entfernen">✕</button>
      </div>`).join("");
  }

  function renderAttendance() {
    const short = initialsMap();
    const head = `<tr><th></th>${DAYS.map(d => `<th>${d.slice(0, 2)}</th>`).join("")}</tr>`;
    const rows = state.members.map(m => `<tr><td>${esc(m.name)}</td>${state.plan.map((day, idx) => {
      const on = day.eaters.includes(m.id);
      return `<td><button type="button" class="att${on ? "" : " off"}" data-day="${idx}" data-member="${esc(m.id)}" aria-pressed="${on}" aria-label="${esc(m.name)} am ${DAYS[idx]}">${esc(short[m.id])}</button></td>`;
    }).join("")}</tr>`).join("");
    const guests = `<tr><td>Gäste</td>${state.plan.map((day, idx) => `<td><button type="button" class="att guest" data-guests="${idx}" aria-label="Gäste am ${DAYS[idx]}: ${day.extra_guests}">${day.extra_guests}</button></td>`).join("")}</tr>`;
    const totals = `<tr><td class="muted">Portionen</td>${state.plan.map(day => `<td class="muted">${portionsFor(day)}</td>`).join("")}</tr>`;
    $("attendance").innerHTML = head + rows + guests + totals;
  }
  // «Du bist» in den Einstellungen (pro Handy)
  $("meSelect").onchange = () => {
    if (!$("meSelect").value) return;
    save(ME_KEY, $("meSelect").value);
    renderMembers();
    app.renderDays();
    const m = state.members.find(x => x.id === $("meSelect").value);
    toast(`Du bist ${m ? m.name : ""} ✓`);
  };

  // ---------------------------------------------------------------------------
  // WG: Mitbewohner, Anwesenheit, Plan teilen
  // ---------------------------------------------------------------------------
  $("members").addEventListener("change", e => {
    const sel = e.target.closest("[data-diet]");
    if (!sel) return;
    const m = state.members.find(x => x.id === sel.dataset.diet);
    m.diet = sel.value;
    saveMembers();
    app.settingsChanged();
    refresh();
  });

  $("members").addEventListener("click", e => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    if (state.members.length <= 1) return toast("Mindestens eine Person braucht es");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Entfernen?";
      return;
    }
    const id = b.dataset.remove;
    state.members = state.members.filter(m => m.id !== id);
    [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => { d.eaters = d.eaters.filter(x => x !== id); }));
    saveMembers();
    app.settingsChanged();
    savePlan();
    renderMembers();
    refresh();
  });

  $("addMemberForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("newMemberName").value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9äöü]+/g, "-") + "-" + Date.now().toString(36);
    state.members.push({ id, name, diet: $("newMemberDiet").value });
    [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => d.eaters.push(id)));
    saveMembers();
    app.settingsChanged();
    savePlan();
    $("newMemberName").value = "";
    renderMembers();
    refresh();
  });

  $("attendance").addEventListener("click", e => {
    const att = e.target.closest("[data-member]");
    if (att) return app.toggleEater(+att.dataset.day, att.dataset.member);
    const g = e.target.closest("[data-guests]");
    if (g) {
      const day = state.plan[+g.dataset.guests];
      day.extra_guests = ((day.extra_guests || 0) + 1) % 5;
      savePlan();
      refresh();
    }
  });

  function renderSyncSettings() {
    $("syncPin").value = app.sync.pin || "";
    $("syncWg").value = app.sync.wg || "";
    $("dinnerTime").value = load(DINNER_KEY, "18:30");
    app.setSyncStatus(app.connected() ? "Verbinde …" : "Nicht verbunden: WG-PIN unter «Mehr» eingeben. Bis dahin Bring! über Teilen/Kopieren.", false);
    if (app.connected()) loadBringLists(); else $("setMore").open = true;
  }

  $("syncForm").addEventListener("submit", async e => {
    e.preventDefault();
    const wgName = $("syncWg").value.trim();
    if (wgName !== (app.sync.wg || "")) app.forgetWgStand();
    app.sync = { url: app.sync.url || DEFAULT_SYNC_URL, pin: $("syncPin").value.trim(), wg: wgName };
    save(SYNC_KEY, app.sync);
    if (!app.connected()) return app.setSyncStatus("WG-PIN eingeben", false);
    app.setSyncStatus("Verbinde …", false);
    await app.pullShared();
    if ($("syncStatus").textContent.startsWith("Verbunden")) {
      save(PLAN_UPDATED_KEY, Math.max(load(PLAN_UPDATED_KEY, 0), 1));
      app.schedulePlanPush();
      loadBringLists();
      app.api("/wg").then(i => toast(`Verbunden mit ${i.name ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : "der WG"} ✓`)).catch(() => toast("Verbunden ✓"));
    } else toast(`✗ ${$("syncStatus").textContent || "Nicht verbunden"}`);
  });

  // ---------------------------------------------------------------------------
  // Erster Start: WG-Name + PIN, dann «Wer bist du?». Wer schon verbunden ist, sieht das nie.
  // ---------------------------------------------------------------------------
  const TERMS_VERSION = "2026-11";
  function openWelcome() {
    $("welcomeJoin").hidden = false;
    $("welcomeWho").hidden = true;
    $("welcomeWg").value = app.sync.wg || "";
    $("welcomeStatus").textContent = "";
    $("welcomeDialog").showModal();
  }
  function closeWelcome() {
    save(WELCOME_KEY, true);
    $("welcomeDialog").close();
    renderSyncSettings();
    refresh();
    app.markWahl();
    if (app.wahlDue()) setTimeout(app.openWahlPop, 400);
  }
  $("welcomeJoin").addEventListener("submit", async e => {
    e.preventDefault();
    const wg = $("welcomeWg").value.trim(), pin = $("welcomePin").value.trim(), status = $("welcomeStatus");
    if (!wg || !pin) return (status.textContent = "Bitte WG-Name und PIN eingeben");
    const before = app.sync;
    app.sync = { url: app.sync.url || DEFAULT_SYNC_URL, pin, wg };
    status.textContent = "Verbinde …";
    const btn = $("welcomeJoin").querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Verbinde …";
    const done = () => { btn.disabled = false; btn.textContent = "Verbinden"; };
    let remote;
    try {
      const info = await app.api("/wg");
      remote = await app.api("/settings");
      const name = info.name ? info.name.charAt(0).toUpperCase() + info.name.slice(1) : wg;
      status.textContent = `Verbunden mit ${name} ✓`;
      $("welcomeOk").textContent = `✓ Verbunden mit ${name}`;
    } catch (err) {
      app.sync = before;
      done();
      status.textContent = /Failed to fetch|NetworkError|Load failed/.test(err.message) ? "Keine Verbindung zum WG-Server – Internet?" : `✗ ${err.message} – nochmals versuchen`;
      return;
    }
    done();
    if ((before.wg || "") !== wg) app.forgetWgStand();
    save(SYNC_KEY, app.sync);
    save(TERMS_KEY, { version: TERMS_VERSION, at: Date.now() });
    const fresh = !(remote && remote.settings && Array.isArray(remote.settings.members) && remote.settings.members.length);
    if (!fresh) {
      app.applySettings(remote.settings);
      save(SETTINGS_UPDATED_KEY, remote.updated);
      app.setBase("settings", remote.updated, Object.entries(app.wgSettings()));
    }
    welcomeFresh = fresh;
    renderWelcomeWho();
    $("welcomeJoin").hidden = true;
    $("welcomeWho").hidden = false;
  });
  let welcomeFresh = false;
  function renderWelcomeWho() {
    $("welcomeWhoText").textContent = welcomeFresh
      ? "Eure WG ist noch leer – trag dich als Erste:r ein. Die anderen kommen dazu, wenn sie sich verbinden."
      : "Damit deine Stimmen zu dir gehören. Später änderbar.";
    $("welcomeMembers").innerHTML = welcomeFresh ? "" : state.members.map(m => `<button class="btn" type="button" data-me="${esc(m.id)}">${esc(m.name)}</button>`).join("");
  }
  $("welcomeMembers").addEventListener("click", e => {
    const b = e.target.closest("[data-me]");
    if (!b) return;
    save(ME_KEY, b.dataset.me);
    closeWelcome();
    app.pullShared();
  });
  $("welcomeAdd").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("welcomeName").value.trim();
    if (!name) return $("welcomeName").focus();
    const id = name.toLowerCase().replace(/[^a-z0-9äöü]+/g, "-") + "-" + Date.now().toString(36);
    const me = { id, name, diet: $("welcomeDiet").value };
    // neue WG: nur ich (die Beispiel-WG fällt weg); bestehende WG: ich komme dazu
    const members = welcomeFresh ? [me] : [...state.members, me];
    app.applySettings({ members });
    if (welcomeFresh) [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => { d.eaters = d.empty ? [] : [id]; }));
    save(ME_KEY, id);
    saveMembers();
    save(SETTINGS_UPDATED_KEY, Date.now());
    await app.pushSettingsNow();
    savePlan();
    closeWelcome();
    app.pullShared();
  });
  $("welcomeSkip").onclick = () => closeWelcome();

  // Welche Bring!-Liste? Auswahl gilt für die ganze WG (im Worker gespeichert).
  async function loadBringLists() {
    const field = $("bringListField"), sel = $("bringListSelect"), hint = $("bringListHint");
    if (!field || !app.connected()) return;
    try {
      const { lists, active } = await app.api("/bring/lists");
      sel.innerHTML = "";
      for (const l of lists) {
        const o = document.createElement("option");
        o.value = l.uuid;
        o.textContent = l.name;
        o.selected = l.uuid === active;
        sel.appendChild(o);
      }
      const cur = lists.find(l => l.uuid === active);
      $("bringListName").textContent = cur ? cur.name : "Liste wählen";
      field.hidden = false;
      hint.hidden = false;
    } catch (e) {
      app.setSyncStatus(e.message, false);
    }
  }

  $("bringListSelect").addEventListener("change", async e => {
    try {
      const { name } = await app.api("/bring/target", { method: "PUT", body: { uuid: e.target.value } });
      $("bringListName").textContent = name;
      app.setBringList(await app.api("/bring/list"));
      refresh();
      toast(`Bring!-Liste: ${name} ✓`);
    } catch (err) {
      toast(err.message);
      loadBringLists();
    }
  });

  $("syncNowBtn").onclick = () => (app.connected() ? app.runPullSync() : toast("Zuerst die WG-PIN eingeben"));

  $("dinnerTime").addEventListener("change", () => {
    save(DINNER_KEY, $("dinnerTime").value || "18:30");
    app.schedulePlanPush();
    app.settingsChanged();
  });

  // Kalender: persönlich (nur meine Abende). iPhone: webcal öffnet die Kalender-App.
  // Android/PC: Google Kalender «Per URL hinzufügen» direkt öffnen (die Android-App kann selbst nicht abonnieren).
  const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  async function myCalUrl(extra = "") {
    const { url } = await app.api("/cal-link");
    return `${url}?me=${encodeURIComponent(app.myId())}${extra}`;
  }
  $("calendarBtn").onclick = async () => {
    if (!app.connected()) return toast("Zuerst mit dem WG-Server verbinden");
    try {
      const url = await myCalUrl();
      const webcal = url.replace(/^https:/, "webcal:");
      await copyText(url);
      if (isApple()) {
        toast("Kalender öffnet sich – «Abonnieren» tippen");
        setTimeout(() => { location.href = url.replace(/^https:/, "webcal:"); }, 400);
      } else {
        toast("Google Kalender öffnet sich – «Hinzufügen» tippen. Link ist auch kopiert (Outlook: «Aus dem Internet»)");
        setTimeout(() => { window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, "_blank", "noopener"); }, 400);
      }
    } catch (e) {
      toast(e.message);
    }
  };
  $("calendarDlBtn").onclick = async () => {
    if (!app.connected()) return toast("Zuerst mit dem WG-Server verbinden");
    try {
      if (app.planPushTimer) await app.pushPlanNow();
      if (app.nextPushTimer) await app.pushNextNow();
      const url = await myCalUrl(`&week=${shownWeek()}&dl=1`);
      toast("Termine werden geladen – «Zum Kalender hinzufügen» tippen");
      setTimeout(() => { location.href = url; }, 300);
    } catch (e) {
      toast(e.message);
    }
  };

  // Aktualisieren: erst eigene Änderungen senden und den Stand der WG holen, dann neue App-Version laden
  // «1.6.8-test.3» = [1, 6, 8, 3] (Test-Version: 4. Zahl = Commits seit dem Release)
  const verNum = v => String(v || "0").split(/[^0-9]+/).filter(Boolean).map(n => parseInt(n, 10));
  const isNewer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  async function latestVersion() {
    const r = await fetch(`app.js?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const m = (await r.text()).match(/const APP_VERSION = "([^"]+)"/);
    return m ? m[1] : null;
  }
  function setUpdateState(html, isNew) {
    $("updateState").innerHTML = html;
    $("versionCard").classList.toggle("new", !!isNew);
  }
  async function hardReload() {
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) { /* egal */ }
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* egal */ }
    location.reload();
  }
  // Link neben der Version: in der WG-Version zur Test-Version, in der Test-Version zurück zur WG-Version (Quellcode steht in der Zeile darunter)
  const IS_TEST = DEFAULT_SYNC_URL === TEST_URL;
  const otherHtml = () => `<a id="repoLinkTop" href="${esc(IS_TEST ? LIVE_URL : TEST_URL)}" target="_blank" rel="noopener">${IS_TEST ? "WG-Version" : "Test-Version"} ↗</a>`;
  $("updateState").innerHTML = otherHtml();
  async function checkUpdate(quiet) {
    try {
      const latest = await latestVersion();
      if (latest && isNewer(latest, APP_VERSION)) {
        setUpdateState(`Neue Version <b>${esc(latest)}</b> verfügbar · ${otherHtml()}`, true);
        if (quiet) toast(`Neue Version ${latest} verfügbar`, { label: "Laden", run: () => $("updateBtn").click() });
        return latest;
      }
      if (!quiet) setUpdateState(`Neueste Version ✓ · ${otherHtml()}`);
      return null;
    } catch (e) {
      if (!quiet) setUpdateState(`Offline – später nochmals · ${otherHtml()}`);
      return null;
    }
  }
  $("updateBtn").onclick = async () => {
    const btn = $("updateBtn");
    btn.disabled = true;
    setUpdateState("Wird abgeglichen …");
    try {
      if (app.connected()) await app.syncNow(); // eigene Änderungen zuerst hoch, dann Stand der WG holen
      const latest = await checkUpdate(false);
      if (latest) {
        setUpdateState(`Version ${esc(latest)} wird geladen …`, true);
        toast(`Version ${latest} wird geladen …`);
        setTimeout(hardReload, 600);
        return;
      }
      toast(app.connected() ? `Alles aktuell: Version ${APP_VERSION}, synchronisiert ✓` : `Neueste Version ${APP_VERSION} ✓ (nicht verbunden)`);
    } finally {
      btn.disabled = false;
    }
  };
  setTimeout(() => checkUpdate(true), 4000); // beim Start leise nachsehen
  if (DONATE_URL) { $("donateLink").href = DONATE_URL; $("donateRow").hidden = false; }

  Object.assign(app, { renderMembers, renderAttendance, renderSyncSettings, openWelcome });
})();
