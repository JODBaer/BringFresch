// Obsonare – Einkauf: Liste (zu kaufen / auf Bring! / Grundvorrat), kopieren, Bring! füllen per Teilen/Kopieren.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { isoWeek, plusWeek, bringPayload, state, $, esc, toast, copyText, toBuyItems, listLine, refresh, CORE, DAYS, STORE, load, save } = app;
  // Sortierung (pro Handy): nach Rezept wie im Plan oder nach Kategorie wie in Bring!
  const sortMode = () => (load(STORE.KEYS.SHOP_SORT_KEY, "rezept") === "kat" ? "kat" : "rezept");

  // ---------------------------------------------------------------------------
  // Rendering: Einkauf
  // ---------------------------------------------------------------------------
  // Drei Bereiche wie bisher: «Kaufen» (aus dem Plan + knapper Vorrat), «Auf Bring!», «Vorrat» (Liste aus app_vorrat.js)
  function renderShop() {
    const toBuy = toBuyItems();
    const onBring = state.shopping.filter(it => it.isOnBring && !it.isStaple);
    const knapp = app.knappShopHtml();
    const vorrat = app.vorratShopHtml();
    $("cntToBuy").textContent = toBuy.length + knapp.count;
    $("cntOnBring").textContent = onBring.length;
    $("cntStaples").textContent = vorrat.count;
    $("shopSummary").textContent = state.viewNext ? `KW ${isoWeek(plusWeek())}` : "";
    document.querySelectorAll("#shopSort [data-sort]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === sortMode())));
    $("shopTool").innerHTML = state.shopFilter === "staples" ? app.cookSwHtml() : ""; // «Woche gekocht» oben, nur im Vorrat
    document.querySelectorAll("#tab-shop .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === state.shopFilter)));
    app.renderTray();

    if (state.shopFilter === "staples") {
      $("shopList").innerHTML = vorrat.html;
      return;
    }
    const items = state.shopFilter === "toBuy" ? toBuy : onBring;
    const extra = state.shopFilter === "toBuy" ? knapp.html : "";
    if (items.length === 0) {
      const msg = state.shopFilter === "toBuy" ? "Nichts mehr zu kaufen. 🎉" : "Noch nichts davon steht auf Bring!.";
      $("shopList").innerHTML = (extra && state.shopFilter === "toBuy" ? "" : `<div class="empty">${msg}</div>`) + extra;
      return;
    }
    // nach Gericht (Reihenfolge des Plans) oder nach Kategorie (wie in Bring!); Gemeinsames unter «Für mehrere Gerichte»
    const daysOf = title => state.plan.map((d, i) => (d && d.title === title && !d.empty ? DAYS[i].slice(0, 2) : "")).filter(Boolean).join(", ");
    const groups = sortMode() === "kat" ? CORE.groupByCategory(items) : CORE.groupByDish(items, state.plan);
    $("shopList").innerHTML = (extra ? `<h3 class="vplan">Aus dem Plan</h3>` : "") + groups.map(g => `
      <div class="aisle dish">
        <h3>${g.several || g.cat || g.title === "Sonstiges" ? esc(g.title) : `<span class="dd-day">${esc(daysOf(g.title))}</span> ${esc(g.title)}`}</h3>
        ${g.items.map(it => `<button type="button" class="item tap-item${it.isOnBring ? " on" : ""}" data-shop="${esc(it.name)}" aria-pressed="${it.isOnBring}"><span>${esc(it.name)}${g.several ? `<small class="from">${esc((it.from || []).length)} Gerichte</small>` : ""}</span><span class="amt">${esc(it.spec)}</span></button>`).join("")}
      </div>`).join("") + extra;
  }

  // ---------------------------------------------------------------------------
  // Einkauf & Grundvorrat
  // ---------------------------------------------------------------------------
  document.querySelector("#tab-shop .seg").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.shopFilter = b.dataset.filter;
    renderShop();
  });
  $("shopSort").addEventListener("click", e => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    save(STORE.KEYS.SHOP_SORT_KEY, b.dataset.sort);
    renderShop();
  });
  // Wischen nach links/rechts wechselt den Reiter: Kaufen ⇄ Auf Bring! ⇄ Vorrat
  (() => {
    const order = ["toBuy", "onBring", "staples"];
    let x0 = null, y0 = null;
    const tab = $("tab-shop");
    tab.addEventListener("touchstart", e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
    tab.addEventListener("touchend", e => {
      if (x0 == null || document.querySelector("dialog[open]")) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const k = order.indexOf(state.shopFilter) + (dx < 0 ? 1 : -1);
      if (k < 0 || k > 2) return;
      state.shopFilter = order[k];
      renderShop();
    }, { passive: true });
  })();

  $("copyListBtn").onclick = async () => {
    const items = toBuyItems();
    const ok = await copyText(items.map(listLine).join("\n"));
    toast(ok ? `${items.length} Artikel kopiert` : "Kopieren nicht möglich");
  };

  $("shopList").addEventListener("click", async e => {
    const b = e.target.closest("[data-shop]");
    if (!b || b.disabled) return;
    const it = state.shopping.find(x => x.name === b.dataset.shop);
    if (!it) return;
    if (!app.connected()) return toast("Ohne WG-Server: «Bring! füllen» → Teilen/Kopieren");
    b.disabled = true;
    const [payload] = bringPayload([it]);
    await app.toggleOnBring(payload.name, payload.spec);
    refresh();
  });

  // ---------------------------------------------------------------------------
  // Bring! füllen (Übergabe per Teilen / Kopieren)
  // ---------------------------------------------------------------------------
  function openHandoff() {
    const items = toBuyItems();
    $("handoffSubtitle").textContent = `${items.length} Artikel · Teilen-Menü, Kopieren oder direkt in Bring! einfügen`;
    $("handoffPreview").textContent = items.map(listLine).join("\n");
    $("handoffDialog").showModal();
  }

  $("syncBtn").onclick = () => (app.connected() ? app.syncToBring() : openHandoff());

  $("shareListBtn").onclick = async () => {
    const text = toBuyItems().map(listLine).join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Obsonare Einkaufsliste", text });
        return;
      } catch (e) { /* abgebrochen → kopieren */ }
    }
    toast((await copyText(text)) ? "Liste kopiert" : "Kopieren nicht möglich");
  };

  $("copyOnlyBtn").onclick = async () => {
    const items = toBuyItems();
    toast((await copyText(items.map(listLine).join("\n"))) ? `${items.length} Artikel kopiert` : "Bitte Text oben markieren und kopieren");
  };

  $("copyOpenBringBtn").onclick = async () => {
    await copyText(toBuyItems().map(listLine).join("\n"));
    toast("Kopiert – Bring! wird geöffnet");
    setTimeout(() => { location.href = "bring://"; }, 300);
  };

  Object.assign(app, { renderShop, openHandoff });
})();
