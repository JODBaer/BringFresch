// BringFrisch PWA Application Logic
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
    cachedRecipes: []
  };

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

  // 1. Initial Load & Setup
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

  // 2. Fetch or Generate Week Plan
  async function loadPlan() {
    try {
      const res = await fetch(`/api/wg/plan?wg_id=${encodeURIComponent(state.wgId)}`);
      const data = await res.json();
      state.weekPlan = data.plan || [];
      state.persons = data.persons || state.persons;
      personsCount.textContent = state.persons;
    } catch (e) {
      console.warn("Offline/Mock Fallback:", e);
      await generateLocalFallbackPlan();
    }
    renderDaySelector();
    renderActiveCard();
    updateShoppingList();
  }

  async function generateLocalFallbackPlan() {
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diet: state.diet, persons: state.persons })
      });
      const data = await res.json();
      state.weekPlan = data.plan;
    } catch (e) {
      console.error("Fehler beim Plan-Generieren", e);
    }
  }

  // 3. Render Active Day Card with Swipe Support
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

  // Touch Swipe on Card
  const activeCard = document.getElementById("activeCard");
  let touchStartX = 0;
  let touchEndX = 0;

  activeCard.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  activeCard.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleCardSwipe();
  }, { passive: true });

  function handleCardSwipe() {
    const diff = touchEndX - touchStartX;
    if (diff < -50) {
      // Swipe links: Nächster Tag
      if (state.activeDayIndex < DAYS.length - 1) {
        state.activeDayIndex++;
        renderDaySelector();
        renderActiveCard();
      }
    } else if (diff > 50) {
      // Swipe rechts: Vorheriger Tag
      if (state.activeDayIndex > 0) {
        state.activeDayIndex--;
        renderDaySelector();
        renderActiveCard();
      }
    }
  }

  // Shuffle single recipe for current day
  document.getElementById("shuffleDayBtn").onclick = async () => {
    try {
      const res = await fetch(`/api/recipes?diet=${state.diet}`);
      const data = await res.json();
      const recipes = data.recipes || [];
      if (recipes.length > 0) {
        const randomRecipe = recipes[Math.floor(Math.random() * recipes.length)];
        const dayCopy = { ...randomRecipe, day: DAYS[state.activeDayIndex], cook_assigned: state.weekPlan[state.activeDayIndex].cook_assigned };
        state.weekPlan[state.activeDayIndex] = dayCopy;
        renderActiveCard();
        updateShoppingList();
        saveWgPlan();
      }
    } catch (e) {
      console.warn("Shuffle Error", e);
    }
  };

  // Assign cook dialog
  document.getElementById("assignCookBtn").onclick = () => {
    const name = prompt("Wer kocht an diesem Tag?", state.weekPlan[state.activeDayIndex].cook_assigned || "Du");
    if (name) {
      state.weekPlan[state.activeDayIndex].cook_assigned = name;
      renderActiveCard();
      saveWgPlan();
    }
  };

  // Whole week regenerate
  document.getElementById("regenWholeWeekBtn").onclick = async () => {
    await generateLocalFallbackPlan();
    renderActiveCard();
    updateShoppingList();
    saveWgPlan();
  };

  async function saveWgPlan() {
    try {
      await fetch("/api/wg/plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wg_id: state.wgId,
          persons: state.persons,
          diet: state.diet,
          plan: state.weekPlan
        })
      });
    } catch (e) {
      console.warn("Save WG error", e);
    }
  }

  // 4. Shopping List & Aggregation
  async function updateShoppingList() {
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: state.weekPlan, persons: state.persons })
      });
      const data = await res.json();
      state.shoppingList = data.items || [];
      renderShoppingList();
    } catch (e) {
      console.warn("Shopping list error", e);
    }
  }

  function renderShoppingList() {
    shoppingListContainer.innerHTML = "";
    if (state.shoppingList.length === 0) {
      shoppingListContainer.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Keine Artikel</p>`;
      return;
    }

    // Group by Bring Category
    const grouped = {};
    state.shoppingList.forEach((item, idx) => {
      const cat = item.bring_cat || "Sonstiges";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ ...item, idx });
    });

    Object.keys(grouped).forEach(cat => {
      const catBox = document.createElement("div");
      catBox.className = "bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2";
      
      let html = `<h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
        <span>${cat}</span>
        <span class="text-[10px] text-slate-500 font-mono">${grouped[cat].length} Artikel</span>
      </h4><div class="space-y-1.5">`;

      grouped[cat].forEach(it => {
        html += `
          <label class="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-800 cursor-pointer">
            <div class="flex items-center space-x-2.5">
              <input type="checkbox" class="rounded text-emerald-500 bg-slate-800 border-slate-700" ${it.checked ? "checked" : ""}>
              <span class="${it.checked ? "line-through text-slate-500" : "text-slate-200"}">${it.name}</span>
            </div>
            <span class="text-emerald-400 font-mono text-[11px] font-semibold">${it.display_amount}</span>
          </label>
        `;
      });
      html += `</div>`;
      catBox.innerHTML = html;
      shoppingListContainer.appendChild(catBox);
    });
  }

  // Persons adjuster
  document.getElementById("increasePersonsBtn").onclick = () => {
    state.persons++;
    personsCount.textContent = state.persons;
    localStorage.setItem("bringfrisch_persons", state.persons);
    renderActiveCard();
    updateShoppingList();
    saveWgPlan();
  };

  document.getElementById("decreasePersonsBtn").onclick = () => {
    if (state.persons > 1) {
      state.persons--;
      personsCount.textContent = state.persons;
      localStorage.setItem("bringfrisch_persons", state.persons);
      renderActiveCard();
      updateShoppingList();
      saveWgPlan();
    }
  };

  // 5. Bring! Sync
  syncToBringBtn.onclick = async () => {
    syncBtnText.textContent = "Übertrage nach Bring!...";
    try {
      const res = await fetch("/api/bring/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: state.shoppingList })
      });
      const data = await res.json();
      syncBtnText.textContent = `✅ ${data.items_count} Artikel synchronisiert!`;
      setTimeout(() => {
        syncBtnText.textContent = "Nach Bring! exportieren";
      }, 3000);
    } catch (e) {
      syncBtnText.textContent = "Synchronisation fehlgeschlagen";
    }
  };

  // 6. Calendar Export (.ics)
  document.getElementById("downloadIcsBtn").onclick = async () => {
    try {
      const res = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: state.weekPlan })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bringfrisch_wochenplan.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert("Kalender-Export fehlgeschlagen.");
    }
  };

  // 7. Receipt Scanner & OCR Simulation
  const triggerCameraBtn = document.getElementById("triggerCameraBtn");
  const receiptFileInput = document.getElementById("receiptFileInput");
  const loadMockReceiptBtn = document.getElementById("loadMockReceiptBtn");
  const receiptResultCard = document.getElementById("receiptResultCard");

  triggerCameraBtn.onclick = () => receiptFileInput.click();
  receiptFileInput.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      runReceiptDiff(
        "MIGROS COOPERATIVE\n" +
        "BIO RUEBLI 500G 1.80\n" +
        "SPEISEKARTOFFELN 2.50\n" +
        "HAKEN GRUYERE 4.50\n" +
        "TOTAL CHF 8.80"
      );
    }
  };

  loadMockReceiptBtn.onclick = () => {
    runReceiptDiff(
      "MIGROS COOPERATIVE\n" +
      "BIO RUEBLI 500G 1.80\n" +
      "SPEISEKARTOFFELN 2.50\n" +
      "ZWIEBELN CH 1.40\n" +
      "TOTAL CHF 5.70"
    );
  };

  async function runReceiptDiff(receiptText) {
    try {
      const res = await fetch("/api/receipt/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_text: receiptText,
          shopping_list: state.shoppingList
        })
      });
      const data = await res.json();
      receiptResultCard.classList.remove("hidden");
      document.getElementById("receiptTotalSpent").textContent = `CHF ${data.total_spent_chf.toFixed(2)}`;
      document.getElementById("receiptFoundCount").textContent = data.found_count;
      document.getElementById("receiptMissingCount").textContent = data.missing_count;

      const foundList = document.getElementById("receiptFoundList");
      foundList.innerHTML = "";
      data.found.forEach(item => {
        const li = document.createElement("li");
        li.className = "flex justify-between py-0.5 text-emerald-300";
        li.innerHTML = `<span>✓ ${item.name}</span> <span class="font-mono">CHF ${(item.price || 0).toFixed(2)}</span>`;
        foundList.appendChild(li);
      });

      const missingList = document.getElementById("receiptMissingList");
      missingList.innerHTML = "";
      data.missing.forEach(item => {
        const li = document.createElement("li");
        li.className = "flex justify-between py-0.5 text-red-300";
        li.innerHTML = `<span>⚠️ ${item.name} (${item.display_amount})</span> <span class="text-[10px] text-slate-500">${item.bring_cat}</span>`;
        missingList.appendChild(li);
      });

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      alert("Fehler beim Quittungsabgleich.");
    }
  }

  // 8. Season Calendar Tab
  const seasonMonthSelect = document.getElementById("seasonMonthSelect");
  const seasonalItemsGrid = document.getElementById("seasonalItemsGrid");

  async function loadSeasonalItems(month = 11) {
    try {
      const res = await fetch(`/api/season?month=${month}`);
      const data = await res.json();
      seasonalItemsGrid.innerHTML = "";
      (data.items || []).forEach(it => {
        const card = document.createElement("div");
        card.className = "p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between";
        card.innerHTML = `
          <div>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">${it.category}</span>
            <h4 class="text-xs font-bold text-white mt-1.5">${it.name}</h4>
          </div>
          <div class="mt-2 text-[10px] text-slate-400">
            <span>${it.current_status}</span>
          </div>
        `;
        seasonalItemsGrid.appendChild(card);
      });
    } catch (e) {
      console.warn("Season error", e);
    }
  }

  seasonMonthSelect.onchange = (e) => loadSeasonalItems(e.target.value);
  loadSeasonalItems(11);

  // 9. Tab Switching Navigation
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
      ["tabPlan", "tabShopping", "tabReceipt", "tabSeason", "tabSettings"].forEach(id => {
        const el = document.getElementById(id);
        if (id === targetId) el.classList.remove("hidden");
        else el.classList.add("hidden");
      });
      if (window.lucide) lucide.createIcons();
    };
  });

  // WG Code Save
  document.getElementById("wgSaveBtn").onclick = () => {
    const val = document.getElementById("wgIdInput").value.trim();
    if (val) {
      state.wgId = val;
      localStorage.setItem("bringfrisch_wg_id", val);
      headerWgName.textContent = val;
      loadPlan();
    }
  };

  // Diet filter buttons
  document.querySelectorAll(".diet-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".diet-btn").forEach(b => {
        b.className = "diet-btn py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold";
      });
      btn.className = "diet-btn py-2 px-3 rounded-xl border border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold";
      state.diet = btn.getAttribute("data-diet");
      localStorage.setItem("bringfrisch_diet", state.diet);
      generateLocalFallbackPlan().then(() => {
        renderActiveCard();
        updateShoppingList();
        saveWgPlan();
      });
    };
  });

  // Start initial load
  loadPlan();
});
