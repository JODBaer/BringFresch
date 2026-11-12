// BringFrisch – Einkauf: Liste (zu kaufen / auf Bring! / Grundvorrat), kopieren, Bring! füllen per Teilen/Kopieren.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { isoWeek, plusWeek, bringPayload, state, $, esc, toast, copyText, toBuyItems, listLine, refresh } = app;

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
    $("shopSummary").textContent = `${state.viewNext ? `Nächste Woche (KW ${isoWeek(plusWeek())}) · ` : ""}${state.shopping.length} Zutaten`;
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
    const byAisle = {};
    items.forEach(it => (byAisle[it.cat] = byAisle[it.cat] || []).push(it));
    $("shopList").innerHTML = (extra ? `<h3 class="vplan">Aus dem Plan</h3>` : "") + Object.keys(byAisle).sort().map(cat => `
      <div class="aisle">
        <h3>${esc(cat)}</h3>
        ${byAisle[cat].map(it => `<button type="button" class="item tap-item${it.isOnBring ? " on" : ""}" data-shop="${esc(it.name)}" aria-pressed="${it.isOnBring}"><span>${esc(it.name)}</span><span class="amt">${esc(it.spec)}</span></button>`).join("")}
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
