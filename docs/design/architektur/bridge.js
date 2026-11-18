// Architektur-Übersicht: Brücke Handy ↔ Inspektor (Klicks melden, Screens öffnen, Elemente hervorheben). Wird von tools/build_architektur.mjs eingebaut.
(() => {
  const send = (evt) => {
    try {
      if (window.parent && window.parent.__onPhoneEvent) window.parent.__onPhoneEvent(evt);
    } catch (e) {}
  };

  if (window.BF_STORE) {
    const origSave = window.BF_STORE.save;
    window.BF_STORE.save = function(key, val) {
      const r = origSave.apply(this, arguments);
      send({ type: "store", key, val });
      return r;
    };
  }

  // Expose helper to switch screens/dialogs from the outer architecture navigator
  window.__ARCH_NAV = function(target) {
    // Close any open dialogs or sheets first
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    const ms = document.getElementById("msheet");
    const msc = document.getElementById("mscrim");
    if (ms) ms.classList.remove("show");
    if (msc) msc.classList.remove("show");

    const clickTab = (t) => {
      const b = document.querySelector('.bnav button[data-tab="' + t + '"]');
      if (b) b.click();
    };

    if (target === "plan") {
      clickTab("plan");
    } else if (target === "msheet") {
      clickTab("plan");
      setTimeout(() => {
        const dishBtn = document.querySelector("#days .dish .t");
        if (dishBtn) dishBtn.click();
      }, 40);
    } else if (target === "vote") {
      clickTab("plan");
      setTimeout(() => {
        const vb = document.getElementById("openVoteBtn");
        if (vb) vb.click();
      }, 40);
    } else if (target === "shop") {
      clickTab("shop");
    } else if (target === "compare") {
      clickTab("shop");
      setTimeout(() => {
        const fab = document.getElementById("shopFab");
        if (fab) fab.click();
      }, 60);
    } else if (target === "staples") {
      clickTab("shop");
      setTimeout(() => {
        const sb = document.getElementById("openStaplesBtn");
        if (sb) sb.click();
      }, 60);
    } else if (target === "stapleItem") {
      clickTab("shop");
      setTimeout(() => {
        const sb = document.getElementById("openStaplesBtn");
        if (sb) sb.click();
        setTimeout(() => {
          if (window.BF_APP && window.BF_APP.openItem && window.BF_APP.state.staples.length) {
            window.BF_APP.openItem(0); // app_vorrat.js: Blatt zum Artikel (Index in state.staples)
          } else {
            const tile = document.querySelector("#staplesList [data-staple]");
            if (tile) tile.dispatchEvent(new CustomEvent("contextmenu", { bubbles: true }));
          }
        }, 80);
      }, 60);
    } else if (target === "season") {
      clickTab("season");
    } else if (target === "all") {
      clickTab("season");
      setTimeout(() => {
        const ab = document.getElementById("allRecipesBtn");
        if (ab) ab.click();
      }, 50);
    } else if (target === "recipe") {
      clickTab("season");
      setTimeout(() => {
        const nb = document.getElementById("myRecipeNewBtn");
        if (nb) nb.click();
      }, 50);
    } else if (target === "wg") {
      clickTab("wg");
      setTimeout(() => {
        const more = document.getElementById("setMore");
        if (more) more.open = true;
      }, 50);
    } else if (target === "welcome") {
      if (window.BF_APP && window.BF_APP.openWelcome) window.BF_APP.openWelcome();
      else {
        const wd = document.getElementById("welcomeDialog");
        if (wd && wd.showModal) wd.showModal();
      }
    }
  };

  window.__ARCH_HIGHLIGHT = function(selector) {
    document.querySelectorAll(".xray-pulse").forEach(el => el.classList.remove("xray-pulse"));
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add("xray-pulse");
      try { el.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
      setTimeout(() => el.classList.remove("xray-pulse"), 2400);
    }
  };

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    let screen = null, elKey = null;
    if (t.closest("#openVoteBtn") || t.closest("#setVoteBtn") || t.closest("#wgo")) { screen = "vote"; elKey = "vote-card"; }
    else if (t.closest("#voteDialog")) { screen = "vote"; elKey = "vote-card"; }
    else if (t.closest("#msheet")) { screen = "msheet"; elKey = "msheet-swap"; }
    else if (t.closest("#compareDialog")) { screen = "compare"; elKey = "compare-send"; }
    else if (t.closest("#stapleItemDialog")) { screen = "stapleItem"; elKey = "staple-item-qty"; }
    else if (t.closest("#staplesDialog")) { screen = "staples"; elKey = "staples-tile"; }
    else if (t.closest("#allDialog")) { screen = "all"; elKey = "all-flip"; }
    else if (t.closest("#recipeDialog")) { screen = "recipe"; elKey = "recipe-save"; }
    else if (t.closest("#welcomeDialog")) { screen = "welcome"; elKey = "welcome-join"; }
    else if (t.closest("#weekChip")) { screen = "plan"; elKey = "plan-weekchip"; }
    else if (t.closest(".pday")) { screen = "plan"; elKey = "plan-day"; }
    else if (t.closest(".dish")) { screen = "plan"; elKey = "plan-dish"; }
    else if (t.closest(".who")) { screen = "plan"; elKey = "plan-eaters"; }
    else if (t.closest(".tot")) { screen = "plan"; elKey = "plan-buffer"; }
    else if (t.closest("#syncBtn")) { screen = "plan"; elKey = "plan-bringchip"; }
    else if (t.closest("#shopFab")) { screen = "shop"; elKey = "shop-fab"; }
    else if (t.closest("#openStaplesBtn")) { screen = "staples"; elKey = "staples-tile"; }
    else if (t.closest("#tab-shop .seg")) { screen = "shop"; elKey = "shop-seg"; }
    else if (t.closest("#shopSort")) { screen = "shop"; elKey = "shop-sort"; }
    else if (t.closest("#shopList")) { screen = "shop"; elKey = "shop-row"; }
    else if (t.closest("#allRecipesBtn")) { screen = "all"; elKey = "all-flip"; }
    else if (t.closest("#quickLinkBtn") || t.closest("#myRecipeNewBtn")) { screen = "season"; elKey = "season-link"; }
    else if (t.closest("#fieldGrid") || t.closest("#storageGrid")) { screen = "season"; elKey = "season-veg"; }
    else if (t.closest("#bringListSelect") || t.closest("#bringListField")) { screen = "wg"; elKey = "wg-bringlist"; }
    else if (t.closest("#members") || t.closest("#addMemberForm") || t.closest("#meSelect")) { screen = "wg"; elKey = "wg-members"; }
    else if (t.closest("#calendarBtn") || t.closest("#calendarDlBtn")) { screen = "wg"; elKey = "wg-cal"; }
    else if (t.closest(".bnav")) {
      const b = t.closest("[data-tab]");
      if (b) screen = b.dataset.tab;
    }
    if (screen || elKey) send({ type: "uiClick", screen, elKey });
  }, true);
})();
