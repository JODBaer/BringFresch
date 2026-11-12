// BringFrisch – Grundvorrat (Variante C, docs/design/grundvorrat-varianten.html): Mengen pro Artikel, Knappes und
// «Diese Woche gebraucht» vorne beim Einkauf, ein Grundvorrat dahinter (Kacheln, Blatt pro Artikel, Inventur) und die
// Gegenüberstellung Kaufen | Vorrat vor dem Senden. Nichts aus dem Vorrat geht ungefragt auf Bring!.
// Die Regeln (Knapp, Abbuchen, Mengen) stehen in core.js. Teil der App (Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { CORE, MONTHS, cleanIngredient, hasWord, bringItemId, bringPayload, weekKey, state, saveStaples, $, esc, toast,
    copyText, refresh } = app;
  const { vUnit, vPack, vQty, knappAb, isKnapp, setQty, stapleUse, isBooked, bookWeek, unbookWeek, emptyWeeks, oftLeer,
    monthsSince, isOld, qtyText, packText, qtyLevels, bringSuggest, normName } = CORE;

  // ---------------------------------------------------------------------------
  // Hilfen: Bring!-Artikel zu einem Vorrat-Eintrag, Abteilung, Monat
  // ---------------------------------------------------------------------------
  function stapleTarget(st) {
    const name = cleanIngredient(st.name).name;
    return bringItemId(name) || name;
  }
  const known = st => !!(window.BRING_CATALOG || {})[stapleTarget(st)];
  const label = st => (known(st) ? window.BRING_CATALOG[stapleTarget(st)] : stapleTarget(st));
  const sectionOf = st => (known(st) && (window.BRING_SECTIONS || {})[stapleTarget(st)]) || "Eigene Artikel";
  function onBringNow(name) {
    return state.bringItems.some(n => n.toLowerCase() === String(name).toLowerCase());
  }
  const onBringSt = st => onBringNow(stapleTarget(st));
  const nowYm = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const ymText = ym => { const m = /^(\d{4})-(\d{2})/.exec(ym || ""); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : ""; };
  const thisWeek = () => weekKey();
  const useOf = st => stapleUse(st, state.plan); // angezeigte Woche
  const cart = '<span class="vcart" aria-hidden="true">🛒</span>';

  // Was kommt zu «Für Bring!»: knapp und noch nicht drauf
  const pendingIdx = () => state.staples.map((st, i) => i).filter(i => isKnapp(state.staples[i]) && !onBringSt(state.staples[i]));

  // ---------------------------------------------------------------------------
  // Einkauf (vorne): «Aus dem Vorrat – wird knapp» (Kaufen), Liste «Vorrat», Leiste «Für Bring!»
  // ---------------------------------------------------------------------------
  function useText(st, use) {
    if (!use) return "";
    const booked = st.booked && st.booked.w === app.shownWeek();
    return booked ? ` (−${st.booked.n})` : ` → ${Math.max(0, vQty(st) - use)}`;
  }
  function vrow(i, extra = "") {
    const st = state.staples[i], q = vQty(st), use = useOf(st);
    const cls = q === 0 ? " zero" : isKnapp(st) ? " low" : "";
    return `<button type="button" class="vrow${cls}" data-vleer="${i}" aria-pressed="${q === 0}" aria-label="${esc(label(st))}, ${esc(qtyText(st, q, true))}. Antippen = leer">
      <span class="l">${esc(label(st))}${onBringSt(st) ? " " + cart : ""}</span>
      <span class="r">${q === 0 ? "leer" : esc(qtyText(st) + useText(st, use))}${extra ? `<small>${esc(extra)}</small>` : ""}</span></button>`;
  }
  // Abschnitte der Vorrat-Liste beim Einkauf
  function vorratGroups() {
    const idx = state.staples.map((_, i) => i);
    const week = idx.filter(i => useOf(state.staples[i]) > 0);
    const inWeek = new Set(week);
    const oft = idx.filter(i => !inWeek.has(i) && oftLeer(state.staples[i], thisWeek()));
    const inOft = new Set(oft);
    const low = idx.filter(i => !inWeek.has(i) && !inOft.has(i) && isKnapp(state.staples[i]));
    const shown = new Set([...week, ...oft, ...low]);
    return { week, oft, low, rest: idx.filter(i => !shown.has(i)) };
  }
  let allOpen = false;
  function vorratShopHtml() {
    const g = vorratGroups();
    const booked = isBooked(state.staples, app.shownWeek());
    const sec = (cls, title, hint, list, none, extra) => `<section class="vsec ${cls}"><h3><span>${esc(title)}</span><small>${list.length}${hint ? " · " + esc(hint) : ""}</small></h3>
      ${list.length ? list.map(i => vrow(i, extra ? extra(state.staples[i]) : "")).join("") : `<p class="vnone">${esc(none)}</p>`}</section>`;
    const seen = st => (!st.weekly && emptyWeeks(st, thisWeek()) >= 3 ? `erkannt: ${emptyWeeks(st, thisWeek())} von 4 Wochen leer` : "");
    return {
      count: g.week.length + g.oft.length + g.low.length,
      html: `<div class="vbar"><button type="button" class="vsw" role="switch" id="cookSw" aria-checked="${booked}"><i></i><span>Woche gekocht</span></button>
          <span class="hint">Bucht ab, was der Plan aus dem Vorrat braucht.</span></div>
        ${sec("woche", "Diese Woche gebraucht", booked ? "abgebucht" : "noch da → danach", g.week, "Der Plan braucht nichts aus dem Vorrat.")}
        ${sec("oft", "Geht oft aus – noch da?", "", g.oft, "Keine Vorschläge.", seen)}
        ${sec("low", "Sonst knapp", "", g.low, "Nichts knapp.")}
        <details class="vall" id="vAll"${allOpen ? " open" : ""}><summary>Alles da <small>${g.rest.length}</small></summary>${g.rest.map(i => vrow(i)).join("")}</details>
        <p class="hint vfoot">Zeile antippen = im Vorrat leer, nochmals = wieder da.</p>`
    };
  }
  // Kaufen: knapper Vorrat (noch nicht auf Bring!) – antippen = Blatt zum Artikel
  function knappShopHtml() {
    const list = pendingIdx();
    if (!list.length) return { count: 0, html: "" };
    return {
      count: list.length,
      html: `<section class="vsec low"><h3><span>Aus dem Vorrat – wird knapp</span><small>${list.length} · mit «Prüfen»</small></h3>
        ${list.map(i => { const st = state.staples[i]; return `<button type="button" class="vrow low" data-vitem="${i}"><span class="l">${esc(label(st))}</span><span class="r">${esc(qtyText(st))}<small>+ ${esc(packText(st))}</small></span></button>`; }).join("")}</section>`
    };
  }
  function renderTray() {
    const tray = $("vorratTray");
    const p = pendingIdx();
    tray.hidden = state.shopFilter === "onBring" || !p.length;
    tray.innerHTML = p.length ? `<div class="tx"><b>Für Bring! (${p.length}) · knapp</b><span>${esc(p.map(i => label(state.staples[i])).join(", "))}</span></div>
      <button type="button" class="btn primary" id="trayCheckBtn">Prüfen</button>` : "";
    $("cmpCount").textContent = state.bringItems.length;
  }

  function toggleLeer(i) {
    const st = state.staples[i];
    if (!st) return;
    if (vQty(st) > 0) {
      setQty(st, 0, thisWeek());
      toast(`${label(st)} leer – kommt mit «Prüfen» auf Bring!`);
    } else setQty(st, st.prev || vPack(st));
    saveStaples();
    refresh();
  }
  function cookToggle() {
    const week = app.shownWeek();
    if (isBooked(state.staples, week)) {
      unbookWeek(state.staples, week);
      toast("Abbuchen rückgängig gemacht");
    } else {
      const n = bookWeek(state.staples, state.plan, week);
      toast(n ? `Woche gekocht: ${n} Artikel abgebucht` : "Der Plan braucht nichts aus dem Vorrat");
    }
    saveStaples();
    refresh();
  }

  $("shopList").addEventListener("click", e => {
    const sw = e.target.closest("#cookSw");
    if (sw) return cookToggle();
    const v = e.target.closest("[data-vleer]");
    if (v) return toggleLeer(+v.dataset.vleer);
    const it = e.target.closest("[data-vitem]");
    if (it) return openItem(+it.dataset.vitem);
  });
  $("shopList").addEventListener("toggle", e => { if (e.target.id === "vAll") allOpen = e.target.open; }, true);
  $("vorratTray").addEventListener("click", e => { if (e.target.closest("#trayCheckBtn")) openCompare(); });
  $("compareBtn").onclick = () => openCompare();

  // ---------------------------------------------------------------------------
  // Gegenüberstellung: links Kaufen (Plan), rechts Vorrat (leer, knapp, geht oft aus). Antippen = kommt auf Bring!
  // ---------------------------------------------------------------------------
  let cmp = null; // { plan: [...], vor: [...], sel: Set }
  function compareRows() {
    const plan = bringPayload(state.shopping.filter(it => !it.isStaple)).map(d => ({ key: "p:" + d.name, name: d.name, spec: d.spec, on: onBringNow(d.name) }));
    const seen = new Set();
    const vor = state.staples.map((st, i) => ({ st, i })).filter(({ st }) => isKnapp(st) || oftLeer(st, thisWeek()))
      .filter(({ st }) => { const k = stapleTarget(st).toLowerCase(); return !seen.has(k) && seen.add(k); })
      .map(({ st, i }) => ({ key: "v:" + i, i, name: stapleTarget(st), label: label(st), spec: `Vorrat · ${packText(st)}`,
        sub: `${vQty(st) ? "noch " + qtyText(st) : "leer"} · +${packText(st)}`, knapp: isKnapp(st), on: onBringSt(st) }));
    return { plan, vor };
  }
  function openCompare() {
    const { plan, vor } = compareRows();
    cmp = { plan, vor, sel: new Set([...plan, ...vor.filter(v => v.knapp)].filter(x => !x.on).map(x => x.key)) };
    renderCompare();
    $("compareDialog").showModal();
  }
  function renderCompare() {
    const chip = x => `<button type="button" class="dchip" data-cmp="${esc(x.key)}" aria-pressed="${x.on || cmp.sel.has(x.key)}"${x.on ? " disabled" : ""}>${esc(x.label || x.name)}<small>${x.on ? "schon auf Bring!" : esc(x.sub || x.spec)}</small></button>`;
    const col = (title, list, none) => `<div class="dc"><h3>${esc(title)}</h3>${list.length ? list.map(chip).join("") : `<p class="vnone">${esc(none)}</p>`}</div>`;
    $("compareCols").innerHTML = col("Kaufen · aus dem Plan", cmp.plan, "Nichts aus dem Plan.") + col("Vorrat · leer, knapp, geht oft aus", cmp.vor, "Nichts knapp.");
    const n = [...cmp.plan, ...cmp.vor].filter(x => !x.on && cmp.sel.has(x.key)).length;
    const b = $("compareSendBtn");
    b.disabled = !n;
    b.textContent = n ? `${n} auf Bring!` : "Nichts gewählt";
  }
  $("compareCols").addEventListener("click", e => {
    const b = e.target.closest("[data-cmp]");
    if (!b || b.disabled) return;
    const k = b.dataset.cmp;
    if (cmp.sel.has(k)) cmp.sel.delete(k); else cmp.sel.add(k);
    renderCompare();
  });
  $("compareSendBtn").onclick = async () => {
    const picked = [...cmp.plan, ...cmp.vor].filter(x => !x.on && cmp.sel.has(x.key));
    if (!picked.length) return;
    const items = picked.map(x => ({ name: x.name, spec: x.spec }));
    const btn = $("compareSendBtn");
    if (!app.connected()) {
      const ok = await copyText(items.map(x => `${x.name} (${x.spec})`).join("\n"));
      $("compareDialog").close();
      return toast(ok ? `${items.length} Artikel kopiert – in Bring! einfügen` : "Kopieren nicht möglich");
    }
    btn.disabled = true;
    try {
      let pushed = 0;
      for (let i = 0; i < items.length; i += 40) {
        const res = await app.api("/bring/sync", { method: "POST", body: { items: items.slice(i, i + 40) } });
        pushed += res.pushed || 0;
      }
      const sent = picked.filter(x => x.i != null).map(x => state.staples[x.i]).filter(Boolean);
      sent.forEach(st => { st.sent = true; });
      if (sent.length) saveStaples();
      app.setBringList(await app.api("/bring/list"));
      $("compareDialog").close();
      refresh();
      toast(`${pushed || items.length} auf Bring! ✓`, { label: "Rückgängig", run: async () => {
        sent.forEach(st => { st.sent = false; });
        if (sent.length) saveStaples();
        await app.undoBring({ remove: items.map(x => x.name), restore: [] });
      } });
    } catch (err) {
      toast(`Bring!: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  };

  // ---------------------------------------------------------------------------
  // Grundvorrat (dahinter): hinzufügen, Übersicht, Kacheln (Abteilung / Dringend), lange drücken = Karte dreht sich
  // ---------------------------------------------------------------------------
  let grp = "abteilung", flip = null;
  function tile(i) {
    const st = state.staples[i], q = vQty(st), use = useOf(st);
    if (flip === i) {
      return `<div class="qt back" data-back="${i}"><span class="n">${esc(label(st))}</span>
        <button type="button" class="xs" data-del="${i}" aria-label="${esc(label(st))} wegnehmen">✕</button>
        <div class="st"><button type="button" data-step="-1" data-i="${i}" aria-label="weniger">−</button><output aria-label="${esc(qtyText(st))}">${q}</output><button type="button" data-step="1" data-i="${i}" aria-label="mehr">+</button></div></div>`;
    }
    const cls = q === 0 ? " zero" : isKnapp(st) ? " low" : "";
    return `<button type="button" class="qt${cls}" data-staple="${i}" title="${esc(st.name)}" aria-label="${esc(label(st))}, ${esc(qtyText(st, q, true))}${onBringSt(st) ? ", steht auf Bring!" : ""}. Lange drücken zum Ändern">
      <span class="n">${esc(label(st))}${onBringSt(st) ? " " + cart : ""}</span><span class="q">${esc(qtyText(st) + useText(st, use))}</span>${isOld(st, nowYm()) ? `<span class="old">seit ${esc(ymText(st.since))}</span>` : ""}</button>`;
  }
  function sections() {
    const idx = state.staples.map((_, i) => i);
    const kn = i => isKnapp(state.staples[i]);
    if (grp === "dringend") {
      return [
        ["Knapp", idx.filter(kn), "2 oder weniger"],
        ["Diese Woche gebraucht", idx.filter(i => !kn(i) && useOf(state.staples[i]) > 0), "wird abgebucht"],
        ["Alles da", idx.filter(i => !kn(i) && !useOf(state.staples[i])), ""]
      ];
    }
    const order = window.BRING_SECTION_ORDER || [];
    const groups = {};
    idx.forEach(i => (groups[sectionOf(state.staples[i])] = groups[sectionOf(state.staples[i])] || []).push(i));
    const rank = s => (order.indexOf(s) + 1) || 99;
    return Object.keys(groups).sort((a, b) => rank(a) - rank(b)).map(s => {
      const list = groups[s].sort((a, b) => kn(b) - kn(a));
      const k = list.filter(kn).length;
      return [s, list, k ? `${k} knapp` : ""];
    });
  }
  function renderStaples() {
    const n = state.staples.length;
    const nK = state.staples.filter(isKnapp).length, nW = state.staples.filter(st => useOf(st) > 0).length;
    const nO = state.staples.filter(st => isOld(st, nowYm())).length;
    $("stapleSum").innerHTML = `${n} Artikel · <b>${nK} knapp</b> · ${nW} diese Woche gebraucht${nO ? ` · <b>${nO} über ein Jahr</b>` : ""}`;
    document.querySelectorAll("#staplesDialog [data-grp]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.grp === grp)));
    $("staplesList").innerHTML = sections().map(([title, list, hint]) => `<section class="bsec" aria-label="${esc(title)}">
        <h3><span>${esc(title)}</span><small>${list.length}${hint ? " · " + esc(hint) : ""}</small></h3>
        ${list.length ? `<div class="qtiles">${list.map(tile).join("")}</div>` : `<p class="vnone">–</p>`}</section>`).join("");
    // Inventur: einmal im Jahr; zuletzt = jüngste Prüfung eines Artikels
    const last = state.staples.map(st => st.checked).filter(Boolean).sort().pop();
    const due = !last || monthsSince(last, nowYm()) >= 12;
    $("invCard").className = `card vinv${due ? " due" : ""}`;
    $("invCard").innerHTML = `<div class="tx"><b>Inventur</b><span>${last ? `Letzte: ${esc(ymText(last))}` : "Noch keine"}${due ? " – einmal im Jahr alles durchgehen" : ""}</span></div>
      <button type="button" class="btn${due ? " primary" : ""}" id="invBtn">Inventur starten</button>`;
    renderSugg();
  }

  $("openStaplesBtn").onclick = () => {
    flip = null;
    renderStaples();
    $("staplesDialog").showModal();
    if (app.connected()) app.api("/bring/list").then(d => { app.setBringList(d); refresh(); }).catch(() => {});
  };
  document.querySelector("#staplesDialog .vbar").addEventListener("click", e => {
    const b = e.target.closest("[data-grp]");
    if (b) { grp = b.dataset.grp; flip = null; renderStaples(); }
  });

  // Hinzufügen mit Vorschlägen aus Bring!; Unbekanntes darf als eigener Artikel (ohne Bild) dazu
  const findExisting = name => state.staples.find(st => normName(stapleTarget(st)) === normName(name) || normName(st.name) === normName(name));
  function renderSugg() {
    const q = $("newStaple").value.trim();
    if (!q) { $("stapleSugg").innerHTML = ""; return; }
    const list = bringSuggest(q);
    const row = (name, own) => {
      const ex = findExisting(name);
      return `<li class="srow"><span class="simg sm${own ? " own" : ""}" aria-hidden="true">${esc(name.charAt(0))}</span>
        <span class="st"><b>${esc(name)}</b><small>${own ? "Eigener Artikel (ohne Bring!-Bild)" : esc((window.BRING_SECTIONS || {})[bringItemId(name)] || "Bring!")}</small></span>
        ${ex ? `<span class="badge">ist schon da${normName(ex.name) !== normName(name) ? ` (${esc(ex.name)})` : ""}</span>` : `<button type="button" class="btn dark sm" data-add="${esc(name)}">Hinzufügen</button>`}</li>`;
    };
    const exact = list.some(n => normName(n) === normName(q));
    $("stapleSugg").innerHTML = `<ul class="sugg" aria-label="Vorschläge aus Bring!">${list.map(n => row(n, false)).join("")}${exact ? "" : row(q, true)}</ul>`;
  }
  function addStaple(name) {
    const id = "custom-" + Date.now();
    state.staples.push({ id, name, category: "Eigene", in_stock: true, keywords: [name.toLowerCase()], qty: 10, unit: "Znacht", pack: 10, since: nowYm() });
    saveStaples();
    $("newStaple").value = "";
    toast(`${name} hinzugefügt`);
    refresh();
  }
  $("newStaple").addEventListener("input", renderSugg);
  $("stapleSugg").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) addStaple(b.dataset.add); });
  $("addStapleForm").addEventListener("submit", e => {
    e.preventDefault();
    renderSugg();
    const b = $("stapleSugg").querySelector("[data-add]");
    if (b) addStaple(b.dataset.add);
    else if ($("newStaple").value.trim()) toast("Ist schon im Grundvorrat");
  });

  // Kacheln: antippen = Blatt; lange drücken (oder Rechtsklick) = Karte dreht sich (− + und ✕); daneben tippen = zurück
  let holdT = null, held = false;
  const list = $("staplesList");
  const doFlip = el => { held = true; flip = +el.dataset.staple; renderStaples(); };
  list.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-staple]");
    held = false;
    clearTimeout(holdT);
    if (b) holdT = setTimeout(() => doFlip(b), 500);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => list.addEventListener(t, () => clearTimeout(holdT)));
  list.addEventListener("pointermove", e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(holdT); });
  list.addEventListener("contextmenu", e => { const b = e.target.closest("[data-staple]"); if (b) { e.preventDefault(); clearTimeout(holdT); doFlip(b); } });
  $("staplesDialog").addEventListener("click", e => {
    if (held) { held = false; e.preventDefault(); e.stopPropagation(); return; }
    if (flip != null && !e.target.closest(".qt.back")) { flip = null; renderStaples(); if (!e.target.closest("[data-staple],[data-close]")) return; }
    const del = e.target.closest("[data-del]");
    if (del) { flip = null; return removeStaple(+del.dataset.del); }
    const step = e.target.closest("[data-step]");
    if (step) {
      const st = state.staples[+step.dataset.i];
      setQty(st, vQty(st) + +step.dataset.step, thisWeek());
      saveStaples();
      return refresh();
    }
    const t = e.target.closest("[data-staple]");
    if (t) openItem(+t.dataset.staple);
    if (e.target.closest("#invBtn")) startInventur();
  }, true);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && flip != null && $("staplesDialog").open) { flip = null; renderStaples(); e.preventDefault(); }
  });

  function removeStaple(i) {
    const st = state.staples[i];
    if (!st) return;
    state.staples.splice(i, 1);
    saveStaples();
    if ($("stapleItemDialog").open) $("stapleItemDialog").close();
    refresh();
    toast(`${label(st)} weggenommen`, { label: "Rückgängig", run: () => { state.staples.splice(Math.min(i, state.staples.length), 0, st); saveStaples(); refresh(); } });
  }

  // ---------------------------------------------------------------------------
  // Blatt zum Artikel: Menge − +, Leer / Fast leer / Halb / Voll, Einheit, Packung, «1 Stück =», Infos, Name, wegnehmen
  // ---------------------------------------------------------------------------
  let itemIdx = null;
  function openItem(i) {
    if (!state.staples[i]) return;
    itemIdx = i;
    flip = null;
    renderItem();
    $("stapleItemDialog").showModal();
  }
  function renderItem() {
    const st = state.staples[itemIdx];
    if (!st) { if ($("stapleItemDialog").open) $("stapleItemDialog").close(); return; }
    const q = vQty(st), use = useOf(st), on = onBringSt(st), own = !known(st), thr = knappAb(st);
    const dupes = state.staples.filter(x => x !== st && stapleTarget(x).toLowerCase() === stapleTarget(st).toLowerCase());
    $("vImg").className = `simg${own ? " own" : ""}`;
    $("vImg").innerHTML = `${esc(label(st).charAt(0))}<small>${own ? "kein Bild" : "Bring!"}</small>`;
    $("vTitle").textContent = label(st);
    $("vSub").textContent = `${own ? "Eigener Artikel (ohne Bild)" : "Bring!-Artikel · " + sectionOf(st)}${on ? " · steht auf Bring!" : ""}`;
    const stepper = (act, out, lbl) => `<div class="stepper"><button type="button" class="btn" data-v="${act}-" aria-label="${lbl} weniger">−</button><output aria-live="polite">${esc(out)}</output><button type="button" class="btn" data-v="${act}+" aria-label="${lbl} mehr">+</button></div>`;
    $("vBody").innerHTML = `
      <span class="vlbl">Noch da</span>${stepper("q", qtyText(st, q, true), "Menge")}
      <div class="qbtns">${qtyLevels(st).map(([t, n]) => `<button type="button" data-v="set" data-n="${n}" aria-pressed="${q === n}">${t}</button>`).join("")}</div>
      <div class="vline"><span class="vlbl">Zählt in</span><span class="mseg" role="group" aria-label="Einheit">
        <button type="button" data-v="unit" data-u="Znacht" aria-pressed="${vUnit(st) === "Znacht"}">Znacht</button><button type="button" data-v="unit" data-u="Stk" aria-pressed="${vUnit(st) === "Stk"}">Stück</button></span></div>
      <span class="vlbl">Eine Packung</span>${stepper("p", packText(st), "Packung")}
      ${vUnit(st) === "Stk" ? `<label class="field">1 Stück =<input type="text" id="vSize" value="${esc(st.size || "")}" placeholder="z.B. 1 l, 250 g, 1 Dose" autocomplete="off"></label>` : ""}
      <ul class="facts">
        <li>Eine Packung = ${esc(packText(st))}. In Bring! gekauft (abgehakt) = so viel kommt dazu.</li>
        <li>${use ? `Diese Woche braucht der Plan ${use} davon («Woche gekocht» bucht ab).` : "Diese Woche braucht der Plan nichts davon."}</li>
        <li${isKnapp(st) ? ' class="w"' : ""}>${on ? "Steht schon auf Bring!." : isKnapp(st) ? "Knapp: steht beim Einkauf unter «Für Bring!»." : thr ? `Ab ${thr} oder weniger kommt es zu «Für Bring!».` : "Kommt zu «Für Bring!», sobald es leer ist."}</li>
        <li${isOld(st, nowYm()) ? ' class="w"' : ""}>${st.since ? `Im Vorrat seit ${esc(ymText(st.since))}${isOld(st, nowYm()) ? " – über ein Jahr. Noch gut?" : ""}` : "Seit wann im Vorrat: ab dem nächsten Einkauf bekannt."}</li>
      </ul>
      <label class="chk"><input type="checkbox" id="vWeekly"${st.weekly ? " checked" : ""}> Geht jede Woche aus (beim Einkauf vorschlagen)</label>
      ${dupes.length ? `<div class="card vdup"><p>Doppelt: ${dupes.map(d => "«" + esc(d.name) + "»").join(", ")} ist auch «${esc(label(st))}».</p><button type="button" class="btn sm" data-v="merge">Zusammenführen</button></div>` : ""}
      <label class="field">Name<span class="addrow"><input type="text" id="vName" value="${esc(st.name)}" autocomplete="off"><button type="button" class="btn sm" data-v="rename">Umbenennen</button></span></label>
      <div class="row vacts"><button type="button" class="btn danger" data-v="del">Wegnehmen</button><button type="button" class="btn primary" data-close>Fertig</button></div>`;
  }
  $("vBody").addEventListener("click", e => {
    const b = e.target.closest("[data-v]");
    const st = state.staples[itemIdx];
    if (!b || !st) return;
    const v = b.dataset.v;
    if (v === "del") return removeStaple(itemIdx);
    if (v === "q-" || v === "q+") setQty(st, vQty(st) + (v === "q+" ? 1 : -1), thisWeek());
    else if (v === "set") setQty(st, +b.dataset.n, thisWeek());
    else if (v === "p-" || v === "p+") st.pack = Math.max(1, vPack(st) + (v === "p+" ? 1 : -1));
    else if (v === "unit") {
      if (vUnit(st) === b.dataset.u) return;
      const q = vQty(st);
      st.unit = b.dataset.u;
      st.pack = b.dataset.u === "Stk" ? 2 : 10;
      setQty(st, q === 0 ? 0 : Math.min(q, st.pack));
    } else if (v === "rename") {
      const val = $("vName").value.trim();
      if (!val || val === st.name) return;
      if (state.staples.some(x => x !== st && x.name.toLowerCase() === val.toLowerCase())) return toast("Gibt es schon im Grundvorrat");
      st.name = val;
      st.keywords = [...new Set([...(st.keywords || []), val.toLowerCase()])];
      toast(`Umbenannt: ${label(st)}`);
    } else if (v === "merge") {
      const dupes = state.staples.filter(x => x !== st && stapleTarget(x).toLowerCase() === stapleTarget(st).toLowerCase());
      st.keywords = [...new Set([st.keywords || [], ...dupes.map(d => d.keywords || [d.name.toLowerCase()])].flat())];
      setQty(st, Math.min(vQty(st), ...dupes.map(vQty)));
      state.staples = state.staples.filter(x => !dupes.includes(x));
      itemIdx = state.staples.indexOf(st);
      toast("Zusammengeführt");
    } else return;
    saveStaples();
    refresh();
  });
  $("vBody").addEventListener("change", e => {
    const st = state.staples[itemIdx];
    if (!st) return;
    if (e.target.id === "vWeekly") st.weekly = e.target.checked;
    else if (e.target.id === "vSize") st.size = e.target.value.trim();
    else return;
    saveStaples();
    refresh();
  });

  // ---------------------------------------------------------------------------
  // Inventur: alle Artikel der Reihe nach (vier Knöpfe), «Stimmt so», jederzeit aufhören
  // ---------------------------------------------------------------------------
  let inv = 0;
  function startInventur() {
    inv = 0;
    renderInv();
    $("invDialog").showModal();
  }
  function renderInv() {
    const st = state.staples[inv];
    if (!st) return;
    $("invTitle").textContent = `Inventur · ${inv + 1} von ${state.staples.length}`;
    $("invBody").innerHTML = `<div class="invname">${esc(label(st))}</div>
      <p class="hint">${label(st) !== st.name ? esc(st.name) + " · " : ""}bisher: ${esc(qtyText(st, vQty(st), true))}${st.since ? ` · seit ${esc(ymText(st.since))}` : ""}</p>
      <div class="qbtns">${qtyLevels(st).map(([t, n]) => `<button type="button" data-inv="${n}">${t}</button>`).join("")}</div>
      <div class="row"><button type="button" class="btn" data-close>Aufhören</button><button type="button" class="btn" id="invSkip">Stimmt so</button></div>`;
  }
  $("invBody").addEventListener("click", e => {
    const st = state.staples[inv];
    const set = e.target.closest("[data-inv]");
    if (!st || !(set || e.target.closest("#invSkip"))) return;
    if (set) setQty(st, +set.dataset.inv, thisWeek());
    st.checked = nowYm();
    inv++;
    saveStaples();
    if (inv >= state.staples.length) { $("invDialog").close(); toast("Inventur abgeschlossen ✓"); }
    else renderInv();
    refresh();
  });

  // Offene Ansichten nach jedem Neuzeichnen nachführen (app.subscribe, siehe app.js)
  app.subscribe(() => {
    renderTray();
    if ($("staplesDialog").open) renderStaples();
    if ($("stapleItemDialog").open) renderItem();
  });

  // Bring! füllen per Knopf (alte Bedienung, z.B. Einkaufszeile antippen) – jederzeit, auch nach «Bring! füllen».
  // Wegnehmen nur, was der Bot selbst gesetzt hat. Rückgabe: "on", "off", "foreign" oder null (Fehler).
  async function toggleOnBring(target, spec) {
    try {
      let result;
      if (onBringNow(target)) {
        const r = await app.api("/bring/remove", { method: "POST", body: { names: [target] } });
        if (r.notMine && r.notMine.length) {
          toast(`${target} hat jemand anderes auf Bring! gesetzt – dort abhaken`);
          result = "foreign";
        } else {
          toast(`${target} von Bring! genommen`);
          result = "off";
        }
      } else {
        await app.api("/bring/sync", { method: "POST", body: { items: [{ name: target, spec: spec || "" }] } });
        toast(`${target} auf Bring! ✓`);
        result = "on";
      }
      app.setBringList(await app.api("/bring/list"));
      return result;
    } catch (err) {
      toast(`Bring!: ${err.message}`);
      return null;
    }
  }

  // Passender Grundvorrat-Eintrag zu einer Zutat (z.B. «Olivenöl» -> Olivenöl extra vergine)
  function stapleFor(name) {
    const lower = name.toLowerCase();
    return state.staples.find(st => (st.keywords || [st.name.toLowerCase()]).some(k => hasWord(lower, k)));
  }

  Object.assign(app, { stapleTarget, onBringNow, toggleOnBring, stapleFor, vorratShopHtml, knappShopHtml, renderTray,
    renderStaples, openItem, openCompare, nowYm });
})();
