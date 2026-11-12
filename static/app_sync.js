// BringFrisch – Abgleich mit dem WG-Server (Cloudflare Worker): Verbindung, Plan / nächste Woche / Vorrat / Einstellungen
// ohne Uhrenvergleich zusammenführen, Herunterziehen = synchronisieren, Bring! füllen über den Bot.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { weekKey, bringPayload, importer, DEFAULT_MEMBERS, DEFAULT_SYNC_URL, load, save, remove, baseKey, SYNC_KEY,
    PLAN_UPDATED_KEY, VORRAT_UPDATED_KEY, SETTINGS_UPDATED_KEY, DINNER_KEY, NEXT_KEY, SITES_KEY, KEYS, state,
    currentPlan, otherPlan, saveStaples, $, esc, toast, normalizeWeek, refresh, nextWeekKey, canPlanNext, isOpenWeek,
    setCurrentPlan } = app;

  // ---------------------------------------------------------------------------
  // Verbindung zum Cloudflare Worker (Bring!-Sync, gemeinsamer Plan, Wochenwahl, Kalender)
  // ---------------------------------------------------------------------------
  state.sync = { url: DEFAULT_SYNC_URL, pin: "", wg: "", ...(load(SYNC_KEY, {}) || {}) };
  // alter Test-Server (bringfrisch-stage) ist im Test-Worker aufgegangen
  if (!state.sync.url || /\/\/bringfrisch-stage\./.test(state.sync.url)) state.sync.url = DEFAULT_SYNC_URL;

  function connected() {
    return !!(state.sync.url && state.sync.pin);
  }

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(state.sync.url.replace(/\/+$/, "") + path, {
      method,
      headers: { "X-WG-PIN": state.sync.pin, ...(state.sync.wg ? { "X-WG": state.sync.wg } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* keine JSON-Antwort */ }
    if (!res.ok) throw Object.assign(new Error(data.error || `Verbindungsfehler (${res.status})`), { status: res.status, data });
    return data;
  }

  function setSyncStatus(text, ok) {
    const el = $("syncStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "var(--accent)" : "var(--muted)";
  }

  // ---------------------------------------------------------------------------
  // Abgleich mit dem WG-Server ohne Uhrenvergleich: pro Dokument (Plan, nächste Woche, Vorrat, Einstellungen)
  // merkt sich das Handy den Stand, den der Server beim letzten Abgleich hatte (Stempel des Servers + Inhalt).
  //   lokal geändert  = eigener Stempel ≠ gemerkter Stempel      Server geändert = Server-Stempel neuer als der gemerkte
  // Nur einer geändert -> der gilt. Beide geändert -> zusammenführen: pro Tag / Artikel / Einstellung gewinnt, wer
  // seit dem gemeinsamen Stand etwas geändert hat (beide denselben: dieses Handy). Beim Senden geht der gemerkte
  // Stempel mit («base»); hat inzwischen jemand gespeichert, antwortet der Server 409 mit seinem Stand.
  // ---------------------------------------------------------------------------
  const baseOf = n => load(baseKey(n), null); // { updated, data, week? }
  const setBase = (n, updated, data, extra) => save(baseKey(n), { updated, data, ...(extra || {}) });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Was ein Mensch an einem Tag ändert (Rezeptdaten selbst kommen aus der Datenbank und zählen nicht als Änderung)
  const dayView = d => d && [d.id, d.title, [...(d.eaters || [])].sort(), d.leftover_buffer, d.extra_guests || 0, d.time || "", !!d.empty, d.servings || 0];
  const planViews = plan => (plan || []).map(dayView);
  const byIndex = (x, i) => i;
  function merge3(base, mine, theirs, keyOf, view = x => x) {
    if (!Array.isArray(base)) return mine; // kein gemeinsamer Stand bekannt: dieses Handy gilt (wie früher)
    const b = new Map(base.map((x, i) => [keyOf(x, i), x]));
    const m = new Map(mine.map((x, i) => [keyOf(x, i), x]));
    const t = new Set(theirs.map(keyOf));
    const changed = k => !same(m.has(k) ? view(m.get(k)) : undefined, b.get(k));
    const out = [];
    theirs.forEach((x, i) => { const k = keyOf(x, i); if (!changed(k)) out.push(x); else if (m.has(k)) out.push(m.get(k)); });
    mine.forEach((x, i) => { const k = keyOf(x, i); if (!t.has(k) && changed(k)) out.push(x); }); // hier neu (oder dort gelöscht, hier geändert)
    return out;
  }
  // "take" = Stand des Servers übernehmen · "push" = meinen senden · "merge" = zusammenführen · "" = gleich
  function syncCase(b, localStamp, remoteStamp) {
    if (!b) return remoteStamp > localStamp ? "take" : localStamp > remoteStamp ? "push" : ""; // Handy ohne gemerkten Stand: wie früher
    // «Server geändert» heisst: sein Stempel ist NEUER als der gemerkte. Ein älterer Stempel ist kein fremder Stand,
    // sondern ein verspätetes Lesen (der Speicher des Servers liefert kurz nach dem Speichern noch den alten Stand)
    // und wird nie übernommen. Beide Stempel stammen vom Server – Handy-Uhren spielen keine Rolle.
    const dirty = localStamp !== b.updated, moved = remoteStamp > b.updated;
    return dirty && moved ? "merge" : dirty ? "push" : moved ? "take" : "";
  }
  const conflictOf = e => (e && e.status === 409 && e.data && e.data.conflict ? e.data : null);
  // Zusammenführen nur mit einem wirklich neueren Stand; sonst gilt der gemerkte weiter
  const newer = (name, remote) => { const b = baseOf(name); return !b || remote.updated > b.updated; };

  state.planPushTimer = null;
  async function pushPlanNow(again) {
    clearTimeout(state.planPushTimer);
    state.planPushTimer = null; // sonst schickt jedes spätere Herunterziehen den alten Plan wieder hoch
    const b = baseOf("plan");
    try {
      const r = await api("/plan", {
        method: "PUT",
        body: { week: weekKey(), plan: currentPlan(), members: state.members, dinnerTime: load(DINNER_KEY, "18:30"), ...(b ? { base: b.updated } : {}) }
      });
      save(PLAN_UPDATED_KEY, r.updated);
      setBase("plan", r.updated, planViews(currentPlan()));
    } catch (e) {
      const theirs = conflictOf(e);
      if (!theirs || again || !Array.isArray(theirs.plan)) throw e;
      mergePlan(theirs); // jemand war schneller: zusammenführen und nochmals senden
      await pushPlanNow(true);
      refresh();
    }
  }
  function mergePlan(remote) {
    if (!newer("plan", remote)) return;
    const theirs = normalizeWeek(remote.plan), b = baseOf("plan");
    setCurrentPlan(merge3(b && b.data, currentPlan(), theirs, byIndex, dayView));
    setBase("plan", remote.updated, planViews(theirs));
    save(PLAN_UPDATED_KEY, Date.now());
  }
  state.nextPushTimer = null;
  async function pushNextNow(again) {
    clearTimeout(state.nextPushTimer);
    state.nextPushTimer = null;
    if (!state.nextDoc) return;
    const b = baseOf("next");
    try {
      const r = await api(`/plan/${state.nextDoc.week}`, {
        method: "PUT",
        body: { plan: state.nextDoc.plan, members: state.members, dinnerTime: load(DINNER_KEY, "18:30"), ...(b && b.week === state.nextDoc.week ? { base: b.updated } : {}) }
      });
      state.nextDoc.updated = r.updated;
      save(NEXT_KEY, state.nextDoc);
      setBase("next", r.updated, planViews(state.nextDoc.plan), { week: state.nextDoc.week });
    } catch (e) {
      const theirs = conflictOf(e);
      if (!theirs || again || !Array.isArray(theirs.plan)) throw e;
      mergeNext(theirs);
      await pushNextNow(true);
      refresh();
    }
  }
  function mergeNext(remote) {
    { const b = baseOf("next"); if (b && b.week === state.nextDoc.week && remote.updated <= b.updated) return; }
    const theirs = normalizeWeek(remote.plan), b = baseOf("next");
    state.nextDoc = { week: state.nextDoc.week, plan: merge3(b && b.week === state.nextDoc.week ? b.data : null, state.nextDoc.plan, theirs, byIndex, dayView), updated: Date.now() };
    save(NEXT_KEY, state.nextDoc);
    setBase("next", remote.updated, planViews(theirs), { week: state.nextDoc.week });
    if (state.viewNext) state.plan = state.nextDoc.plan;
  }
  const stapleKey = st => String(st.name).toLowerCase();
  async function pushVorratNow(again) {
    clearTimeout(state.vorratTimer);
    state.vorratTimer = null;
    const b = baseOf("vorrat");
    try {
      const r = await api("/vorrat", { method: "PUT", body: { staples: state.staples, ...(b ? { base: b.updated } : {}) } });
      save(VORRAT_UPDATED_KEY, r.updated);
      setBase("vorrat", r.updated, state.staples);
    } catch (e) {
      const theirs = conflictOf(e);
      if (!theirs || again || !Array.isArray(theirs.staples)) throw e;
      mergeVorrat(theirs);
      await pushVorratNow(true);
      refresh();
    }
  }
  function mergeVorrat(remote) {
    if (!newer("vorrat", remote)) return;
    const b = baseOf("vorrat");
    state.staples = merge3(b && b.data, state.staples, remote.staples, stapleKey);
    save(KEYS.staples, state.staples);
    setBase("vorrat", remote.updated, remote.staples);
    save(VORRAT_UPDATED_KEY, Date.now());
  }
  function scheduleNextPush() {
    if (!connected()) return;
    clearTimeout(state.nextPushTimer);
    state.nextPushTimer = setTimeout(() => pushNextNow().catch(e => setSyncStatus(e.message, false)), 1500);
  }
  function schedulePlanPush() {
    if (!connected()) return;
    clearTimeout(state.planPushTimer);
    state.planPushTimer = setTimeout(() => pushPlanNow().catch(e => setSyncStatus(e.message, false)), 1500);
  }

  // Herunterziehen = jetzt synchronisieren: meine Änderungen hoch, dann den Stand der anderen holen
  let syncing = false;
  async function syncNow() {
    if (!connected()) return toast("Nicht verbunden – im Tab WG den PIN eingeben");
    if (syncing) return;
    syncing = true;
    try {
      if (state.planPushTimer) await pushPlanNow();
      if (state.nextPushTimer) await pushNextNow();
      if (state.vorratTimer) await pushVorratNow();
      await pullShared();
      if ($("voteDialog").open) await app.pullVote();
      const okSync = $("syncStatus").textContent.startsWith("Verbunden");
      const ready = bringDiff().missing.length;
      if (okSync) app.setChip(ready ? "ready" : "quiet");
      toast(okSync ? `Synchronisiert ✓${ready ? ` – ${ready} Artikel bereit für Bring!` : ""}` : $("syncStatus").textContent);
    } catch (e) {
      toast(e.message);
    } finally {
      syncing = false;
    }
  }

  // Herunterziehen = aktualisieren: Formwechsel-Anzeige (Android) bzw. Glas-Kreis (iPhone)
  async function runPullSync() {
    const ptr = $("ptr");
    ptr.classList.add("spin");
    ptr.style.transform = "translateY(24px) scale(1)";
    ptr.style.opacity = "1";
    try {
      await syncNow();
    } finally {
      ptr.classList.add("done");
      setTimeout(() => { ptr.className = "ptr g"; ptr.style.cssText = ""; }, 350);
    }
  }
  (function pullToRefresh() {
    const ptr = $("ptr");
    let startY = null, dist = 0;
    const blocked = () => document.querySelector("dialog[open]") || $("msheet").classList.contains("show") || !$("wpop").hidden;
    window.addEventListener("touchstart", e => {
      if (app.scroller.scrollTop > 0 || blocked() || e.touches.length !== 1 || syncing) return;
      startY = e.touches[0].clientY;
      dist = 0;
    }, { passive: true });
    window.addEventListener("touchmove", e => {
      if (startY === null) return;
      dist = Math.max(0, e.touches[0].clientY - startY);
      if (dist > 8 && app.tapStart) app.tapStart.moved = true;
      ptr.style.transform = `translateY(${Math.min(dist, 120) * 0.8 - 48}px) scale(${Math.min(1, 0.6 + dist / 200)}) rotate(${dist * 3}deg)`;
      ptr.style.opacity = String(Math.min(1, dist / 60));
    }, { passive: true });
    window.addEventListener("touchend", () => {
      if (startY === null) return;
      startY = null;
      if (dist > 70) runPullSync();
      else { ptr.style.transition = "transform .2s, opacity .2s"; ptr.style.transform = ""; ptr.style.opacity = "0"; setTimeout(() => { ptr.style.transition = ""; }, 220); }
      dist = 0;
    });
  })();

  // Neuerer Plan von einem anderen Handy? Dann übernehmen.
  // ---------------------------------------------------------------------------
  // WG-Einstellungen für alle Handys (neuerer Stand gewinnt): Mitbewohner, Znacht-Zeit,
  // Rezept-Webseiten, eigene Rezepte. Pro Handy bleiben: PIN, «Ich bin», Stil, Farben.
  // ---------------------------------------------------------------------------
  let settingsTimer = null, settingsServer = true;
  function wgSettings() {
    return { members: state.members, dinnerTime: load(DINNER_KEY, "18:30"), recipeSites: state.mySites, customRecipes: importer.customRecipes };
  }
  function settingsChanged() {
    save(SETTINGS_UPDATED_KEY, Date.now());
    showSettingsState("Wird gesendet …");
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(pushSettingsNow, 800);
  }
  async function pushSettingsNow() {
    clearTimeout(settingsTimer);
    settingsTimer = null;
    if (!connected()) return showSettingsState("Nur auf diesem Handy (nicht verbunden)"), false;
    try {
      const b = baseOf("settings");
      let updated;
      try {
        ({ updated } = await api("/settings", { method: "PUT", body: { settings: wgSettings(), ...(b ? { base: b.updated } : {}) } }));
      } catch (e) {
        const theirs = conflictOf(e);
        if (!theirs || !theirs.settings) throw e;
        mergeSettings(theirs); // jemand war schneller: zusammenführen und nochmals senden
        ({ updated } = await api("/settings", { method: "PUT", body: { settings: wgSettings(), base: theirs.updated } }));
      }
      save(SETTINGS_UPDATED_KEY, updated);
      setBase("settings", updated, Object.entries(wgSettings()));
      settingsServer = true;
      showSettingsState("Für alle gespeichert ✓");
      return true;
    } catch (e) {
      if (/Endpunkt/.test(e.message)) settingsServer = false; // alter WG-Server: Mitbewohner reisen weiter mit dem Plan
      showSettingsState(settingsServer ? e.message : "WG-Server zu alt – bitte aktualisieren");
      return false;
    }
  }
  function mergeSettings(remote) {
    if (!newer("settings", remote)) return;
    const b = baseOf("settings");
    const merged = Object.fromEntries(merge3(b && b.data, Object.entries(wgSettings()), Object.entries(remote.settings), e => e[0]));
    applySettings(merged);
    setBase("settings", remote.updated, Object.entries(remote.settings));
    save(SETTINGS_UPDATED_KEY, Date.now());
  }
  function applySettings(st) {
    if (Array.isArray(st.members) && st.members.length) {
      const known = new Set(state.members.map(m => m.id));
      state.members = st.members;
      // neue Mitbewohner essen standardmässig mit, weggefallene verschwinden aus dem Plan
      const ids = new Set(state.members.map(m => m.id));
      [state.plan, otherPlan()].filter(Boolean).forEach(p => p.forEach(d => {
        d.eaters = d.eaters.filter(x => ids.has(x));
        state.members.forEach(m => { if (!known.has(m.id) && !d.empty && !d.eaters.includes(m.id)) d.eaters.push(m.id); });
      }));
      save(KEYS.members, state.members);
    }
    if (st.dinnerTime) { save(DINNER_KEY, st.dinnerTime); $("dinnerTime").value = st.dinnerTime; }
    if (Array.isArray(st.recipeSites)) { state.mySites = st.recipeSites; save(SITES_KEY, state.mySites); app.renderSites(); }
    if (Array.isArray(st.customRecipes)) { importer.customRecipes = st.customRecipes; importer.saveCustomRecipes(); app.renderMyRecipes(); }
    app.renderMembers();
  }
  // Erster Start mit dieser Version: wer die WG schon angepasst hat (z.B. 5 Mitbewohner), dessen Stand gilt
  if (load(SETTINGS_UPDATED_KEY, null) === null) {
    const isDefault = state.members.length === DEFAULT_MEMBERS.length && state.members.every((m, i) => m.name === DEFAULT_MEMBERS[i].name && m.diet === DEFAULT_MEMBERS[i].diet);
    save(SETTINGS_UPDATED_KEY, isDefault && !importer.customRecipes.length ? 0 : Date.now());
  }
  function showSettingsState(t) { const el = $("settingsState"); if (el) el.textContent = t; }
  $("settingsSaveBtn").onclick = async () => {
    if (!connected()) return toast("Nicht verbunden: WG-PIN unter «Mehr» eingeben – bis dahin gilt alles nur auf diesem Handy");
    const ok = await pushSettingsNow();
    if (ok) { await pushPlanNow(); toast("Für alle gespeichert ✓ – die anderen sehen es beim nächsten Öffnen oder Herunterziehen"); }
    else toast($("settingsState").textContent || "Speichern fehlgeschlagen");
  };

  async function pullShared() {
    if (!connected()) return;
    try {
      const [remote, bring, vorrat, remoteNext, remoteSettings] = await Promise.all([
        api("/plan"), api("/bring/list"), api("/vorrat"),
        canPlanNext() ? api(`/plan/${nextWeekKey()}`).catch(() => null) : null,
        api("/settings").catch(e => { if (/Endpunkt/.test(e.message)) settingsServer = false; return null; })
      ]);
      // WG-Einstellungen: hat der Server noch keine, bekommt er unsere; sonst siehe «Abgleich» oben
      if (remoteSettings) {
        settingsServer = true;
        const todo = remoteSettings.settings ? syncCase(baseOf("settings"), load(SETTINGS_UPDATED_KEY, 0), remoteSettings.updated) : "push";
        if (todo === "take") {
          applySettings(remoteSettings.settings);
          save(SETTINGS_UPDATED_KEY, remoteSettings.updated);
          setBase("settings", remoteSettings.updated, Object.entries(wgSettings()));
          showSettingsState("Aktuell ✓");
        } else if (todo === "merge") {
          mergeSettings(remoteSettings);
          await pushSettingsNow();
        } else if (todo === "push") {
          await pushSettingsNow();
        } else {
          if (!baseOf("settings")) setBase("settings", remoteSettings.updated, Object.entries(wgSettings()));
          showSettingsState("Aktuell ✓");
        }
      }
      // Grundvorrat: hat der Server noch keinen, bekommt er unseren
      {
        const todo = Array.isArray(vorrat.staples) ? syncCase(baseOf("vorrat"), load(VORRAT_UPDATED_KEY, 0), vorrat.updated) : "push";
        if (todo === "take") {
          state.staples = vorrat.staples;
          save(KEYS.staples, state.staples);
          save(VORRAT_UPDATED_KEY, vorrat.updated);
          setBase("vorrat", vorrat.updated, vorrat.staples);
        } else if (todo === "merge") {
          mergeVorrat(vorrat);
          saveStaples();
        } else if (todo === "push") saveStaples();
        else if (!baseOf("vorrat")) setBase("vorrat", vorrat.updated, state.staples);
      }
      setBringList(bring);
      const localUpdated = load(PLAN_UPDATED_KEY, 0);
      // Neue Woche, und ein anderes Handy hat sie schon geplant: dieser Plan wird zur laufenden Woche
      const promoted = remote.week && remote.week < weekKey() ? await api(`/plan/${weekKey()}`).catch(() => null) : null;
      if (promoted && !isOpenWeek(promoted.plan) && promoted.updated > localUpdated) {
        setCurrentPlan(normalizeWeek(promoted.plan));
        save(PLAN_UPDATED_KEY, Date.now());
        remove(baseKey("plan")); // neue Woche: dieser Plan ersetzt den alten ganz
        await pushPlanNow();
        toast("Neue Woche: euer geplanter Plan gilt jetzt");
      } else if (remote.plan) {
        const todo = syncCase(baseOf("plan"), localUpdated, remote.updated);
        if (todo === "take") {
          if (!settingsServer && Array.isArray(remote.members) && remote.members.length) state.members = remote.members;
          const theirs = normalizeWeek(remote.plan);
          setCurrentPlan(theirs);
          save(KEYS.members, state.members);
          save(PLAN_UPDATED_KEY, remote.updated);
          setBase("plan", remote.updated, planViews(theirs));
          app.renderMembers();
          toast("Wochenplan der WG geladen");
        } else if (todo === "merge") {
          mergePlan(remote);
          await pushPlanNow();
          toast("Wochenplan der WG übernommen – deine Änderungen bleiben");
        } else if (todo === "" && !baseOf("plan")) setBase("plan", remote.updated, planViews(currentPlan()));
      }
      // Nächste Woche
      const localNext = state.nextDoc && state.nextDoc.week === nextWeekKey() ? state.nextDoc.updated || 0 : 0;
      if (remoteNext && Array.isArray(remoteNext.plan)) {
        const b = baseOf("next");
        const todo = localNext ? syncCase(b && b.week === nextWeekKey() ? b : null, localNext, remoteNext.updated) : "take";
        if (todo === "take") {
          state.nextDoc = { week: nextWeekKey(), plan: normalizeWeek(remoteNext.plan), updated: remoteNext.updated };
          save(NEXT_KEY, state.nextDoc);
          setBase("next", remoteNext.updated, planViews(state.nextDoc.plan), { week: state.nextDoc.week });
          if (state.viewNext) state.plan = state.nextDoc.plan;
        } else if (todo === "merge") {
          mergeNext(remoteNext);
          await pushNextNow();
        } else if (todo === "push") scheduleNextPush();
      } else if (remoteNext && localNext) {
        scheduleNextPush();
      }
      app.renderHeader();
      app.markWahl();
      refresh();
      setSyncStatus("Verbunden ✓", true);
    } catch (e) {
      setSyncStatus(e.message, false);
    }
  }

  // Bring!-Stand übernehmen. Vorrat, den der Bot gesetzt hat und der jetzt weg ist, wurde gekauft -> wieder «da».
  function setBringList(data) {
    state.bringItems = (data && data.items) || [];
    state.bringMine = (data && data.mine) || [];
    state.bringSpecs = Object.fromEntries(((data && data.details) || []).map(d => [d.name.toLowerCase(), d.spec || ""]));
    state.sentSpecs = Object.fromEntries(((data && data.mineDetails) || []).map(d => [d.name.toLowerCase(), d.spec || ""]));
    const on = new Set(state.bringItems.map(n => n.toLowerCase()));
    let changed = false;
    state.staples.forEach(st => {
      if (st.sent && !on.has(app.stapleTarget(st).toLowerCase())) {
        st.sent = false;
        st.in_stock = true;
        changed = true;
      }
    });
    if (changed) saveStaples();
  }

  // Was muss auf Bring!? Vergleich Plan <-> Liste:
  //  missing  = noch nicht drauf -> einfach senden
  //  changed  = vom Bot, aber der Plan braucht jetzt mehr/anders (z.B. zweites Rezept mit Rahm) -> nachfragen, vorausgewählt
  //  foreign  = hat jemand anderes eingetragen -> nachfragen, nicht vorausgewählt (Menge wird ergänzt)
  function bringDiff() {
    const wanted = bringPayload(state.shopping.filter(it => !it.isStaple));
    const res = { missing: [], changed: [], foreign: [] };
    for (const d of wanted) {
      const k = d.name.toLowerCase();
      if (!app.onBringNow(d.name)) res.missing.push(d);
      else if (k in state.sentSpecs) { if (state.sentSpecs[k] !== d.spec) res.changed.push({ ...d, now: state.bringSpecs[k] || "" }); }
      else res.foreign.push({ ...d, now: state.bringSpecs[k] || "" });
    }
    return res;
  }

  function askReview(diff) {
    return new Promise(resolve => {
      const rows = [
        ...diff.changed.map(d => ({ d, checked: true, kind: "changed" })),
        ...diff.foreign.map(d => ({ d, checked: false, kind: "foreign" })),
      ];
      $("dupText").textContent = (diff.missing.length ? `${diff.missing.length} neue Artikel werden hinzugefügt. ` : "") +
        "Diese stehen schon auf Bring!. Nochmals hinzufügen?";
      $("dupList").innerHTML = rows.map((r, i) => `
        <label class="duprow">
          <input type="checkbox" data-dup="${i}"${r.checked ? " checked" : ""}>
          <span><b>${esc(r.d.name)}</b>
            <small>auf Bring!: ${esc(r.d.now || "–")}${r.kind === "foreign" ? " (von jemand anderem)" : ""}</small>
            <small>Plan braucht: ${esc(r.d.spec)}${r.d.from.length ? ` · für ${esc(r.d.from.slice(0, 3).join(", "))}` : ""}</small>
          </span>
        </label>`).join("");
      const dlg = $("dupDialog");
      const done = v => { dlg.close(); resolve(v); };
      $("dupSendBtn").onclick = () => {
        const picked = [...$("dupList").querySelectorAll("[data-dup]")].filter(c => c.checked).map(c => rows[+c.dataset.dup]);
        // vom Bot: neue Gesamtmenge · fremd: Menge ergänzen, ihre Angabe bleibt stehen
        done(picked.map(r => ({ name: r.d.name, spec: r.kind === "foreign" && r.d.now ? `${r.d.now} + ${r.d.spec}` : r.d.spec })));
      };
      $("dupCancelBtn").onclick = () => done(null);
      dlg.showModal();
    });
  }

  async function undoBring({ remove, restore }) {
    try {
      for (let i = 0; i < remove.length; i += 40) {
        await api("/bring/remove", { method: "POST", body: { names: remove.slice(i, i + 40) } });
      }
      if (restore.length) await api("/bring/sync", { method: "POST", body: { items: restore } });
      setBringList(await api("/bring/list"));
      refresh();
      toast("Rückgängig gemacht – nichts eingefügt");
    } catch (e) {
      toast(`Bring!: ${e.message}`);
    }
  }

  async function syncToBring() {
    const btn = $("syncBtn");
    btn.disabled = true;
    try {
      setBringList(await api("/bring/list")); // aktueller Stand – vielleicht hat schon jemand gefüllt
      refresh();
      const diff = bringDiff();
      let extra = [];
      if (diff.changed.length || diff.foreign.length) {
        extra = await askReview(diff);
        if (extra === null) return;
      }
      const items = [...diff.missing, ...extra].map(({ name, spec }) => ({ name, spec }));
      if (!items.length) return toast("Alles schon auf Bring! ✓");
      // Für «Rückgängig»: neue Artikel wieder weg, bestehende auf die alte Menge zurück
      const undo = {
        remove: diff.missing.map(d => d.name),
        restore: extra.map(x => ({ name: x.name, spec: state.bringSpecs[x.name.toLowerCase()] || "" })),
      };
      let pushed = 0;
      for (let i = 0; i < items.length; i += 40) {
        const res = await api("/bring/sync", { method: "POST", body: { items: items.slice(i, i + 40) } });
        pushed += res.pushed || 0;
      }
      setBringList(await api("/bring/list"));
      refresh();
      app.setChip("done");
      const hidden = state.shopping.filter(it => it.isStaple).length;
      toast(`${pushed} Artikel in Bring! ✓${hidden ? ` · ${hidden} Grundvorrat ausgeblendet` : ""}`, { label: "Rückgängig", run: () => undoBring(undo) });
    } catch (e) {
      toast(`Bring!: ${e.message}`);
      app.openHandoff();
    } finally {
      app.renderCta();
    }
  }

  // Andere WG: der Stand des Servers gilt (sonst landen Plan und Mitbewohner der alten WG in der neuen)
  function forgetWgStand() {
    [PLAN_UPDATED_KEY, VORRAT_UPDATED_KEY, SETTINGS_UPDATED_KEY].forEach(k => save(k, 0));
    ["plan", "next", "vorrat", "settings"].forEach(n => remove(baseKey(n)));
    state.nextDoc = null;
    remove(NEXT_KEY);
  }

  Object.assign(app, { connected, api, setSyncStatus, setBase, pushPlanNow, pushNextNow, pushVorratNow,
    scheduleNextPush, schedulePlanPush, syncNow, runPullSync, wgSettings, settingsChanged, pushSettingsNow,
    applySettings, pullShared, setBringList, bringDiff, syncToBring, forgetWgStand });
})();
