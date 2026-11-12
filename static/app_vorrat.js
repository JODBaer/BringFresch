// BringFrisch – Grundvorrat wie in Bring!: Abteilungen und Artikel als Pillen, antippen = auf/von Bring!.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { cleanIngredient, hasWord, bringItemId, state, saveStaples, $, esc, toast, refresh } = app;

  // ---------------------------------------------------------------------------
  // Grundvorrat wie in Bring!: gleiche Abteilungen und Artikel (kleine Pillen).
  // Antippen = auf Bring! (rot), nochmals antippen = wieder weg (nur was der Bot selbst gesetzt hat).
  // ---------------------------------------------------------------------------
  function stapleTarget(st) {
    const name = cleanIngredient(st.name).name;
    return bringItemId(name) || name;
  }
  function onBringNow(name) {
    return state.bringItems.some(n => n.toLowerCase() === String(name).toLowerCase());
  }

  function renderStaples() {
    const order = window.BRING_SECTION_ORDER || [];
    const groups = {};
    state.staples.forEach((st, idx) => {
      const target = stapleTarget(st);
      const known = !!(window.BRING_CATALOG || {})[target];
      const sec = (known && (window.BRING_SECTIONS || {})[target]) || "Eigene Artikel";
      (groups[sec] = groups[sec] || []).push({ st, idx, target, known });
    });
    const rank = sec => (order.indexOf(sec) + 1) || 99;
    const secs = Object.keys(groups).sort((a, b) => rank(a) - rank(b));
    $("staplesList").innerHTML = secs.map(sec => `
      <section class="bsec">
        <h3>${esc(sec)}</h3>
        <div class="btiles">
          ${groups[sec].map(({ st, idx, target, known }) => {
            const red = app.connected() ? onBringNow(target) : st.in_stock === false;
            const label = known ? window.BRING_CATALOG[target] : target;
            const sub = label.toLowerCase() !== cleanIngredient(st.name).name.toLowerCase() ? st.name : "";
            return `<button type="button" class="btile${red ? " on" : ""}" data-staple="${idx}" aria-pressed="${red}" title="${esc(st.name)}">
              <span class="bname">${esc(label)}</span>
            </button>`;
          }).join("")}
        </div>
      </section>`).join("");
    $("staplesHint").textContent = app.connected()
      ? "Antippen = auf eure Bring!-Liste. Nochmals antippen = wieder weg."
      : "Antippen = «leer», kommt beim nächsten «Bring! füllen» mit.";
  }

  $("openStaplesBtn").onclick = () => {
    if (!$("bringNames").children.length) {
      $("bringNames").innerHTML = Object.values(window.BRING_CATALOG || {}).sort().map(n => `<option value="${esc(n)}">`).join("");
    }
    renderStaples();
    $("staplesDialog").showModal();
    if (app.connected()) app.api("/bring/list").then(d => { app.setBringList(d); renderStaples(); refresh(); }).catch(() => {});
  };

  // Einen Artikel auf Bring! setzen oder wieder wegnehmen – jederzeit, auch nach «Bring! füllen».
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

  $("staplesList").addEventListener("click", async e => {
    const b = e.target.closest("[data-staple]");
    if (!b || b.disabled) return;
    const st = state.staples[+b.dataset.staple];
    const target = stapleTarget(st);
    if (!app.connected()) {
      st.in_stock = st.in_stock === false;
      saveStaples();
      renderStaples();
      return refresh();
    }
    b.disabled = true;
    const spec = cleanIngredient(st.name).name.toLowerCase() !== target.toLowerCase() ? st.name : "";
    const r = await toggleOnBring(target, spec);
    if (r === "on") { st.in_stock = false; st.sent = true; }
    if (r === "off") { st.in_stock = true; st.sent = false; }
    saveStaples();
    renderStaples();
    refresh();
  });

  $("addStapleForm").addEventListener("submit", e => {
    e.preventDefault();
    const val = $("newStaple").value.trim();
    if (!val) return;
    state.staples.push({ id: "custom-" + Date.now(), name: val, category: "Eigene", in_stock: true, keywords: [val.toLowerCase()] });
    saveStaples();
    $("newStaple").value = "";
    renderStaples();
    refresh();
  });

  Object.assign(app, { stapleTarget, onBringNow, toggleOnBring, stapleFor });
})();
