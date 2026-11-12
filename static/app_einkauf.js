// BringFrisch – Einkauf: Liste (zu kaufen / auf Bring! / Grundvorrat), kopieren, Bring! füllen per Teilen/Kopieren.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { isoWeek, plusWeek, bringPayload, state, saveStaples, $, esc, toast, copyText, toBuyItems, listLine, refresh } = app;

  // ---------------------------------------------------------------------------
  // Rendering: Einkauf
  // ---------------------------------------------------------------------------
  function renderShop() {
    const groups = {
      toBuy: toBuyItems(),
      onBring: state.shopping.filter(it => it.isOnBring && !it.isStaple),
      staples: state.shopping.filter(it => it.isStaple)
    };
    $("cntToBuy").textContent = groups.toBuy.length;
    $("cntOnBring").textContent = groups.onBring.length;
    $("cntStaples").textContent = groups.staples.length;
    $("shopSummary").textContent = `${app.viewNext ? `Nächste Woche (KW ${isoWeek(plusWeek())}) · ` : ""}${state.shopping.length} Zutaten · antippen = auf/von Bring!`;
    document.querySelectorAll("#tab-shop .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === state.shopFilter)));

    const items = groups[state.shopFilter];
    if (items.length === 0) {
      const msg = {
        toBuy: "Nichts mehr zu kaufen. 🎉",
        onBring: "Noch nichts davon steht auf Bring!.",
        staples: "Keine Grundzutaten in diesem Wochenplan."
      }[state.shopFilter];
      $("shopList").innerHTML = `<div class="empty">${msg}</div>`;
      return;
    }
    const byAisle = {};
    items.forEach(it => (byAisle[it.cat] = byAisle[it.cat] || []).push(it));
    $("shopList").innerHTML = Object.keys(byAisle).sort().map(cat => `
      <div class="aisle">
        <h3>${esc(cat)}</h3>
        ${byAisle[cat].map(it => `<button type="button" class="item tap-item${it.isOnBring ? " on" : ""}" data-shop="${esc(it.name)}" aria-pressed="${it.isOnBring}"><span>${esc(it.name)}</span><span class="amt">${esc(it.spec)}</span></button>`).join("")}
      </div>`).join("");
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
    const st = it.isStaple || app.stapleFor(it.name) ? app.stapleFor(it.name) : null;
    if (!app.connected()) {
      // ohne Server: Grundvorrat als «leer» markieren, kommt beim nächsten Teilen/Kopieren mit
      if (st) { st.in_stock = st.in_stock === false; saveStaples(); refresh(); }
      else toast("Ohne WG-Server: «Bring! füllen» → Teilen/Kopieren");
      return;
    }
    b.disabled = true;
    const [payload] = bringPayload([it]);
    const r = await app.toggleOnBring(payload.name, payload.spec);
    if (st && r === "on") { st.in_stock = false; st.sent = true; saveStaples(); }
    if (st && r === "off") { st.in_stock = true; st.sent = false; saveStaples(); }
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
        await navigator.share({ title: "BringFrisch Einkaufsliste", text });
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
