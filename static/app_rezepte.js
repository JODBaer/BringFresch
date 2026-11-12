// BringFrisch – Rezepte & Saison: Saisonliste, Rezeptsuche, Katalog (Gericht wählen), eigenes Rezept, Webseiten,
// meine Rezepte, Rezept-Link importieren.
// Teil der App (Aufbau und Namensraum BF_APP: siehe Kopf von app.js).
(() => {
  "use strict";
  const app = window.BF_APP;
  if (!app) return;
  const { DATA, importer, DAYS, MONTHS, DEFAULT_SERVINGS, load, save, SITES_KEY, state, otherPlan, savePlan, $,
    recipeHref, guessMeat, esc, currentMonth, toast, copyText, allRecipes, effectiveDiet, fitsDiet, inSeason,
    pickRecipe, makeDay, DIET_LABEL, refresh } = app;

  // ---------------------------------------------------------------------------
  // Rendering: Saison
  // ---------------------------------------------------------------------------
  function renderSeason(month) {
    const m = parseInt(month, 10);
    const news = (DATA.monthly_news || {})[m] || {};
    $("newsHeadline").textContent = news.headline || `Saison im ${MONTHS[m - 1]}`;
    $("newsTip").textContent = news.farmer_tip || "";
    const items = DATA.season_items || [];
    const field = items.filter(it => (it.field_months || []).includes(m));
    const storage = items.filter(it => !(it.field_months || []).includes(m) && (it.storage_months || []).includes(m));
    const card = it => {
      const [name, sub, emoji] = vegLook(it);
      return `<button type="button" class="card veg" data-veg="${esc(name)}"><span class="vemoji" aria-hidden="true">${emoji}</span><span><b>${esc(name)}</b><small>${esc(sub ? `${sub} · ${it.category}` : it.category)}</small></span></button>`;
    };
    $("fieldGrid").innerHTML = field.map(card).join("") || `<p class="hint">Diesen Monat kein Freilandgemüse.</p>`;
    $("storageGrid").innerHTML = storage.map(card).join("") || `<p class="hint">Keine Lagerware.</p>`;
  }

  // Saisonliste: einfache Namen (Hochdeutsch statt Schweizer Begriffe), Bild als Emoji (läuft offline)
  const VEG_LOOK = {
    "Bärlauch (Wildgemüse)": ["Bärlauch", "Wildgemüse", "🌿"], "Schweizer Grünspargeln": ["Grüner Spargel", "", "🌱"],
    "Schweizer Bleichspargeln": ["Weisser Spargel", "", "🌱"], "Schweizer Rhabarber": ["Rhabarber", "", "🌱"],
    "Radiesli (Radieschen)": ["Radieschen", "", "🔴"], "Kohlrabi": ["Kohlrabi", "", "🥬"], "Schweizer Fenchel": ["Fenchel", "", "🧅"],
    "Schweizer Blumenkohl": ["Blumenkohl", "", "🥦"], "Schweizer Brokkoli": ["Brokkoli", "", "🥦"],
    "Schweizer Zucchini (Courgettes)": ["Zucchini", "", "🥒"], "Schweizer Tomaten (Strauch/Cherry)": ["Tomaten", "Strauch, Cherry", "🍅"],
    "Schweizer Salatgurken": ["Gurken", "", "🥒"], "Schweizer Peperoni (Paprika)": ["Paprika", "", "🫑"],
    "Schweizer Auberginen": ["Auberginen", "", "🍆"], "Schweizer Buschbohnen (Grüne Bohnen)": ["Grüne Bohnen", "", "🫛"],
    "Schweizer Zuckermais": ["Mais", "", "🌽"], "Schweizer Kürbis (Knirps / Butternut)": ["Kürbis", "Butternut, Hokkaido", "🎃"],
    "Schweizer Speiserüebli (Karotten)": ["Karotten", "", "🥕"], "Schweizer Speisekartoffeln (festkochend)": ["Kartoffeln", "festkochend", "🥔"],
    "Schweizer Speisekartoffeln (mehligkochend)": ["Kartoffeln", "mehligkochend", "🥔"], "Schweizer Lauch (Porree)": ["Lauch", "", "🥬"],
    "Schweizer Wirz (Wirsing)": ["Wirsing", "", "🥬"], "Schweizer Weisskabis (Kopfkohl)": ["Weisskohl", "", "🥬"],
    "Schweizer Rotkabis (Rotkohl)": ["Rotkohl", "", "🟣"], "Schweizer Federkohl (Grünkohl / Kale)": ["Grünkohl", "Kale", "🥬"],
    "Schweizer Randen (Rote Bete)": ["Rote Bete", "", "🟣"], "Schweizer Pastinaken": ["Pastinaken", "", "🥕"],
    "Schweizer Knollensellerie": ["Sellerie", "Knolle", "🥔"], "Schweizer Chicorée": ["Chicorée", "", "🥬"],
    "Schweizer Nüsslisalat (Feldsalat)": ["Feldsalat", "", "🥗"], "Schweizer Blattspinat": ["Spinat", "", "🥬"],
    "Schweizer Speisezwiebeln (Gelb & Rot)": ["Zwiebeln", "gelb, rot", "🧅"], "Schweizer Bergkäse / Gruyère / Emmentaler": ["Bergkäse", "Gruyère, Emmentaler", "🧀"],
    "Schweizer Magerquark / Kräuterquark": ["Quark", "", "🥛"], "Schweizer Butter / Bratbutter": ["Butter", "", "🧈"],
  };
  const CAT_EMOJI = { Wurzelgemüse: "🥕", Kohl: "🥬", Kohlgemüse: "🥦", Salat: "🥗", Milchprodukt: "🧀", Fruchtgemüse: "🍅", Zwiebelgemüse: "🧅" };
  function vegLook(it) {
    if (VEG_LOOK[it.name]) return VEG_LOOK[it.name];
    const base = it.name.replace(/^Schweizer\s+/i, ""), m = base.match(/^(.*?)\s*\((.*)\)$/);
    return [m ? m[1] : base, m ? m[2] : "", CAT_EMOJI[it.category] || "🥬"];
  }

  // Gemüse antippen: «Spinat Rezept» kopieren und ins Suchfeld oben -> ergänzen (z.B. «Risotto») und suchen
  const searchUrl = q => `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;
  function setRecipeSearch(q) {
    $("recipeSearchQ").value = q;
    $("recipeSearchGo").href = searchUrl(q || "Rezept");
  }
  $("recipeSearchQ").addEventListener("input", () => setRecipeSearch($("recipeSearchQ").value));
  $("recipeSearchQ").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("recipeSearchGo").click(); } });
  for (const id of ["fieldGrid", "storageGrid"]) {
    $(id).addEventListener("click", async e => {
      const b = e.target.closest("[data-veg]");
      if (!b) return;
      const q = `${b.dataset.veg} Rezept `;
      setRecipeSearch(q);
      await copyText(q.trim());
      const inp = $("recipeSearchQ");
      if (inp.scrollIntoView) inp.scrollIntoView({ block: "center", behavior: "smooth" });
      inp.focus({ preventScroll: true });
      try { inp.setSelectionRange(q.length, q.length); } catch (err) { /* ältere Browser */ }
      toast(`«${q.trim()}» kopiert – ergänzen (z.B. Risotto) und suchen`);
    });
  }

  function setupSeason() {
    const sel = $("monthSelect");
    sel.innerHTML = MONTHS.map((name, i) => `<option value="${i + 1}">${name}</option>`).join("");
    sel.value = String(currentMonth());
    sel.onchange = () => renderSeason(sel.value);
    renderSeason(sel.value);
  }


  // ---------------------------------------------------------------------------
  // Menü-Katalog
  // ---------------------------------------------------------------------------
  function assignRecipe(recipe, dayIdx) {
    state.plan[dayIdx] = makeDay(recipe, dayIdx, state.plan[dayIdx]);
    savePlan();
    refresh();
  }

  // Katalog dient zwei Zwecken: Gericht für einen Tag wählen ("day") oder zur Wochenwahl hinzufügen ("vote")
  function openCatalog(dayIdx) {
    state.catalogDay = dayIdx;
    const forVote = state.catalogMode === "vote";
    $("catalogSubtitle").textContent = forVote
      ? "Gericht zur Wochenwahl hinzufügen"
      : `für ${DAYS[dayIdx]} · ${state.plan[dayIdx].eaters.length} Esser`;
    $("randomPickBtn").hidden = forVote;
    $("catalogSearch").value = "";
    renderCatalog();
    $("catalogDialog").showModal();
  }

  function renderCatalog() {
    const q = $("catalogSearch").value.toLowerCase().trim();
    const f = state.catalogFilter;
    document.querySelectorAll("#catalogFilters button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
    const list = allRecipes().filter(r => {
      if (f === "vegi" && !fitsDiet(r, "vegi")) return false;
      if (f === "fleisch" && r.diet !== "fleisch") return false;
      if (f === "season" && !inSeason(r)) return false;
      if (f === "custom" && !r.is_custom && !String(r.id).startsWith("custom-")) return false;
      if (f === "shared" && !r.shared_from) return false;
      if (q) {
        const hay = [r.title, ...(r.ingredients || []).map(i => i.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const actionLabel = state.catalogMode === "vote" ? "Zur Wochenwahl" : `Für ${DAYS[state.catalogDay].slice(0, 2)} einplanen`;
    $("catalogList").innerHTML = list.length === 0
      ? `<div class="empty">Keine Rezepte gefunden.</div>`
      : list.map(r => {
        const custom = r.is_custom || String(r.id).startsWith("custom-");
        return `
        <div class="card recipe">
          <div class="recipe-head">
            <div>
              <b>${esc(r.title)}</b>
              <small>${DIET_LABEL[r.diet] || "Vegi"} · ${r.servings || DEFAULT_SERVINGS} Port. · ${r.prep_time_min || 30} Min.${inSeason(r) ? "" : " · nicht Saison"}${r.shared_from ? " · geteilt" : custom && r.shared === false ? " · nur unsere WG" : ""}</small>
            </div>
            ${recipeHref(r) ? `<a class="pill" href="${esc(recipeHref(r))}" target="_blank" rel="noopener">${r.source_url ? "🌐 Rezept" : "🔎 Rezept suchen"}</a>` : ""}
          </div>
          <div class="row">
            <button class="btn dark" type="button" data-assign="${esc(r.id)}">${actionLabel}</button>
            <button class="btn" type="button" data-edit="${esc(r.id)}" style="flex:0 0 auto">${custom ? "Bearbeiten" : "Anpassen"}</button>
            ${custom ? `<button class="btn" type="button" data-delete="${esc(r.id)}" style="flex:0 0 auto">Löschen</button>` : ""}
          </div>
        </div>`;
      }).join("");
  }

  $("catalogSearch").oninput = renderCatalog;
  $("catalogFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.catalogFilter = b.dataset.filter;
    renderCatalog();
  });

  $("catalogList").addEventListener("click", e => {
    const assign = e.target.closest("[data-assign]");
    if (assign) {
      const recipe = allRecipes().find(r => String(r.id) === assign.dataset.assign);
      if (!recipe) return;
      const mode = state.catalogMode;
      state.catalogMode = "day";
      $("catalogDialog").close();
      useRecipe(recipe, mode);
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) {
      const recipe = allRecipes().find(r => String(r.id) === ed.dataset.edit);
      if (!recipe) return;
      const custom = recipe.is_custom || String(recipe.id).startsWith("custom-");
      return openRecipeForm(null, custom ? { edit: recipe } : { copyOf: recipe });
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      if (del.dataset.armed !== "1") {
        del.dataset.armed = "1";
        del.textContent = "Wirklich?";
        return;
      }
      importer.deleteCustomRecipe(del.dataset.delete);
      renderCatalog();
      renderMyRecipes();
      app.settingsChanged();
      toast("Rezept gelöscht");
    }
  });

  function useRecipe(recipe, mode) {
    if (mode === "vote") {
      const id = String(recipe.id);
      if (!state.vote.candidates.includes(id)) state.vote.candidates.push(id);
      app.saveVote();
      app.pushCandidates();
      app.renderVote();
      $("voteDialog").showModal();
      toast(`${recipe.title} ist in der Wochenwahl`);
      return;
    }
    assignRecipe(recipe, state.catalogDay);
    app.countDish(recipe.id);
    toast(`${DAYS[state.catalogDay]}: ${recipe.title}`);
  }

  // Schliessen ohne Auswahl: im Wochenwahl-Modus zurück zur Wochenwahl
  $("catalogDialog").addEventListener("close", () => {
    if (state.catalogMode === "vote" && !$("recipeDialog").open) {
      state.catalogMode = "day";
      app.renderVote();
      $("voteDialog").showModal();
    }
  });

  $("randomPickBtn").onclick = () => {
    const idx = state.catalogDay;
    const current = state.plan[idx];
    const recipe = pickRecipe(effectiveDiet(current.eaters), state.plan.map(d => d.id));
    assignRecipe(recipe, idx);
    $("catalogDialog").close();
    toast(`${DAYS[idx]}: ${recipe.title}`);
  };

  // ---------------------------------------------------------------------------
  // Eigenes Rezept
  // ---------------------------------------------------------------------------
  // edit: eigenes Rezept bearbeiten · copyOf: Katalog-Rezept als eigene Kopie anpassen (z.B. Personen)
  let editingId = null;
  function openRecipeForm(link, { edit = null, copyOf = null } = {}) {
    $("recipeForm").reset();
    lastFetched = "";
    editingId = edit ? edit.id : null;
    const base = edit || copyOf;
    $("recipeFormTitle").textContent = edit ? "Rezept bearbeiten" : copyOf ? "Rezept anpassen (eigene Kopie)" : "Eigenes Rezept";
    $("recipeSubmitBtn").textContent = state.catalogMode === "save" ? "Speichern" : "Speichern & einplanen";
    $("recipeServingsHint").textContent = "Die Zutaten unten gelten für so viele Personen; BringFrisch rechnet dann für eure Esser um.";
    $("recipeServings").value = base ? base.servings || DEFAULT_SERVINGS : DEFAULT_SERVINGS;
    if (base) {
      $("recipeTitle").value = base.title || "";
      $("recipeUrl").value = base.source_url || "";
      lastFetched = base.source_url || "";
      $("recipeDiet").value = base.diet || "vegi";
      $("recipeIngredients").value = importer.ingredientsToText(base.ingredients);
      $("recipeInstructions").value = base.instructions || "";
    }
    $("recipeShared").checked = !(edit && edit.shared === false); // Standard: geteilt
    $("recipeDialog").showModal();
    $("catalogDialog").close();
    if (link) { $("recipeUrl").value = link; fetchRecipeLink(true); }
  }
  $("newRecipeBtn").onclick = () => openRecipeForm();

  $("recipeDialog").addEventListener("close", () => {
    editingId = null;
    if (state.catalogMode === "save") state.catalogMode = "day";
    if (state.catalogMode === "vote") {
      state.catalogMode = "day";
      app.renderVote();
      $("voteDialog").showModal();
    }
  });

  // Link: erster https-Link aus beliebigem Text («Schau mal: https://… 😋» aus dem Teilen-Menü)
  const linkIn = text => { const m = String(text || "").match(/https?:\/\/[^\s<>"']+/); return m ? m[0].replace(/[),.!?]+$/, "") : ""; };
  let lastFetched = "";
  async function fetchRecipeLink(force) {
    const link = linkIn($("recipeUrl").value);
    if (!link) { if (force) toast("Kein Link gefunden – bitte https://… einfügen"); return; }
    if (link === lastFetched && !force) return;
    lastFetched = link;
    $("recipeUrl").value = link;
    if (await importFromLink(link)) return;
    const title = $("recipeTitle");
    if (!title.value.trim()) title.value = importer.analyzeRecipeUrl(link).title;
  }
  $("recipeUrl").addEventListener("change", () => fetchRecipeLink(false));
  $("recipeUrl").addEventListener("paste", () => setTimeout(() => fetchRecipeLink(false), 0));
  $("recipeFetchBtn").onclick = () => fetchRecipeLink(true);

  $("recipeForm").addEventListener("submit", e => {
    e.preventDefault();
    const fields = {
      title: $("recipeTitle").value,
      url: linkIn($("recipeUrl").value),
      diet: $("recipeDiet").value,
      servings: $("recipeServings").value,
      ingredientsText: $("recipeIngredients").value,
      instructions: $("recipeInstructions").value,
      shared: $("recipeShared").checked
    };
    const recipe = editingId ? importer.updateCustomRecipe(editingId, fields) : importer.createCustomRecipe(fields);
    const mode = state.catalogMode;
    state.catalogMode = "day";
    editingId = null;
    $("recipeDialog").close();
    if (!recipe) return;
    // geänderte Rezepte gelten sofort auch in Plan und Einkaufsliste
    let touched = false;
    for (const plan of [state.plan, otherPlan()]) {
      (plan || []).forEach((d, i) => { if (d && String(d.id) === String(recipe.id)) { plan[i] = makeDay(recipe, i, d); touched = true; } });
    }
    if (touched) { savePlan(); refresh(); }
    renderMyRecipes();
    app.settingsChanged();
    if (mode === "save") return toast(`${recipe.title} gespeichert`);
    useRecipe(recipe, mode);
  });

  // Rezepte-Tab: Webseiten zum Stöbern (eigene dazu), Link einfügen, meine Rezepte
  const DEFAULT_SITES = [
    ["Betty Bossi", "https://www.bettybossi.ch/de/rezepte/"],
    ["Swissmilk", "https://www.swissmilk.ch/de/rezepte-kochideen/"],
    ["Fooby", "https://fooby.ch/de/rezepte.html"],
    ["Migusto", "https://migusto.migros.ch/de/rezepte"],
    ["Chefkoch", "https://www.chefkoch.de/"],
  ];
  state.mySites = load(SITES_KEY, []) || [];
  function renderSites() {
    $("recipeSites").innerHTML = DEFAULT_SITES.map(([n, u]) => `<a class="btile" href="${esc(u)}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join("")
      + state.mySites.map((x, i) => `<span class="btile"><a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(x.name)} ↗</a><button type="button" class="x" data-site-del="${i}" aria-label="${esc(x.name)} entfernen">✕</button></span>`).join("")
      + `<button type="button" class="btile" id="siteAddBtn">+ Webseite</button>`;
  }
  $("recipeSites").addEventListener("click", e => {
    if (e.target.closest("#siteAddBtn")) { $("siteForm").hidden = !$("siteForm").hidden; if (!$("siteForm").hidden) $("siteName").focus(); return; }
    const del = e.target.closest("[data-site-del]");
    if (del) { state.mySites.splice(+del.dataset.siteDel, 1); save(SITES_KEY, state.mySites); renderSites(); app.settingsChanged(); }
  });
  $("siteForm").addEventListener("submit", e => {
    e.preventDefault();
    let url = linkIn($("siteUrl").value) || ($("siteUrl").value.trim() ? "https://" + $("siteUrl").value.trim().replace(/^\/+/, "") : "");
    const name = $("siteName").value.trim();
    if (!name || !url) return;
    state.mySites.push({ name, url });
    save(SITES_KEY, state.mySites);
    app.settingsChanged();
    $("siteForm").reset();
    $("siteForm").hidden = true;
    renderSites();
    toast(`${name} hinzugefügt`);
  });
  function quickImport() {
    const link = linkIn($("quickLink").value);
    if (!link) return toast("Kein Link gefunden – bitte https://… einfügen");
    $("quickLink").value = "";
    state.catalogMode = "save";
    openRecipeForm(link);
  }
  $("quickLinkBtn").onclick = quickImport;
  $("quickLink").addEventListener("paste", () => setTimeout(() => { if (linkIn($("quickLink").value)) quickImport(); }, 0));
  $("myRecipeNewBtn").onclick = () => { state.catalogMode = "save"; openRecipeForm(); };
  function renderMyRecipes() {
    const list = importer.customRecipes;
    $("myRecipesCount").textContent = list.length ? String(list.length) : "";
    $("myRecipes").innerHTML = list.length
      ? list.map(r => `<div class="myrec"><span><b>${esc(r.title)}</b><small>${DIET_LABEL[r.diet] || "Vegi"} · für ${r.servings || DEFAULT_SERVINGS} Personen · ${(r.ingredients || []).length} Zutaten</small></span>${r.source_url ? `<a class="pill" href="${esc(r.source_url)}" target="_blank" rel="noopener">🌐</a>` : ""}<button class="btn" type="button" data-my-edit="${esc(r.id)}">Bearbeiten</button><button class="btn" type="button" data-my-del="${esc(r.id)}">Löschen</button></div>`).join("")
      : `<div class="empty">Noch keine eigenen Rezepte – Link oben einfügen oder von Hand.</div>`;
  }
  $("myRecipes").addEventListener("click", e => {
    const ed = e.target.closest("[data-my-edit]");
    if (ed) { const r = importer.customRecipes.find(x => x.id === ed.dataset.myEdit); if (r) { state.catalogMode = "save"; openRecipeForm(null, { edit: r }); } return; }
    const del = e.target.closest("[data-my-del]");
    if (del) {
      if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Wirklich?"; return; }
      importer.deleteCustomRecipe(del.dataset.myDel);
      renderMyRecipes();
      app.settingsChanged();
      toast("Rezept gelöscht");
    }
  });
  renderSites();
  renderMyRecipes();

  // Rezept-Link: Zutaten und Portionen direkt von der Rezeptseite holen
  async function importFromLink(link) {
    if (!link) return false;
    if (!app.connected()) {
      toast("Zutaten holen braucht den WG-Server (Einstellungen → Mehr → WG-PIN). Sonst Zutaten unten einfügen.");
      return false;
    }
    try {
      const r = await app.api(`/recipe?url=${encodeURIComponent(link)}`);
      if (!$("recipeTitle").value.trim()) $("recipeTitle").value = r.title || "";
      $("recipeServings").value = r.servings || DEFAULT_SERVINGS;
      $("recipeServingsHint").textContent = `Laut Webseite für ${r.servings || DEFAULT_SERVINGS} Personen – anpassen, falls es nicht stimmt.`;
      if (!$("recipeIngredients").value.trim()) $("recipeIngredients").value = (r.ingredients || []).join("\n");
      // Fleisch oder Fisch im Titel/den Zutaten -> «Fleisch» vorwählen (sonst steht z.B. «Wirzwickel mit Hackfleisch» als Vegi da)
      const meat = guessMeat(`${$("recipeTitle").value}\n${$("recipeIngredients").value}`);
      if (meat && $("recipeDiet").value !== "fleisch") $("recipeDiet").value = "fleisch";
      toast(`${(r.ingredients || []).length} Zutaten übernommen${meat ? " · als Fleisch erkannt" : ""}`);
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  }

  Object.assign(app, { setupSeason, openCatalog, openRecipeForm, linkIn, renderSites, renderMyRecipes, renderCatalog });
})();
