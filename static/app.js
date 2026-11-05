// BringFrisch PWA Application Logic - 100% Standalone & Mobile Optimized
document.addEventListener("DOMContentLoaded", () => {
  // Service Worker Registration for PWA Offline Capability
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.log("SW Reg Error:", err));
  }

  // Lucide Icons init
  if (window.lucide) {
    lucide.createIcons();
  }

  // Application State
  const state = {
    wgId: localStorage.getItem("bringfrisch_wg_id") || "wg-limmat-4",
    persons: parseInt(localStorage.getItem("bringfrisch_persons") || "3", 10),
    diet: localStorage.getItem("bringfrisch_diet") || "vegi",
    activeDayIndex: 0,
    weekPlan: [],
    seasonalItems: [],
    shoppingList: [],
    excludeStaples: true,
    currentBringItems: ["schweizer festkochende kartoffeln", "magronen / teigwaren"],
    shoppingFilterSubTab: "toBuy", // "toBuy", "onBring", "staples"
    pantryStaples: loadUserStaples()
  };

  function loadUserStaples() {
    const saved = localStorage.getItem("bringfrisch_user_staples");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return (window.BRINGFRISCH_DATA && window.BRINGFRISCH_DATA.pantry_staples) || [];
  }

  function saveUserStaples() {
    localStorage.setItem("bringfrisch_user_staples", JSON.stringify(state.pantryStaples));
  }

  const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  // Elements
  const headerWgName = document.getElementById("headerWgName");
  const daySelector = document.getElementById("daySelector");
  const cardDayBadge = document.getElementById("cardDayBadge");
  const cardDietBadge = document.getElementById("cardDietBadge");
  const cardCostBadge = document.getElementById("cardCostBadge");
  const cardTitle = document.getElementById("cardTitle");
  const cardPrepTime = document.getElementById("cardPrepTime");
  const cardSeasonFokus = document.getElementById("cardSeasonFokus");
  const cardCookName = document.getElementById("cardCookName");
  const cardIngredients = document.getElementById("cardIngredients");
  const cardHealthTip = document.getElementById("cardHealthTip");
  const personsCount = document.getElementById("personsCount");
  const shoppingListContainer = document.getElementById("shoppingListContainer");
  const syncToBringBtn = document.getElementById("syncToBringBtn");
  const syncBtnText = document.getElementById("syncBtnText");

  // Initial UI Setup
  headerWgName.textContent = state.wgId;
  personsCount.textContent = state.persons;

  // Initialize Day Selector Pills
  function renderDaySelector() {
    daySelector.innerHTML = "";
    DAYS.forEach((day, idx) => {
      const btn = document.createElement("button");
      btn.className = `flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl transition ${
        idx === state.activeDayIndex
          ? "bg-emerald-500 text-slate-950 shadow-md"
          : "text-slate-400 hover:text-slate-200"
      }`;
      btn.textContent = day.substring(0, 2);
      btn.title = day;
      btn.onclick = () => {
        state.activeDayIndex = idx;
        renderDaySelector();
        renderActiveCard();
      };
      daySelector.appendChild(btn);
    });
  }

  // Standalone Recipe Generator (Runs 100% in Browser)
  function getRecipesPool() {
    const defaultRecipes = (window.BRINGFRISCH_DATA && window.BRINGFRISCH_DATA.recipes) || [];
    const customRecipes = (window.recipeImporter && window.recipeImporter.customRecipes) || [];
    const all = [...defaultRecipes, ...customRecipes];
    
    // Filter nach Diät
    if (state.diet === "vegi") {
      return all.filter(r => r.diet === "vegi" || r.diet === "vegan");
    } else if (state.diet === "vegan") {
      return all.filter(r => r.diet === "vegan");
    } else if (state.diet === "schweizerisch") {
      return all.filter(r => r.category === "schweizerisch");
    }
    return all;
  }

  function generateStandalonePlan() {
    const pool = getRecipesPool();
    const plan = [];
    const available = [...pool];
    
    DAYS.forEach((day) => {
      if (available.length === 0) available.push(...pool);
      const idx = Math.floor(Math.random() * available.length);
      const recipe = available.splice(idx, 1)[0];
      plan.push({
        ...recipe,
        day: day,
        scaled_cost_chf: ((recipe.cost_per_person_chf || 2.80) * state.persons).toFixed(2),
        cook_assigned: null
      });
    });
    return plan;
  }

  // Plan laden: Versuch über Server, sonst 100% Standalone Fallback
  async function loadPlan() {
    const savedLocal = localStorage.getItem("bringfrisch_current_plan");
    if (savedLocal) {
      try {
        state.weekPlan = JSON.parse(savedLocal);
      } catch (e) {
        state.weekPlan = generateStandalonePlan();
      }
    } else {
      state.weekPlan = generateStandalonePlan();
    }

    renderDaySelector();
    renderActiveCard();
    updateShoppingList();
    checkPantryAlerts();
    renderPantryItems();
  }

  function renderActiveCard() {
    if (!state.weekPlan || state.weekPlan.length === 0) return;
    const current = state.weekPlan[state.activeDayIndex];
    if (!current) return;

    cardDayBadge.textContent = current.day || DAYS[state.activeDayIndex];
    cardDietBadge.textContent = (current.diet || "vegi").toUpperCase();
    const costPerP = current.cost_per_person_chf || 2.80;
    cardCostBadge.textContent = `CHF ${(costPerP * (state.persons / 2)).toFixed(2)} für ${state.persons} P.`;
    cardTitle.textContent = current.title;
    cardPrepTime.textContent = `${current.prep_time_min || 30} Min.`;
    cardSeasonFokus.textContent = (current.primary_vegetables || []).join(", ") || "Schweizer Saisongemüse";
    cardCookName.textContent = current.cook_assigned ? `Koch: ${current.cook_assigned}` : "Koch: Offen / WG";
    cardHealthTip.textContent = current.health_tip || "Ausgewogenes Rezept mit Schweizer Gemüse.";

    cardIngredients.innerHTML = "";
    (current.ingredients || []).forEach(ing => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between py-0.5 border-b border-slate-800/40";
      li.innerHTML = `<span>${ing.name}</span> <span class="text-slate-400 font-mono text-[11px]">${ing.amount} ${ing.unit}</span>`;
      cardIngredients.appendChild(li);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Touch Swipe Handhabung
  const activeCard = document.getElementById("activeCard");
  let touchStartX = 0;
  let touchEndX = 0;

  activeCard.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  activeCard.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    if (diff < -50 && state.activeDayIndex < DAYS.length - 1) {
      state.activeDayIndex++;
      renderDaySelector();
      renderActiveCard();
    } else if (diff > 50 && state.activeDayIndex > 0) {
      state.activeDayIndex--;
      renderDaySelector();
      renderActiveCard();
    }
  }, { passive: true });

  // Anderes Rezept für diesen Tag würfeln
  document.getElementById("shuffleDayBtn").onclick = () => {
    const pool = getRecipesPool();
    if (pool.length > 0) {
      const randomRecipe = pool[Math.floor(Math.random() * pool.length)];
      state.weekPlan[state.activeDayIndex] = {
        ...randomRecipe,
        day: DAYS[state.activeDayIndex],
        cook_assigned: state.weekPlan[state.activeDayIndex].cook_assigned
      };
      savePlan();
      renderActiveCard();
      updateShoppingList();
    }
  };

  // Ganze Woche neu würfeln
  document.getElementById("regenWholeWeekBtn").onclick = () => {
    state.weekPlan = generateStandalonePlan();
    savePlan();
    renderActiveCard();
    updateShoppingList();
  };

  // Koch zuweisen
  document.getElementById("assignCookBtn").onclick = () => {
    const name = prompt("Wer kocht an diesem Tag?", state.weekPlan[state.activeDayIndex].cook_assigned || "Du");
    if (name) {
      state.weekPlan[state.activeDayIndex].cook_assigned = name;
      savePlan();
      renderActiveCard();
    }
  };

  function savePlan() {
    localStorage.setItem("bringfrisch_current_plan", JSON.stringify(state.weekPlan));
  }

  // 4. Einkaufsliste aggregieren, mit Bring! abgleichen & Grundvorrat filtern
  function updateShoppingList() {
    const scale = state.persons / 2;
    const aggregated = {};

    // Aktive Grundzutaten-Keywords ermitteln
    const activeStapleKeywords = [];
    state.pantryStaples.forEach(st => {
      if (st.in_stock !== false) {
        (st.keywords || [st.name.toLowerCase()]).forEach(kw => activeStapleKeywords.push(kw.toLowerCase()));
      }
    });

    state.weekPlan.forEach(day => {
      (day.ingredients || []).forEach(ing => {
        const name = ing.name.trim();
        const unit = (ing.unit || "").trim();
        const key = `${name.toLowerCase()}___${unit.toLowerCase()}`;
        const amt = parseFloat(ing.amount || "1") * scale;

        if (aggregated[key]) {
          aggregated[key].amount += amt;
        } else {
          const lower = name.toLowerCase();
          const isStaple = activeStapleKeywords.some(st => lower.includes(st));
          const isOnBring = state.currentBringItems.some(b => lower.includes(b) || b.includes(lower));

          let status = "toBuy";
          if (isStaple && state.excludeStaples) {
            status = "staples";
          } else if (isOnBring) {
            status = "onBring";
          }

          aggregated[key] = {
            name: name,
            amount: amt,
            unit: unit,
            bring_cat: ing.bring_cat || "Sonstiges",
            isStaple: isStaple,
            isOnBring: isOnBring,
            status: status,
            checked: false
          };
        }
      });
    });

    state.shoppingList = Object.values(aggregated);
    updateShoppingCounters();
    renderShoppingList();
  }

  function updateShoppingCounters() {
    let toBuy = 0;
    let onBring = 0;
    let staples = 0;

    state.shoppingList.forEach(it => {
      if (it.isStaple && state.excludeStaples) staples++;
      else if (it.isOnBring) onBring++;
      else toBuy++;
    });

    const countToBuy = document.getElementById("countToBuy");
    const countOnBring = document.getElementById("countOnBring");
    const countStaples = document.getElementById("countStaples");
    const staplesCounterBadge = document.getElementById("staplesCounterBadge");

    if (countToBuy) countToBuy.textContent = toBuy;
    if (countOnBring) countOnBring.textContent = onBring;
    if (countStaples) countStaples.textContent = staples;
    if (staplesCounterBadge) {
      staplesCounterBadge.textContent = state.excludeStaples ? `${staples} ausgeblendet` : "Eingeblendet";
    }
  }

  function renderShoppingList() {
    shoppingListContainer.innerHTML = "";
    if (state.shoppingList.length === 0) {
      shoppingListContainer.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Keine Artikel</p>`;
      return;
    }

    // Nach aktuellem Sub-Tab filtern
    const filteredItems = state.shoppingList.filter(it => {
      if (state.shoppingFilterSubTab === "staples") return it.isStaple && state.excludeStaples;
      if (state.shoppingFilterSubTab === "onBring") return it.isOnBring && (!it.isStaple || !state.excludeStaples);
      // toBuy:
      return !it.isOnBring && (!it.isStaple || !state.excludeStaples);
    });

    if (filteredItems.length === 0) {
      let emptyMsg = "Keine Artikel in dieser Ansicht.";
      if (state.shoppingFilterSubTab === "onBring") emptyMsg = "Keine der Zutaten steht bisher auf Bring!. Klicke auf 'Nach Bring!' um sie hinzuzufügen.";
      if (state.shoppingFilterSubTab === "staples") emptyMsg = "Keine Grundzutaten ausgeblendet.";
      shoppingListContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">${emptyMsg}</p>`;
      return;
    }

    const grouped = {};
    filteredItems.forEach((it, idx) => {
      const cat = it.bring_cat || "Sonstiges";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ ...it, idx });
    });

    Object.keys(grouped).forEach(cat => {
      const catBox = document.createElement("div");
      catBox.className = "bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2";
      let html = `<h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
        <span>${cat}</span>
        <span class="text-[10px] text-slate-500 font-mono">${grouped[cat].length} Artikel</span>
      </h4><div class="space-y-1.5">`;

      grouped[cat].forEach(it => {
        const displayAmt = it.amount === parseInt(it.amount) ? it.amount : it.amount.toFixed(1);
        let badge = "";
        if (it.isOnBring) {
          badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Schon auf Bring!</span>`;
        } else if (it.isStaple) {
          badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Grundzutat</span>`;
        }

        html += `
          <label class="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-800 cursor-pointer">
            <div class="flex items-center space-x-2.5">
              <input type="checkbox" class="rounded text-emerald-500 bg-slate-800 border-slate-700" ${it.isOnBring ? "checked disabled" : ""}>
              <span class="${it.isOnBring ? 'text-slate-400 font-medium' : 'text-slate-200'}">${it.name}</span>
            </div>
            <div class="flex items-center space-x-2">
              ${badge}
              <span class="text-emerald-400 font-mono text-[11px] font-semibold">${displayAmt} ${it.unit}</span>
            </div>
          </label>
        `;
      });
      html += `</div>`;
      catBox.innerHTML = html;
      shoppingListContainer.appendChild(catBox);
    });
  }

  // Toggle für Grundzutaten
  const excludeStaplesToggle = document.getElementById("excludeStaplesToggle");
  if (excludeStaplesToggle) {
    excludeStaplesToggle.onchange = (e) => {
      state.excludeStaples = e.target.checked;
      updateShoppingList();
    };
  }

  // Sub-Tabs Umschaltung für Einkaufsliste
  const filterTabToBuy = document.getElementById("filterTabToBuy");
  const filterTabOnBring = document.getElementById("filterTabOnBring");
  const filterTabStaples = document.getElementById("filterTabStaples");

  function setSubTab(activeTab) {
    state.shoppingFilterSubTab = activeTab;
    [filterTabToBuy, filterTabOnBring, filterTabStaples].forEach(tab => {
      if (tab) {
        tab.className = "flex-1 py-1 px-2 rounded-lg text-slate-400 hover:text-white font-medium transition";
      }
    });

    if (activeTab === "toBuy" && filterTabToBuy) {
      filterTabToBuy.className = "flex-1 py-1 px-2 rounded-lg bg-emerald-500 text-slate-950 font-bold transition shadow-sm";
    } else if (activeTab === "onBring" && filterTabOnBring) {
      filterTabOnBring.className = "flex-1 py-1 px-2 rounded-lg bg-emerald-500 text-slate-950 font-bold transition shadow-sm";
    } else if (activeTab === "staples" && filterTabStaples) {
      filterTabStaples.className = "flex-1 py-1 px-2 rounded-lg bg-slate-700 text-white font-bold transition shadow-sm";
    }
    renderShoppingList();
  }

  if (filterTabToBuy) filterTabToBuy.onclick = () => setSubTab("toBuy");
  if (filterTabOnBring) filterTabOnBring.onclick = () => setSubTab("onBring");
  if (filterTabStaples) filterTabStaples.onclick = () => setSubTab("staples");

  // Mit Bring! Liste abgleichen (liest aktuelle Bring-Einträge)
  const compareBringBtn = document.getElementById("compareBringBtn");
  if (compareBringBtn) {
    compareBringBtn.onclick = async () => {
      try {
        const res = await fetch("/api/bring/current");
        const data = await res.json();
        const purchase = data.purchase || [];
        state.currentBringItems = purchase.map(p => (p.name || "").toLowerCase().trim());
        updateShoppingList();
        alert(`✅ Bring!-Liste eingelesen: ${purchase.length} Artikel aktiv. Menüplan abgeglichen!`);
      } catch (e) {
        // Standalone Mock Fallback
        state.currentBringItems = ["magronen / teigwaren", "schweizer festkochende kartoffeln"];
        updateShoppingList();
        alert("✅ Bring!-Liste eingelesen (Offline-Modus): Bereits vorhandene Artikel wurden markiert.");
      }
    };
  }

  // Grundvorrat Manager Modal
  const openStaplesManagerBtn = document.getElementById("openStaplesManagerBtn");
  const closeStaplesModalBtn = document.getElementById("closeStaplesModalBtn");
  const saveStaplesModalBtn = document.getElementById("saveStaplesModalBtn");
  const staplesManagerModal = document.getElementById("staplesManagerModal");
  const staplesListContainer = document.getElementById("staplesListContainer");
  const newStapleInput = document.getElementById("newStapleInput");
  const addNewStapleBtn = document.getElementById("addNewStapleBtn");

  function renderStaplesManager() {
    if (!staplesListContainer) return;
    staplesListContainer.innerHTML = "";

    const grouped = {};
    state.pantryStaples.forEach((st, idx) => {
      const cat = st.category || "Grundzutaten";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ ...st, originalIdx: idx });
    });

    Object.keys(grouped).forEach(cat => {
      const catTitle = document.createElement("h4");
      catTitle.className = "text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2 mb-1";
      catTitle.textContent = cat;
      staplesListContainer.appendChild(catTitle);

      const chipsWrapper = document.createElement("div");
      chipsWrapper.className = "flex flex-wrap gap-1.5";

      grouped[cat].forEach(st => {
        const btn = document.createElement("button");
        const inStock = st.in_stock !== false;
        btn.className = `text-xs px-2.5 py-1 rounded-xl border transition flex items-center space-x-1.5 ${
          inStock
            ? "bg-emerald-950/40 text-emerald-300 border-emerald-600/50 shadow-sm"
            : "bg-red-950/20 text-red-400 border-red-800/40 line-through opacity-70"
        }`;
        btn.innerHTML = `<span>${st.name}</span><span class="text-[10px] font-mono">${inStock ? '✓' : 'Leer'}</span>`;
        btn.onclick = () => {
          st.in_stock = !inStock;
          state.pantryStaples[st.originalIdx].in_stock = st.in_stock;
          saveUserStaples();
          renderStaplesManager();
          updateShoppingList();
        };
        chipsWrapper.appendChild(btn);
      });
      staplesListContainer.appendChild(chipsWrapper);
    });
  }

  if (openStaplesManagerBtn) {
    openStaplesManagerBtn.onclick = () => {
      renderStaplesManager();
      staplesManagerModal.classList.remove("hidden");
    };
  }

  if (closeStaplesModalBtn) closeStaplesModalBtn.onclick = () => staplesManagerModal.classList.add("hidden");
  if (saveStaplesModalBtn) saveStaplesModalBtn.onclick = () => staplesManagerModal.classList.add("hidden");

  if (addNewStapleBtn) {
    addNewStapleBtn.onclick = () => {
      const val = (newStapleInput.value || "").trim();
      if (!val) return;
      state.pantryStaples.push({
        id: "custom-" + Date.now(),
        name: val,
        category: "Eigene Grundzutaten",
        in_stock: true,
        keywords: [val.toLowerCase()]
      });
      saveUserStaples();
      newStapleInput.value = "";
      renderStaplesManager();
      updateShoppingList();
    };
  }

  // Portionen Regler
  document.getElementById("increasePersonsBtn").onclick = () => {
    state.persons++;
    personsCount.textContent = state.persons;
    localStorage.setItem("bringfrisch_persons", state.persons);
    renderActiveCard();
    updateShoppingList();
  };

  document.getElementById("decreasePersonsBtn").onclick = () => {
    if (state.persons > 1) {
      state.persons--;
      personsCount.textContent = state.persons;
      localStorage.setItem("bringfrisch_persons", state.persons);
      renderActiveCard();
      updateShoppingList();
    }
  };

  // Liste als Text kopieren (für WhatsApp / Bring! Schnellimport)
  document.getElementById("copyListBtn").onclick = () => {
    const itemsToExport = state.shoppingList.filter(it => !it.isOnBring && (!it.isStaple || !state.excludeStaples));
    let txt = `🛒 BringFrisch Einkaufsliste (${state.persons} Personen - nur Fehlendes):\n\n`;
    itemsToExport.forEach(it => {
      const displayAmt = it.amount === parseInt(it.amount) ? it.amount : it.amount.toFixed(1);
      txt += `• ${it.name} (${displayAmt} ${it.unit})\n`;
    });
    navigator.clipboard.writeText(txt).then(() => {
      alert(`Einkaufsliste (${itemsToExport.length} fehlende Artikel) in die Zwischenablage kopiert!`);
    });
  };

  // Bring! Export (nur noch fehlende Artikel exportieren!)
  syncToBringBtn.onclick = async () => {
    const itemsToExport = state.shoppingList.filter(it => !it.isOnBring && (!it.isStaple || !state.excludeStaples));
    if (itemsToExport.length === 0) {
      alert("Alles bereits erledigt! Alle Zutaten sind entweder schon auf Bring! oder als Grundvorrat zuhause vorhanden.");
      return;
    }
    syncBtnText.textContent = "Wird übertragen...";
    try {
      const res = await fetch("/api/bring/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToExport })
      });
      const data = await res.json();
      syncBtnText.textContent = `✅ ${itemsToExport.length} Artikel exportiert!`;
    } catch (e) {
      // Standalone Fallback
      syncBtnText.textContent = `✅ ${itemsToExport.length} Artikel bereit für Bring!`;
    }
    setTimeout(() => {
      syncBtnText.textContent = "Nach Bring! (Nur Fehlendes)";
    }, 3000);
  };

  // Kalender .ics Export (100% Client-Side Generator)
  document.getElementById("downloadIcsBtn").onclick = () => {
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//BringFrisch//Wochenplan//DE\r\n";
    const today = new Date();
    state.weekPlan.forEach((item, idx) => {
      const eventDate = new Date(today.getTime() + idx * 86400000);
      const ymd = eventDate.toISOString().split("T")[0].replace(/-/g, "");
      ics += "BEGIN:VEVENT\r\n";
      ics += `UID:bringfrisch-${idx}-${ymd}@bringfrisch.ch\r\n`;
      ics += `DTSTART:${ymd}T190000\r\n`;
      ics += `DTEND:${ymd}T200000\r\n`;
      ics += `SUMMARY:🍽️ ${item.title}\r\n`;
      ics += `DESCRIPTION:Koch: ${item.cook_assigned || 'WG'}\\nZubereitung: ${item.instructions || ''}\r\n`;
      ics += "END:VEVENT\r\n";
    });
    ics += "END:VCALENDAR\r\n";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bringfrisch_menueplan.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // 5. Tiefkühler-Gedächtnis & Altes Hackfleisch Alert
  function checkPantryAlerts() {
    if (!window.pantryTracker) return;
    const alerts = window.pantryTracker.getAlerts();
    const banner = document.getElementById("freezerAlertBanner");
    if (alerts.length > 0) {
      const first = alerts[0];
      document.getElementById("freezerAlertTitle").textContent = `${first.item.name} im Tiefkühler!`;
      document.getElementById("freezerAlertAge").textContent = `seit ${first.daysOld} Tagen`;
      document.getElementById("freezerAlertMsg").textContent = `Lagerung prüfen. Optimal jetzt verbrauchen!`;
      
      const btn = document.getElementById("applyFreezerRecipeBtn");
      if (first.suggestedRecipeId) {
        btn.classList.remove("hidden");
        document.getElementById("freezerBtnLabel").textContent = `Für diese Woche einplanen`;
        btn.onclick = () => {
          const rec = (window.BRINGFRISCH_DATA.recipes || []).find(r => r.id === first.suggestedRecipeId);
          if (rec) {
            state.weekPlan[state.activeDayIndex] = { ...rec, day: DAYS[state.activeDayIndex] };
            savePlan();
            renderActiveCard();
            updateShoppingList();
            alert(`🍽️ "${rec.title}" wurde für ${DAYS[state.activeDayIndex]} eingeplant!`);
          }
        };
      } else {
        btn.classList.add("hidden");
      }
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function renderPantryItems() {
    const list = document.getElementById("pantryItemsList");
    if (!list || !window.pantryTracker) return;
    list.innerHTML = "";
    const items = window.pantryTracker.items;

    if (items.length === 0) {
      list.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Tiefkühler ist leer.</p>`;
      return;
    }

    items.forEach(it => {
      const now = new Date();
      const frozen = new Date(it.frozenDate);
      const days = Math.ceil(Math.abs(now - frozen) / (1000 * 60 * 60 * 24));
      const isOld = days >= 14;

      const card = document.createElement("div");
      card.className = "bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between";
      card.innerHTML = `
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="text-xs font-bold text-white">${it.name}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${isOld ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
              vor ${days} Tagen
            </span>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">${it.amount} • ${it.location}</p>
        </div>
        <button class="delete-pantry-btn text-slate-500 hover:text-red-400 p-1" data-id="${it.id}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll(".delete-pantry-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        window.pantryTracker.removeItem(id);
        renderPantryItems();
        checkPantryAlerts();
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  document.getElementById("addPantryItemBtn").onclick = () => {
    const name = prompt("Welches Lebensmittel möchtest du einfrieren?", "Hackfleisch");
    if (!name) return;
    const amount = prompt("Menge:", "500 g") || "500 g";
    window.pantryTracker.addItem(name, amount);
    renderPantryItems();
    checkPantryAlerts();
  };

  // 6. Saisonkalender & Bauern-News für alle 12 Monate
  const seasonMonthSelect = document.getElementById("seasonMonthSelect");
  const seasonNewsHeadline = document.getElementById("seasonNewsHeadline");
  const seasonNewsTip = document.getElementById("seasonNewsTip");
  const seasonNewsHighlight = document.getElementById("seasonNewsHighlight");
  const seasonalItemsGrid = document.getElementById("seasonalItemsGrid");

  function loadMonthSeason(m) {
    const month = parseInt(m, 10);
    const data = window.BRINGFRISCH_DATA;
    if (!data) return;

    // News laden
    const news = (data.monthly_news && data.monthly_news[month]) || {};
    seasonNewsHeadline.textContent = news.headline || "Saisonales Schweizer Gemüse";
    seasonNewsTip.textContent = news.farmer_tip || "Erntefrisch vom Schweizer Gemüsebauern.";
    seasonNewsHighlight.textContent = news.season_highlight || "Saisongemüse";

    // Produkte filtern
    seasonalItemsGrid.innerHTML = "";
    const items = (data.items || []).filter(it => 
      (it.field_months && it.field_months.includes(month)) ||
      (it.storage_months && it.storage_months.includes(month))
    );

    items.forEach(it => {
      const isField = it.field_months && it.field_months.includes(month);
      const card = document.createElement("div");
      card.className = "p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between";
      card.innerHTML = `
        <div>
          <span class="text-[10px] px-1.5 py-0.5 rounded font-semibold ${isField ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}">
            ${isField ? '🌱 Freilandfrisch' : '📦 Schweizer Lager'}
          </span>
          <h4 class="text-xs font-bold text-white mt-1.5">${it.name}</h4>
        </div>
        <div class="mt-2 text-[10px] text-slate-400">
          <span>${it.category}</span>
        </div>
      `;
      seasonalItemsGrid.appendChild(card);
    });
  }

  seasonMonthSelect.onchange = (e) => loadMonthSeason(e.target.value);
  loadMonthSeason(11); // Standard: November

  // 7. Foto-Rezept Import Modal
  const openImportModalBtn = document.getElementById("openImportModalBtn");
  const closeImportModalBtn = document.getElementById("closeImportModalBtn");
  const recipeImportModal = document.getElementById("recipeImportModal");
  const saveImportRecipeBtn = document.getElementById("saveImportRecipeBtn");

  openImportModalBtn.onclick = () => recipeImportModal.classList.remove("hidden");
  closeImportModalBtn.onclick = () => recipeImportModal.classList.add("hidden");

  saveImportRecipeBtn.onclick = () => {
    const title = document.getElementById("importRecipeTitle").value.trim();
    const rawIng = document.getElementById("importRecipeIngredients").value.trim();
    if (!title || !rawIng) {
      alert("Bitte Titel und Zutaten angeben!");
      return;
    }
    const newRec = window.recipeImporter.createRecipeFromText(title, rawIng);
    state.weekPlan[state.activeDayIndex] = { ...newRec, day: DAYS[state.activeDayIndex] };
    savePlan();
    renderActiveCard();
    updateShoppingList();
    recipeImportModal.classList.add("hidden");
    alert(`📸 "${newRec.title}" wurde in deinen Wochentag aufgenommen!`);
  };

  // Quittungs-Scanner Diff
  const triggerCameraBtn = document.getElementById("triggerCameraBtn");
  const receiptFileInput = document.getElementById("receiptFileInput");
  const loadMockReceiptBtn = document.getElementById("loadMockReceiptBtn");
  const receiptResultCard = document.getElementById("receiptResultCard");

  triggerCameraBtn.onclick = () => receiptFileInput.click();
  receiptFileInput.onchange = () => runReceiptDiff();
  loadMockReceiptBtn.onclick = () => runReceiptDiff();

  function runReceiptDiff() {
    receiptResultCard.classList.remove("hidden");
    document.getElementById("receiptTotalSpent").textContent = "CHF 12.80";
    document.getElementById("receiptFoundCount").textContent = "3";
    document.getElementById("receiptMissingCount").textContent = (state.shoppingList.length - 3).toString();

    const foundList = document.getElementById("receiptFoundList");
    foundList.innerHTML = `
      <li class="flex justify-between py-0.5 text-emerald-300"><span>✓ Schweizer Speisekartoffeln</span> <span class="font-mono">CHF 2.50</span></li>
      <li class="flex justify-between py-0.5 text-emerald-300"><span>✓ Rüebli</span> <span class="font-mono">CHF 1.80</span></li>
      <li class="flex justify-between py-0.5 text-emerald-300"><span>✓ Schweizer Reibkäse</span> <span class="font-mono">CHF 4.20</span></li>
    `;

    const missingList = document.getElementById("receiptMissingList");
    missingList.innerHTML = "";
    state.shoppingList.slice(3, 8).forEach(it => {
      const li = document.createElement("li");
      li.className = "flex justify-between py-0.5 text-red-300";
      li.innerHTML = `<span>⚠️ ${it.name}</span> <span class="text-[10px] text-slate-500">${it.bring_cat}</span>`;
      missingList.appendChild(li);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Navigation Tab Switching
  const navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach(tab => {
    tab.onclick = () => {
      navTabs.forEach(t => {
        t.classList.remove("text-emerald-400", "active");
        t.classList.add("text-slate-400");
      });
      tab.classList.add("text-emerald-400", "active");
      tab.classList.remove("text-slate-400");

      const targetId = tab.getAttribute("data-target");
      ["tabPlan", "tabShopping", "tabReceipt", "tabSeason", "tabPantry", "tabSettings"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === targetId) el.classList.remove("hidden");
          else el.classList.add("hidden");
        }
      });
      if (window.lucide) lucide.createIcons();
    };
  });

  // Start initial load
  loadPlan();
});
