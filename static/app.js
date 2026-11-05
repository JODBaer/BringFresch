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
    pantryStaples: loadUserStaples(),
    members: loadMembers()
  };

  function loadMembers() {
    const saved = localStorage.getItem("bringfrisch_members");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: "m1", name: "Jonas", diet: "vegi" },
      { id: "m2", name: "Anna", diet: "vegan" },
      { id: "m3", name: "Lukas", diet: "fleisch" }
    ];
  }

  function saveMembers() {
    localStorage.setItem("bringfrisch_members", JSON.stringify(state.members));
  }

  function calculateEffectiveDiet(eaterIds) {
    if (!eaterIds || eaterIds.length === 0) return "vegi";
    const diets = eaterIds.map(id => {
      const m = state.members.find(mem => mem.id === id);
      return m ? m.diet : "vegi";
    });
    if (diets.includes("vegan")) return "vegan";
    if (diets.includes("vegi")) return "vegi";
    if (diets.includes("schweizerisch")) return "schweizerisch";
    return "fleisch";
  }

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
  function getRecipesPool(dietOverride = null) {
    const targetDiet = dietOverride || state.diet;
    const defaultRecipes = (window.BRINGFRISCH_DATA && window.BRINGFRISCH_DATA.recipes) || [];
    const customRecipes = (window.recipeImporter && window.recipeImporter.customRecipes) || [];
    const all = [...defaultRecipes, ...customRecipes];
    
    // Filter nach Diät
    if (targetDiet === "vegan") {
      const veganList = all.filter(r => r.diet === "vegan");
      return veganList.length > 0 ? veganList : all;
    } else if (targetDiet === "vegi") {
      const vegiList = all.filter(r => r.diet === "vegi" || r.diet === "vegan");
      return vegiList.length > 0 ? vegiList : all;
    } else if (targetDiet === "schweizerisch") {
      const swissList = all.filter(r => r.category === "schweizerisch");
      return swissList.length > 0 ? swissList : all;
    }
    return all;
  }

  function generateStandalonePlan() {
    const plan = [];
    const allMemberIds = state.members.map(m => m.id);

    DAYS.forEach((day) => {
      const effectiveDiet = calculateEffectiveDiet(allMemberIds);
      const pool = getRecipesPool(effectiveDiet);
      const recipe = pool[Math.floor(Math.random() * pool.length)];
      const personCount = allMemberIds.length || 3;
      const buffer = 2; // Standardmäßig +2 Portionen für Reste / Zmittag am nächsten Tag
      const totalPersons = personCount + buffer;

      plan.push({
        ...recipe,
        day: day,
        eaters: [...allMemberIds],
        leftover_buffer: buffer,
        extra_guests: 0,
        effective_diet: effectiveDiet,
        person_count: totalPersons,
        scaled_cost_chf: ((recipe.cost_per_person_chf || 2.80) * totalPersons).toFixed(2),
        cook_assigned: null
      });
    });
    return plan;
  }

  // Plan laden: Prüft P2P URL-Hash (#plan=...), sonst LocalStorage / Server
  async function loadPlan() {
    let planLoadedFromHash = false;
    // 1. P2P Mesh Import via URL-Hash
    if (window.location.hash.startsWith("#plan=")) {
      try {
        const base64Data = decodeURIComponent(window.location.hash.substring(6));
        const jsonStr = decodeURIComponent(escape(atob(base64Data)));
        const sharedPayload = JSON.parse(jsonStr);

        if (sharedPayload.weekPlan) state.weekPlan = sharedPayload.weekPlan;
        else if (sharedPayload.plan) state.weekPlan = sharedPayload.plan;
        if (sharedPayload.members) state.members = sharedPayload.members;
        if (sharedPayload.wgId) state.wgId = sharedPayload.wgId;

        savePlan();
        saveMembers();
        planLoadedFromHash = true;
        history.replaceState(null, "", window.location.pathname);
        alert(`🎉 WG-Wochenplan "${state.wgId}" erfolgreich via P2P empfangen und synchronisiert!`);
      } catch (err) {
        console.warn("P2P hash import error", err);
      }
    }

    if (!planLoadedFromHash) {
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
    }

    // Sicherstellen, dass jeder Tag leftover_buffer hat
    state.weekPlan.forEach(d => {
      if (d.leftover_buffer === undefined) d.leftover_buffer = 2;
    });

    renderDaySelector();
    renderWeekGrid();
    renderActiveCard();
    updateShoppingList();
    checkPantryAlerts();
    renderPantryItems();
    renderMembersManager();
    renderAttendanceMatrix();
    checkBringStatus();
  }

  // Bring! Status & Modal Logic
  const bringSettingsBtn = document.getElementById("bringSettingsBtn");
  const bringStatusBadge = document.getElementById("bringStatusBadge");
  const bringListName = document.getElementById("bringListName");
  const bringSettingsModal = document.getElementById("bringSettingsModal");
  const closeBringModalBtn = document.getElementById("closeBringModalBtn");
  const bringEmailInput = document.getElementById("bringEmailInput");
  const bringPasswordInput = document.getElementById("bringPasswordInput");
  const bringLoginBtn = document.getElementById("bringLoginBtn");
  const bringLoginBtnText = document.getElementById("bringLoginBtnText");
  const bringLoginFeedback = document.getElementById("bringLoginFeedback");
  const bringListSelect = document.getElementById("bringListSelect");

  let isBringConnected = false;

  async function checkBringStatus() {
    try {
      const res = await fetch("/api/bring/status");
      const data = await res.json();
      isBringConnected = data.is_connected && !data.is_mock;

      if (isBringConnected) {
        if (bringStatusBadge) {
          bringStatusBadge.textContent = "Verbunden";
          bringStatusBadge.className = "text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer";
        }
        if (bringListName) {
          bringListName.textContent = `Liste: ${data.list_name || 'WG-Einkauf'}`;
        }
        if (bringEmailInput && data.email) {
          bringEmailInput.value = data.email;
        }
        loadBringLists();
      } else {
        if (bringStatusBadge) {
          bringStatusBadge.textContent = "Nicht verbunden";
          bringStatusBadge.className = "text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer";
        }
        if (bringListName) {
          bringListName.textContent = "Klicke auf 'Verbinden' für Bring!";
        }
      }
    } catch (e) {
      console.warn("Bring status check error", e);
    }
  }

  async function loadBringLists() {
    try {
      const res = await fetch("/api/bring/lists");
      const data = await res.json();
      const lists = data.lists || [];
      if (bringListSelect && lists.length > 0) {
        bringListSelect.innerHTML = "";
        lists.forEach(l => {
          const opt = document.createElement("option");
          opt.value = l.listUuid;
          opt.textContent = l.name;
          bringListSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn("Load lists error", e);
    }
  }

  function openBringModal() {
    if (bringSettingsModal) {
      bringSettingsModal.classList.remove("hidden");
      if (bringLoginFeedback) bringLoginFeedback.classList.add("hidden");
    }
  }

  if (bringSettingsBtn) bringSettingsBtn.onclick = openBringModal;
  if (bringStatusBadge) bringStatusBadge.onclick = openBringModal;
  if (closeBringModalBtn) {
    closeBringModalBtn.onclick = () => {
      if (bringSettingsModal) bringSettingsModal.classList.add("hidden");
    };
  }

  if (bringLoginBtn) {
    bringLoginBtn.onclick = async () => {
      const email = (bringEmailInput.value || "").trim();
      const password = (bringPasswordInput.value || "").trim();

      if (!email || !password) {
        showBringFeedback("Bitte E-Mail und Passwort eingeben!", false);
        return;
      }

      bringLoginBtnText.textContent = "Verbinde mit Bring!...";
      try {
        const res = await fetch("/api/bring/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
          isBringConnected = true;
          showBringFeedback(`✅ Verbunden als ${data.email}!`, true);
          bringLoginBtnText.textContent = "Verknüpft";
          
          if (data.lists && bringListSelect) {
            bringListSelect.innerHTML = "";
            data.lists.forEach(l => {
              const opt = document.createElement("option");
              opt.value = l.listUuid;
              opt.textContent = l.name;
              if (l.listUuid === data.list_uuid) opt.selected = true;
              bringListSelect.appendChild(opt);
            });
          }

          if (bringStatusBadge) {
            bringStatusBadge.textContent = "Verbunden";
            bringStatusBadge.className = "text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer";
          }
          if (bringListName) {
            bringListName.textContent = `Liste: ${data.list_name || 'WG-Einkauf'}`;
          }

          setTimeout(() => {
            if (bringSettingsModal) bringSettingsModal.classList.add("hidden");
          }, 1500);
        } else {
          showBringFeedback(`❌ ${data.error || 'Login fehlgeschlagen. Bitte Zugangsdaten prüfen.'}`, false);
          bringLoginBtnText.textContent = "Jetzt mit Bring! verbinden";
        }
      } catch (e) {
        showBringFeedback("❌ Verbindungsfehler zum Server.", false);
        bringLoginBtnText.textContent = "Jetzt mit Bring! verbinden";
      }
    };
  }

  const bringTokenInput = document.getElementById("bringTokenInput");
  const bringTokenLoginBtn = document.getElementById("bringTokenLoginBtn");

  if (bringTokenLoginBtn) {
    bringTokenLoginBtn.onclick = async () => {
      const token = (bringTokenInput.value || "").trim();
      if (!token) {
        showBringFeedback("Bitte einen Bring! Token eingeben!", false);
        return;
      }

      try {
        const res = await fetch("/api/bring/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token })
        });
        const data = await res.json();
        if (data.success) {
          isBringConnected = true;
          showBringFeedback("✅ Erfolgreich via Token verknüpft!", true);
          if (bringStatusBadge) {
            bringStatusBadge.textContent = "Verbunden";
            bringStatusBadge.className = "text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer";
          }
          if (bringListName) {
            bringListName.textContent = "Liste: Bring! Web";
          }
          setTimeout(() => {
            if (bringSettingsModal) bringSettingsModal.classList.add("hidden");
          }, 1500);
        } else {
          showBringFeedback(`❌ ${data.error || 'Token ungültig'}`, false);
        }
      } catch (e) {
        showBringFeedback("❌ Verbindungsfehler zum Server.", false);
      }
    };
  }

  const bringTokenInput = document.getElementById("bringTokenInput");
  const bringTokenLoginBtn = document.getElementById("bringTokenLoginBtn");

  if (bringTokenLoginBtn) {
    bringTokenLoginBtn.onclick = async () => {
      const token = (bringTokenInput.value || "").trim();
      if (!token) {
        showBringFeedback("Bitte einen Bring! Token eingeben!", false);
        return;
      }

      try {
        const res = await fetch("/api/bring/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token })
        });
        const data = await res.json();
        if (data.success) {
          isBringConnected = true;
          showBringFeedback("✅ Erfolgreich via Token verknüpft!", true);
          if (bringStatusBadge) {
            bringStatusBadge.textContent = "Verbunden";
            bringStatusBadge.className = "text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer";
          }
          if (bringListName) {
            bringListName.textContent = "Liste: Bring! Web";
          }
          setTimeout(() => {
            if (bringSettingsModal) bringSettingsModal.classList.add("hidden");
          }, 1500);
        } else {
          showBringFeedback(`❌ ${data.error || 'Token ungültig'}`, false);
        }
      } catch (e) {
        showBringFeedback("❌ Verbindungsfehler zum Server.", false);
      }
    };
  }

  function showBringFeedback(msg, isSuccess) {
    if (!bringLoginFeedback) return;
    bringLoginFeedback.textContent = msg;
    bringLoginFeedback.className = `p-2.5 rounded-xl text-xs flex items-center space-x-1.5 ${
      isSuccess
        ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
        : "bg-red-950/40 text-red-300 border border-red-700/50"
    }`;
    bringLoginFeedback.classList.remove("hidden");
  }

  if (bringListSelect) {
    bringListSelect.onchange = async (e) => {
      const selectedUuid = e.target.value;
      const selectedName = e.target.options[e.target.selectedIndex].text;
      try {
        await fetch("/api/bring/set-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ list_uuid: selectedUuid, list_name: selectedName })
        });
        if (bringListName) bringListName.textContent = `Liste: ${selectedName}`;
      } catch (err) {
        console.warn("Set list error", err);
      }
    };
  }

  function renderActiveCard() {
    if (!state.weekPlan || state.weekPlan.length === 0) return;
    const current = state.weekPlan[state.activeDayIndex];
    if (!current) return;

    // Standard-Esser initialisieren falls noch nicht gesetzt
    if (!current.eaters) {
      current.eaters = state.members.map(m => m.id);
    }
    if (current.extra_guests === undefined) {
      current.extra_guests = 0;
    }
    if (current.leftover_buffer === undefined) {
      current.leftover_buffer = 2;
    }

    const eatersCount = current.eaters.length;
    const guests = current.extra_guests || 0;
    const buffer = current.leftover_buffer;
    const dayPersons = eatersCount + guests + buffer || 4;
    current.person_count = dayPersons;
    current.effective_diet = calculateEffectiveDiet(current.eaters);

    cardDayBadge.textContent = current.day || DAYS[state.activeDayIndex];
    cardDietBadge.textContent = (current.diet || current.effective_diet).toUpperCase();
    
    const costPerP = current.cost_per_person_chf || 2.80;
    cardCostBadge.textContent = `CHF ${(costPerP * dayPersons).toFixed(2)} (${dayPersons} Port.)`;
    cardTitle.textContent = current.title;
    cardPrepTime.textContent = `${current.prep_time_min || 30} Min.`;
    cardSeasonFokus.textContent = (current.primary_vegetables || []).join(", ") || "Schweizer Saisongemüse";
    cardCookName.textContent = current.cook_assigned ? `Koch: ${current.cook_assigned}` : "Koch: Offen / WG";
    cardHealthTip.textContent = current.health_tip || "Ausgewogenes Rezept mit Schweizer Gemüse.";

    const cardSourceLink = document.getElementById("cardSourceLink");
    if (cardSourceLink) {
      if (current.source_url) {
        cardSourceLink.href = current.source_url;
        cardSourceLink.classList.remove("hidden");
      } else {
        cardSourceLink.classList.add("hidden");
      }
    }

    // Wer isst mit heute? UI rendern
    const dayEaterSummary = document.getElementById("dayEaterSummary");
    if (dayEaterSummary) {
      dayEaterSummary.textContent = `${eatersCount} Esser + ${buffer} Reste = ${dayPersons} Port. • ${current.effective_diet.toUpperCase()}`;
    }

    const dayEatersList = document.getElementById("dayEatersList");
    if (dayEatersList) {
      dayEatersList.innerHTML = "";
      state.members.forEach(mem => {
        const isAttending = current.eaters.includes(mem.id);
        const btn = document.createElement("button");
        btn.className = `text-[11px] px-2.5 py-1 rounded-xl border transition flex items-center space-x-1.5 ${
          isAttending
            ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/50 shadow-sm"
            : "bg-slate-800/80 text-slate-400 border-slate-700/60 line-through opacity-60"
        }`;
        btn.innerHTML = `<span>${isAttending ? '✓' : '✗'} ${mem.name}</span> <span class="text-[9px] px-1 py-0.2 rounded bg-slate-900 font-mono text-slate-400 uppercase">${mem.diet}</span>`;
        btn.onclick = () => {
          if (isAttending) {
            current.eaters = current.eaters.filter(id => id !== mem.id);
          } else {
            current.eaters.push(mem.id);
          }
          current.effective_diet = calculateEffectiveDiet(current.eaters);
          savePlan();
          renderActiveCard();
          updateShoppingList();
        };
        dayEatersList.appendChild(btn);
      });

      // Gast-Button (+1 / -1)
      const guestBtn = document.createElement("button");
      guestBtn.className = "text-[11px] px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition flex items-center space-x-1";
      guestBtn.innerHTML = `<span>+ Gast (${current.extra_guests})</span>`;
      guestBtn.onclick = () => {
        current.extra_guests = (current.extra_guests + 1) % 5;
        savePlan();
        renderActiveCard();
        updateShoppingList();
      };
      dayEatersList.appendChild(guestBtn);
    }

    cardIngredients.innerHTML = "";
    const scale = dayPersons / 2;
    (current.ingredients || []).forEach(ing => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between py-0.5 border-b border-slate-800/40";
      const scaledAmt = (parseFloat(ing.amount || "1") * scale);
      const displayAmt = scaledAmt === parseInt(scaledAmt) ? scaledAmt : scaledAmt.toFixed(1);
      li.innerHTML = `<span>${ing.name}</span> <span class="text-slate-400 font-mono text-[11px]">${displayAmt} ${ing.unit}</span>`;
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

  // Anderes Rezept für diesen Tag würfeln (beachtet Diät aller heutigen Esser!)
  document.getElementById("shuffleDayBtn").onclick = () => {
    const current = state.weekPlan[state.activeDayIndex];
    const targetDiet = current.effective_diet || state.diet;
    const pool = getRecipesPool(targetDiet);
    if (pool.length > 0) {
      const randomRecipe = pool[Math.floor(Math.random() * pool.length)];
      state.weekPlan[state.activeDayIndex] = {
        ...randomRecipe,
        day: DAYS[state.activeDayIndex],
        eaters: current.eaters,
        extra_guests: current.extra_guests,
        effective_diet: current.effective_diet,
        person_count: current.person_count,
        cook_assigned: current.cook_assigned
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

  // 7-Tage Kachel-Übersicht & View Switcher
  const weekCardsContainer = document.getElementById("weekCardsContainer");
  const viewGridBtn = document.getElementById("viewGridBtn");
  const viewSingleBtn = document.getElementById("viewSingleBtn");
  const weekGridSection = document.getElementById("weekGridSection");
  const singleCardSection = document.getElementById("singleCardSection");
  const regenWholeWeekBtnTop = document.getElementById("regenWholeWeekBtnTop");
  const quickSyncBringBtn = document.getElementById("quickSyncBringBtn");

  function setViewMode(mode) {
    if (mode === "grid") {
      if (weekGridSection) weekGridSection.classList.remove("hidden");
      if (singleCardSection) singleCardSection.classList.add("hidden");
      if (viewGridBtn) viewGridBtn.className = "py-1.5 px-2.5 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 shadow-md flex items-center space-x-1 transition";
      if (viewSingleBtn) viewSingleBtn.className = "py-1.5 px-2.5 text-xs font-bold rounded-xl text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition";
      renderWeekGrid();
    } else {
      if (weekGridSection) weekGridSection.classList.add("hidden");
      if (singleCardSection) singleCardSection.classList.remove("hidden");
      if (viewGridBtn) viewGridBtn.className = "py-1.5 px-2.5 text-xs font-bold rounded-xl text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition";
      if (viewSingleBtn) viewSingleBtn.className = "py-1.5 px-2.5 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 shadow-md flex items-center space-x-1 transition";
      renderActiveCard();
    }
    if (window.lucide) lucide.createIcons();
  }

  if (viewGridBtn) viewGridBtn.onclick = () => setViewMode("grid");
  if (viewSingleBtn) viewSingleBtn.onclick = () => setViewMode("single");

  if (regenWholeWeekBtnTop) {
    regenWholeWeekBtnTop.onclick = () => {
      if (confirm("Ganze Woche mit neuen Schweizer Saison-Rezepten würfeln?")) {
        state.weekPlan = generateStandalonePlan();
        savePlan();
        renderWeekGrid();
        renderActiveCard();
        renderAttendanceMatrix();
        updateShoppingList();
      }
    };
  }

  if (quickSyncBringBtn) {
    quickSyncBringBtn.onclick = () => performBringSync();
  }

  // Render 7-Tage Kachel-Übersicht mit 3-Komponenten Menüs ("Alles für Alle")
  function renderWeekGrid() {
    if (!weekCardsContainer || !state.weekPlan || state.weekPlan.length === 0) return;
    weekCardsContainer.innerHTML = "";

    state.weekPlan.forEach((day, idx) => {
      if (!day.eaters) day.eaters = state.members.map(m => m.id);
      if (day.leftover_buffer === undefined) day.leftover_buffer = 2;
      if (day.extra_guests === undefined) day.extra_guests = 0;

      const attendingMembers = state.members.filter(m => day.eaters && day.eaters.includes(m.id));
      const eatersCount = attendingMembers.length;
      const buffer = day.leftover_buffer;
      const guests = day.extra_guests;
      const totalPersons = eatersCount + guests + buffer || 4;
      day.person_count = totalPersons;
      day.effective_diet = calculateEffectiveDiet(day.eaters);

      // Individuelle Proteine ermitteln
      const meatEaters = attendingMembers.filter(m => m.diet === "fleisch");
      const vegiEaters = attendingMembers.filter(m => m.diet === "vegi");
      const veganEaters = attendingMembers.filter(m => m.diet === "vegan");

      const card = document.createElement("div");
      card.className = "bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition";

      card.innerHTML = `
        <!-- Tag-Kopfzeile -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              ${day.day || DAYS[idx]}
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
              ${(day.diet || day.effective_diet).toUpperCase()}
            </span>
            ${
              day.source_url
                ? `<a href="${day.source_url}" target="_blank" rel="noopener" class="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded-md transition" title="Rezept im Browser öffnen">
                     <i data-lucide="external-link" class="w-3 h-3"></i>
                     <span>Link</span>
                   </a>`
                : ""
            }
          </div>
          <div class="flex items-center space-x-1.5">
            <button class="grid-cook-btn text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 px-2 py-0.5 rounded-md border border-slate-700 flex items-center space-x-1" data-day-idx="${idx}">
              <span>👨‍🍳</span>
              <span>${day.cook_assigned || 'Koch?'}</span>
            </button>
            <button class="grid-shuffle-btn text-slate-400 hover:text-amber-300 p-1" data-day-idx="${idx}" title="Anderes Saison-Rezept würfeln">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
            <button class="grid-detail-btn text-slate-400 hover:text-emerald-400 p-1" data-day-idx="${idx}" title="Tages-Detail öffnen">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Menütitel & Menü wählen Button -->
        <div class="flex items-start justify-between gap-2 pt-0.5">
          <div class="flex-1">
            <div class="flex items-center space-x-1.5">
              <span class="text-xs">🍲</span>
              <h4 class="text-sm font-bold text-white leading-snug">${day.title}</h4>
            </div>
            <div class="flex items-center space-x-2.5 text-[10px] text-slate-400 mt-1 pl-4">
              <span>⏱️ ${day.prep_time_min || 25} Min.</span>
              <span>💰 CHF ${day.cost_per_person_chf || '2.80'}/P.</span>
              ${
                day.source_url
                  ? `<a href="${day.source_url}" target="_blank" rel="noopener" class="text-cyan-400 hover:underline flex items-center space-x-0.5">
                       <span>Browser-Rezept</span>
                       <i data-lucide="external-link" class="w-2.5 h-2.5"></i>
                     </a>`
                  : ""
              }
            </div>
          </div>
          <button class="grid-pick-menu-btn text-[11px] font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 active:scale-95 border border-emerald-500/40 px-2.5 py-1.5 rounded-xl transition flex items-center space-x-1 flex-shrink-0" data-day-idx="${idx}">
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-emerald-400"></i>
            <span>Menü wählen</span>
          </button>
        </div>

        <!-- 3-Komponenten Übersicht ("Alles für Alle") -->
        <div class="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-[11px]">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <span>✨ 3-Teile Menü (Alles für Alle):</span>
          </div>
          <div class="grid grid-cols-1 gap-1 text-[10px]">
            <div class="text-slate-300 flex items-center space-x-1">
              <span class="text-emerald-400 font-bold">1. Basis:</span>
              <span>${day.title} (für alle ${totalPersons} Port. inkl. Reste)</span>
            </div>
            <div class="text-slate-300 flex items-center space-x-1 flex-wrap">
              <span class="text-amber-400 font-bold">2. Proteine:</span>
              ${
                meatEaters.length > 0
                  ? `<span class="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 mr-1">🥩 Speck / Steak (${meatEaters.map(m=>m.name).join(', ')})</span>`
                  : ""
              }
              ${
                vegiEaters.length > 0
                  ? `<span class="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mr-1">🧀 Halloumi / Bergkäse (${vegiEaters.map(m=>m.name).join(', ')})</span>`
                  : ""
              }
              ${
                veganEaters.length > 0
                  ? `<span class="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 mr-1">🌱 Vegan-Käse / Pesto (${veganEaters.map(m=>m.name).join(', ')})</span>`
                  : ""
              }
            </div>
            <div class="text-slate-300 flex items-center space-x-1">
              <span class="text-cyan-400 font-bold">3. Beilage:</span>
              <span>Schweizer Nüsslisalat / Frisches Saisongemüse</span>
            </div>
          </div>
        </div>

        <!-- Personen & Reste-Verteilung -->
        <div class="pt-1.5 border-t border-slate-800/80 space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-400 font-medium flex items-center space-x-1">
              <i data-lucide="users" class="w-3 h-3 text-emerald-400"></i>
              <span>Wer isst heute mit?</span>
            </span>
            <div class="flex items-center space-x-1 text-[10px] text-slate-300">
              <span class="font-bold text-white">${eatersCount}</span> Esser
              <span>+</span>
              <span class="text-amber-300 font-bold">${buffer} Reste</span>
              <span>=</span>
              <span class="font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">${totalPersons} Port.</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            ${state.members.map(mem => {
              const isAttending = day.eaters && day.eaters.includes(mem.id);
              return `
                <button class="grid-eater-chip text-[10px] px-2 py-0.5 rounded-lg border transition font-medium ${
                  isAttending
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-800/60 text-slate-500 border-slate-700/40 line-through opacity-60'
                }" data-day-idx="${idx}" data-member-id="${mem.id}">
                  ${isAttending ? '✓' : '–'} ${mem.name} (${mem.diet.substring(0,3).toUpperCase()})
                </button>
              `;
            }).join("")}

            <!-- Reste-Puffer Regler (+2 Standard) -->
            <div class="ml-auto flex items-center space-x-1 bg-slate-800/80 border border-slate-700/60 rounded-lg px-1.5 py-0.5 text-[10px]">
              <span class="text-slate-400">🍲 Reste:</span>
              <button class="grid-buffer-btn text-slate-300 hover:text-white px-1 font-bold" data-day-idx="${idx}" data-delta="-1" title="Reste-Portionen verringern">–</button>
              <span class="font-bold text-amber-300 px-0.5">+${buffer}</span>
              <button class="grid-buffer-btn text-slate-300 hover:text-white px-1 font-bold" data-day-idx="${idx}" data-delta="1" title="Reste-Portionen erhöhen">+</button>
            </div>
          </div>
        </div>
      `;

      weekCardsContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();

    // Event Handlers for Grid Card Actions
    weekCardsContainer.querySelectorAll(".grid-eater-chip").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const mId = btn.getAttribute("data-member-id");
        const day = state.weekPlan[dIdx];
        if (!day) return;
        if (!day.eaters) day.eaters = [];
        if (day.eaters.includes(mId)) {
          day.eaters = day.eaters.filter(id => id !== mId);
        } else {
          day.eaters.push(mId);
        }
        day.effective_diet = calculateEffectiveDiet(day.eaters);
        savePlan();
        renderWeekGrid();
        renderAttendanceMatrix();
        updateShoppingList();
      };
    });

    weekCardsContainer.querySelectorAll(".grid-buffer-btn").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const delta = parseInt(btn.getAttribute("data-delta"), 10);
        const day = state.weekPlan[dIdx];
        if (!day) return;
        if (day.leftover_buffer === undefined) day.leftover_buffer = 2;
        day.leftover_buffer = Math.max(0, day.leftover_buffer + delta);
        savePlan();
        renderWeekGrid();
        updateShoppingList();
      };
    });

    weekCardsContainer.querySelectorAll(".grid-shuffle-btn").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const day = state.weekPlan[dIdx];
        if (!day) return;
        const targetDiet = day.effective_diet || state.diet;
        const pool = getRecipesPool(targetDiet);
        if (pool.length > 0) {
          const rec = pool[Math.floor(Math.random() * pool.length)];
          state.weekPlan[dIdx] = {
            ...rec,
            day: DAYS[dIdx],
            eaters: day.eaters,
            leftover_buffer: day.leftover_buffer,
            extra_guests: day.extra_guests,
            effective_diet: day.effective_diet,
            person_count: day.person_count,
            cook_assigned: day.cook_assigned
          };
          savePlan();
          renderWeekGrid();
          updateShoppingList();
        }
      };
    });

    weekCardsContainer.querySelectorAll(".grid-cook-btn").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const day = state.weekPlan[dIdx];
        if (!day) return;
        const cook = prompt(`Wer kocht am ${DAYS[dIdx]}?`, day.cook_assigned || (state.members[0] ? state.members[0].name : "Ich"));
        if (cook !== null) {
          day.cook_assigned = cook.trim() || null;
          savePlan();
          renderWeekGrid();
        }
      };
    });

    weekCardsContainer.querySelectorAll(".grid-pick-menu-btn").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        openMenuCatalogModal(dIdx);
      };
    });

    weekCardsContainer.querySelectorAll(".grid-detail-btn").forEach(btn => {
      btn.onclick = () => {
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        state.activeDayIndex = dIdx;
        setViewMode("single");
      };
    });
  }

  // Menü-Katalog Modal Logic
  let catalogTargetDayIdx = 0;
  let catalogFilter = "all";

  const allMenusModal = document.getElementById("allMenusModal");
  const closeAllMenusModalBtn = document.getElementById("closeAllMenusModalBtn");
  const openAllMenusBtn = document.getElementById("openAllMenusBtn");
  const menuCatalogSearch = document.getElementById("menuCatalogSearch");

  if (openAllMenusBtn) {
    openAllMenusBtn.onclick = () => openMenuCatalogModal(state.activeDayIndex || 0);
  }

  if (closeAllMenusModalBtn && allMenusModal) {
    closeAllMenusModalBtn.onclick = () => allMenusModal.classList.add("hidden");
  }

  if (menuCatalogSearch) {
    menuCatalogSearch.oninput = () => renderMenuCatalogList();
  }

  const catalogFilterBtns = document.querySelectorAll(".catalog-filter-btn");
  catalogFilterBtns.forEach(btn => {
    btn.onclick = () => {
      catalogFilterBtns.forEach(b => {
        b.className = "catalog-filter-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold";
      });
      btn.className = "catalog-filter-btn px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold active";
      catalogFilter = btn.getAttribute("data-filter");
      renderMenuCatalogList();
    };
  });

  function openMenuCatalogModal(targetDayIdx = 0) {
    catalogTargetDayIdx = targetDayIdx;
    if (!allMenusModal) return;

    const allMenusSubtitle = document.getElementById("allMenusSubtitle");
    if (allMenusSubtitle) {
      allMenusSubtitle.textContent = `Wähle ein Menü für ${DAYS[targetDayIdx]} oder einen anderen Tag`;
    }

    renderMenuCatalogList();
    allMenusModal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  }

  function renderMenuCatalogList() {
    const list = document.getElementById("menuCatalogList");
    if (!list) return;

    const searchTerm = menuCatalogSearch ? menuCatalogSearch.value.toLowerCase().trim() : "";
    const allRecipes = getRecipesPool();

    list.innerHTML = "";

    const filtered = allRecipes.filter(r => {
      if (catalogFilter === "vegi" && r.diet !== "vegi" && r.diet !== "vegan") return false;
      if (catalogFilter === "vegan" && r.diet !== "vegan") return false;
      if (catalogFilter === "schweizerisch" && r.category !== "schweizerisch") return false;
      if (catalogFilter === "fleisch" && r.diet !== "fleisch") return false;
      if (catalogFilter === "links" && !r.source_url) return false;

      if (searchTerm) {
        const matchTitle = (r.title || "").toLowerCase().includes(searchTerm);
        const matchIng = (r.ingredients || []).some(i => (i.name || "").toLowerCase().includes(searchTerm));
        if (!matchTitle && !matchIng) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">Keine Rezepte gefunden.</div>`;
      return;
    }

    filtered.forEach(rec => {
      const card = document.createElement("div");
      card.className = "p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-2 hover:border-slate-600 transition";

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-xs font-bold text-white">${rec.title}</h4>
            <div class="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
              <span class="text-emerald-400 font-mono uppercase">${rec.diet || 'vegi'}</span>
              <span>⏱️ ${rec.prep_time_min || 30} Min.</span>
              <span>💰 CHF ${rec.cost_per_person_chf || '2.80'}/P.</span>
            </div>
          </div>
          ${
            rec.source_url
              ? `<a href="${rec.source_url}" target="_blank" rel="noopener" class="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-lg flex-shrink-0" title="Rezept im Browser öffnen">
                   <i data-lucide="external-link" class="w-3 h-3"></i>
                   <span>Browser</span>
                 </a>`
              : ""
          }
        </div>

        <div class="pt-1 flex items-center justify-between border-t border-slate-700/60 text-[10px]">
          <span class="text-slate-400">Auf Tag legen:</span>
          <div class="flex space-x-1">
            ${DAYS.map((d, dIdx) => `
              <button class="assign-recipe-day-btn w-6 h-6 rounded-lg font-bold text-[10px] transition ${
                dIdx === catalogTargetDayIdx
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-700 hover:bg-slate-650 text-slate-200'
              }" data-recipe-id="${rec.id}" data-day-idx="${dIdx}" title="Als ${d} kochen">
                ${d.substring(0,2)}
              </button>
            `).join("")}
          </div>
        </div>
      `;

      list.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();

    list.querySelectorAll(".assign-recipe-day-btn").forEach(btn => {
      btn.onclick = () => {
        const rId = btn.getAttribute("data-recipe-id");
        const dIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const chosen = allRecipes.find(r => r.id === rId);
        if (!chosen) return;

        const currentDay = state.weekPlan[dIdx] || {};
        state.weekPlan[dIdx] = {
          ...chosen,
          day: DAYS[dIdx],
          eaters: currentDay.eaters || state.members.map(m => m.id),
          leftover_buffer: currentDay.leftover_buffer !== undefined ? currentDay.leftover_buffer : 2,
          extra_guests: currentDay.extra_guests || 0,
          effective_diet: currentDay.effective_diet || calculateEffectiveDiet(currentDay.eaters),
          person_count: currentDay.person_count || 5,
          cook_assigned: currentDay.cook_assigned || null
        };

        savePlan();
        renderWeekGrid();
        renderActiveCard();
        updateShoppingList();

        if (allMenusModal) allMenusModal.classList.add("hidden");
        alert(`✅ "${chosen.title}" wurde für ${DAYS[dIdx]} eingeplant!`);
      };
    });
  }

  // Modal: Menü via Web-Link hinzufügen Logic
  const openAddRecipeLinkBtn = document.getElementById("openAddRecipeLinkBtn");
  const addRecipeLinkModal = document.getElementById("addRecipeLinkModal");
  const closeAddRecipeLinkModalBtn = document.getElementById("closeAddRecipeLinkModalBtn");
  const newRecipeUrlInput = document.getElementById("newRecipeUrlInput");
  const analyzeUrlBtn = document.getElementById("analyzeUrlBtn");
  const newRecipeTitleInput = document.getElementById("newRecipeTitleInput");
  const newRecipeDietSelect = document.getElementById("newRecipeDietSelect");
  const newRecipeDaySelect = document.getElementById("newRecipeDaySelect");
  const newRecipeIngredientsInput = document.getElementById("newRecipeIngredientsInput");
  const saveNewRecipeLinkBtn = document.getElementById("saveNewRecipeLinkBtn");

  if (openAddRecipeLinkBtn && addRecipeLinkModal) {
    openAddRecipeLinkBtn.onclick = () => {
      addRecipeLinkModal.classList.remove("hidden");
      if (newRecipeUrlInput) newRecipeUrlInput.focus();
    };
  }

  if (closeAddRecipeLinkModalBtn && addRecipeLinkModal) {
    closeAddRecipeLinkModalBtn.onclick = () => addRecipeLinkModal.classList.add("hidden");
  }

  if (analyzeUrlBtn) {
    analyzeUrlBtn.onclick = () => {
      const url = newRecipeUrlInput ? newRecipeUrlInput.value.trim() : "";
      if (!url) {
        alert("Bitte zuerst eine Rezept-URL eingeben!");
        return;
      }
      if (window.recipeImporter) {
        const res = window.recipeImporter.analyzeRecipeUrl(url);
        if (newRecipeTitleInput) newRecipeTitleInput.value = res.title;
      }
    };
  }

  if (saveNewRecipeLinkBtn) {
    saveNewRecipeLinkBtn.onclick = () => {
      const url = newRecipeUrlInput ? newRecipeUrlInput.value.trim() : "";
      let title = newRecipeTitleInput ? newRecipeTitleInput.value.trim() : "";
      const diet = newRecipeDietSelect ? newRecipeDietSelect.value : "vegi";
      const ings = newRecipeIngredientsInput ? newRecipeIngredientsInput.value.trim() : "";
      const dayIdx = newRecipeDaySelect ? parseInt(newRecipeDaySelect.value, 10) : -1;

      if (!title && !url) {
        alert("Bitte mindestens einen Titel oder eine Web-URL angeben!");
        return;
      }

      let newRecipe;
      if (window.recipeImporter) {
        newRecipe = window.recipeImporter.createRecipeFromUrl(url, title, ings, diet);
      } else {
        newRecipe = {
          id: "custom-" + Date.now(),
          title: title || "Web-Rezept",
          source_url: url,
          diet: diet,
          ingredients: []
        };
      }

      if (dayIdx >= 0 && dayIdx < 7) {
        const cur = state.weekPlan[dayIdx] || {};
        state.weekPlan[dayIdx] = {
          ...newRecipe,
          day: DAYS[dayIdx],
          eaters: cur.eaters || state.members.map(m => m.id),
          leftover_buffer: cur.leftover_buffer !== undefined ? cur.leftover_buffer : 2,
          extra_guests: cur.extra_guests || 0,
          effective_diet: cur.effective_diet || calculateEffectiveDiet(cur.eaters),
          person_count: cur.person_count || 5,
          cook_assigned: cur.cook_assigned || null
        };
      }

      savePlan();
      renderWeekGrid();
      renderActiveCard();
      updateShoppingList();

      if (addRecipeLinkModal) addRecipeLinkModal.classList.add("hidden");
      if (newRecipeUrlInput) newRecipeUrlInput.value = "";
      if (newRecipeTitleInput) newRecipeTitleInput.value = "";
      if (newRecipeIngredientsInput) newRecipeIngredientsInput.value = "";

      alert(`🎉 Rezept "${newRecipe.title}" gespeichert${dayIdx >= 0 ? ` und ${DAYS[dayIdx]} zugewiesen` : ''}!`);
    };
  }

  // 4. Einkaufsliste aggregieren, mit Bring! abgleichen & Grundvorrat filtern (Tag-genau skaliert + 3 Komponenten!)
  function updateShoppingList() {
    const aggregated = {};

    // Aktive Grundzutaten-Keywords ermitteln
    const activeStapleKeywords = [];
    state.pantryStaples.forEach(st => {
      if (st.in_stock !== false) {
        (st.keywords || [st.name.toLowerCase()]).forEach(kw => activeStapleKeywords.push(kw.toLowerCase()));
      }
    });

    function addAggregatedItem(name, unit, amt, bringCat) {
      if (!name || amt <= 0) return;
      const key = `${name.toLowerCase()}___${(unit || "").toLowerCase()}`;
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
          unit: unit || "",
          bring_cat: bringCat || "Sonstiges",
          isStaple: isStaple,
          isOnBring: isOnBring,
          status: status,
          checked: false
        };
      }
    }

    state.weekPlan.forEach(day => {
      // Skalierung nach Esser-Anzahl dieses einzelnen Tages + Reste-Puffer (+2 standardmäßig)!
      const attendingMembers = state.members.filter(m => day.eaters && day.eaters.includes(m.id));
      const eatersCount = attendingMembers.length;
      const buffer = (day.leftover_buffer !== undefined ? day.leftover_buffer : 2);
      const guests = (day.extra_guests || 0);
      const dayPersons = eatersCount + guests + buffer || 4;
      const dayScale = dayPersons / 2;

      // 1. Basis-Zutaten für alle (skaliert für Esser + Reste-Puffer)
      (day.ingredients || []).forEach(ing => {
        const amt = parseFloat(ing.amount || "1") * dayScale;
        addAggregatedItem(ing.name.trim(), (ing.unit || "").trim(), amt, ing.bring_cat);
      });

      // 2. Modulare Proteine / Toppings ("Alles für Alle"):
      const meatEaters = attendingMembers.filter(m => m.diet === "fleisch").length;
      const vegiEaters = attendingMembers.filter(m => m.diet === "vegi").length;
      const veganEaters = attendingMembers.filter(m => m.diet === "vegan").length;

      // Fleisch-Variante (z.B. Speck / Rindssteak für Lukas)
      if (meatEaters > 0) {
        addAggregatedItem("Schweizer Speckwürfeli / Rindssteak", "g", 150 * meatEaters, "Fleisch & Fisch");
      }
      // Vegi-Variante (z.B. Halloumi / Bergkäse für Jonas)
      if (vegiEaters > 0) {
        addAggregatedItem("Schweizer Grillkäse / Halloumi", "g", 100 * vegiEaters, "Milch & Käse");
      }
      // Vegan-Variante (z.B. Veganer Reibkäse / Pesto / Tofu für Anna)
      if (veganEaters > 0) {
        addAggregatedItem("Veganer Reibkäse-Ersatz / Pesto", "Portion", veganEaters, "Milch & Käse");
      }

      // 3. Frische Beilage (Teil 3 des Menüs: Frischer Schweizer Salat)
      addAggregatedItem("Schweizer Nüsslisalat / Frischer Salat", "g", 50 * dayPersons, "Obst & Gemüse");
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
  async function performBringSync() {
    if (!isBringConnected) {
      openBringModal();
      showBringFeedback("Bitte verbinde zuerst deinen Bring!-Account mit E-Mail & Passwort oder Bearer-Token!", false);
      return;
    }

    const itemsToExport = state.shoppingList.filter(it => !it.isOnBring && (!it.isStaple || !state.excludeStaples));
    if (itemsToExport.length === 0) {
      alert("Alles bereits erledigt! Alle Zutaten sind entweder schon auf Bring! oder als Grundvorrat zuhause vorhanden.");
      return;
    }
    if (syncBtnText) syncBtnText.textContent = "Wird übertragen...";
    try {
      const res = await fetch("/api/bring/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToExport })
      });
      const data = await res.json();
      if (data.success) {
        if (syncBtnText) syncBtnText.textContent = `✅ ${itemsToExport.length} Artikel exportiert!`;
        alert(`🎉 Erfolg! ${itemsToExport.length} fehlende Zutaten wurden direkt in deine Bring!-Liste übertragen.`);
        checkBringStatus();
      } else {
        if (syncBtnText) syncBtnText.textContent = "Fehler beim Export";
        alert(`Bring! Fehler: ${data.errors ? data.errors.join(', ') : 'Synchronisation fehlgeschlagen'}`);
      }
    } catch (e) {
      if (syncBtnText) syncBtnText.textContent = "Verbindungsfehler";
      alert("Verbindungsfehler beim Synchronisieren zu Bring!");
    }
    setTimeout(() => {
      if (syncBtnText) syncBtnText.textContent = "Nach Bring! (Nur Fehlendes)";
    }, 3000);
  }

  if (syncToBringBtn) {
    syncToBringBtn.onclick = () => performBringSync();
  }

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

  const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const syncSeasonMonthBtn = document.getElementById("syncSeasonMonthBtn");
  const seasonCurrentMonthBadge = document.getElementById("seasonCurrentMonthBadge");
  const seasonLastSyncTime = document.getElementById("seasonLastSyncTime");

  async function syncSeasonalMonth(targetMonth = null, showNotification = false) {
    const realCalendarMonth = new Date().getMonth() + 1;
    const month = targetMonth ? parseInt(targetMonth, 10) : realCalendarMonth;

    if (seasonMonthSelect) {
      seasonMonthSelect.value = month.toString();
    }
    if (seasonCurrentMonthBadge) {
      seasonCurrentMonthBadge.textContent = MONTH_NAMES[month - 1];
    }
    if (seasonLastSyncTime) {
      const dateStr = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
      seasonLastSyncTime.textContent = `Sync: ${dateStr} ✓`;
    }

    loadMonthSeason(month);

    localStorage.setItem("bringfrisch_current_synced_month", month.toString());
    localStorage.setItem("bringfrisch_season_synced_at", new Date().toISOString());

    // Online-Sync Endpunkt prüfen falls Server läuft
    try {
      const res = await fetch("/api/season/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: month })
      });
      const data = await res.json();
      if (data && data.success && data.news) {
        if (seasonNewsHeadline) seasonNewsHeadline.textContent = data.news.headline;
        if (seasonNewsTip) seasonNewsTip.textContent = data.news.farmer_tip;
      }
    } catch (e) {
      // Offline fallback: standalone_data.js greift zuverlässig
    }

    if (showNotification) {
      alert(`🌱 Saisongemüse für Monat ${MONTH_NAMES[month - 1]} erfolgreich synchronisiert!\n\nAktuelle Schweizer Freiland- & Lager-Gemüsesorten sowie Ernte-News sind jetzt geladen.`);
    }
  }

  if (syncSeasonMonthBtn) {
    syncSeasonMonthBtn.onclick = () => syncSeasonalMonth(null, true);
  }

  if (seasonMonthSelect) {
    seasonMonthSelect.onchange = (e) => syncSeasonalMonth(e.target.value, false);
  }

  // Automatischer Monats-Sync beim Start: Ermittelt den echten aktuellen Kalendermonat
  const savedSyncedMonth = parseInt(localStorage.getItem("bringfrisch_current_synced_month") || "0", 10);
  const realCurrentMonth = new Date().getMonth() + 1;
  syncSeasonalMonth(savedSyncedMonth || realCurrentMonth, false);

  // Regionale Märkte & Hofläden (Wetzikon, Rapperswil, Uster)
  const seasonSubTabVegetables = document.getElementById("seasonSubTabVegetables");
  const seasonSubTabMarkets = document.getElementById("seasonSubTabMarkets");
  const seasonVegetablesView = document.getElementById("seasonVegetablesView");
  const seasonMarketsView = document.getElementById("seasonMarketsView");
  const marketRegionPills = document.getElementById("marketRegionPills");
  const regionalMarketsList = document.getElementById("regionalMarketsList");

  let activeMarketRegion = "all";

  function switchSeasonSubTab(tab) {
    if (tab === "vegetables") {
      seasonSubTabVegetables.className = "flex-1 py-1.5 px-2 rounded-lg bg-emerald-500 text-slate-950 font-bold transition shadow-sm";
      seasonSubTabMarkets.className = "flex-1 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white font-medium transition";
      seasonVegetablesView.classList.remove("hidden");
      seasonMarketsView.classList.add("hidden");
    } else {
      seasonSubTabMarkets.className = "flex-1 py-1.5 px-2 rounded-lg bg-emerald-500 text-slate-950 font-bold transition shadow-sm";
      seasonSubTabVegetables.className = "flex-1 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white font-medium transition";
      seasonVegetablesView.classList.add("hidden");
      seasonMarketsView.classList.remove("hidden");
      renderRegionalMarkets();
    }
  }

  if (seasonSubTabVegetables) seasonSubTabVegetables.onclick = () => switchSeasonSubTab("vegetables");
  if (seasonSubTabMarkets) seasonSubTabMarkets.onclick = () => switchSeasonSubTab("markets");

  function renderRegionalMarkets() {
    if (!regionalMarketsList) return;
    const regionalData = (window.BRINGFRISCH_DATA && window.BRINGFRISCH_DATA.regional_markets) || [];

    // Region Pills aufbauen
    if (marketRegionPills) {
      marketRegionPills.innerHTML = "";
      const allRegions = [{ region: "Alle", id: "all" }, ...regionalData.map(r => ({ region: r.region.split("&")[0].trim(), id: r.region }))];
      
      allRegions.forEach(r => {
        const pill = document.createElement("button");
        const isActive = activeMarketRegion === r.id;
        pill.className = `px-2.5 py-1 rounded-xl whitespace-nowrap transition font-semibold text-xs border ${
          isActive
            ? "bg-amber-400 text-slate-950 border-amber-400 shadow-sm"
            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
        }`;
        pill.textContent = r.region;
        pill.onclick = () => {
          activeMarketRegion = r.id;
          renderRegionalMarkets();
        };
        marketRegionPills.appendChild(pill);
      });
    }

    // Märkte-Karten aufbauen
    regionalMarketsList.innerHTML = "";
    regionalData.forEach(reg => {
      if (activeMarketRegion !== "all" && activeMarketRegion !== reg.region) return;

      const sectionTitle = document.createElement("div");
      sectionTitle.className = "flex items-center space-x-1.5 text-xs font-bold text-slate-300 pt-1";
      sectionTitle.innerHTML = `<span>${reg.icon || '📍'}</span> <span>${reg.region}</span>`;
      regionalMarketsList.appendChild(sectionTitle);

      (reg.markets || []).forEach(m => {
        const card = document.createElement("div");
        card.className = "p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-sm";
        
        let typeBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        if (m.type.includes("Bio")) typeBadgeColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
        if (m.type.includes("Finder")) typeBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";

        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold border ${typeBadgeColor}">${m.type}</span>
              <h4 class="text-xs font-bold text-white mt-1">${m.name}</h4>
              <p class="text-[11px] text-slate-400 mt-0.5">${m.location}</p>
            </div>
          </div>
          
          <div class="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] space-y-1">
            <div class="text-amber-300 font-semibold flex items-center space-x-1">
              <span>🕒</span> <span>${m.schedule}</span>
            </div>
            <p class="text-slate-300">${m.highlights}</p>
          </div>

          <div class="flex items-center space-x-2 pt-0.5">
            <a href="${m.maps_url}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center justify-center space-x-1 transition">
              <span>📍 Route auf Maps</span>
            </a>
            <a href="${m.website}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40 text-[11px] font-semibold flex items-center justify-center space-x-1 transition">
              <span>🌐 Info</span>
            </a>
          </div>
        `;
        regionalMarketsList.appendChild(card);
      });
    });
  }

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

  // Mitbewohner & Diäten verwalten UI (Tab 6)
  const membersListContainer = document.getElementById("membersListContainer");
  const addMemberBtn = document.getElementById("addMemberBtn");

  function renderMembersManager() {
    if (!membersListContainer) return;
    membersListContainer.innerHTML = "";

    state.members.forEach((mem, idx) => {
      const card = document.createElement("div");
      card.className = "flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60";
      
      let dietBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      if (mem.diet === "vegan") dietBadgeColor = "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      if (mem.diet === "fleisch") dietBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";

      card.innerHTML = `
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
            ${mem.name.charAt(0)}
          </div>
          <span class="text-xs font-bold text-white">${mem.name}</span>
          <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${dietBadgeColor}">${mem.diet}</span>
        </div>
        <div class="flex items-center space-x-1.5">
          <select class="diet-select bg-slate-900 border border-slate-700 text-[11px] text-slate-300 rounded-lg px-2 py-1 focus:outline-none" data-idx="${idx}">
            <option value="vegi" ${mem.diet === "vegi" ? "selected" : ""}>Vegi</option>
            <option value="vegan" ${mem.diet === "vegan" ? "selected" : ""}>Vegan</option>
            <option value="fleisch" ${mem.diet === "fleisch" ? "selected" : ""}>Mit Fleisch</option>
            <option value="schweizerisch" ${mem.diet === "schweizerisch" ? "selected" : ""}>Schweizerisch</option>
          </select>
          <button class="delete-member-btn text-slate-500 hover:text-red-400 p-1" data-idx="${idx}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      membersListContainer.appendChild(card);
    });

    membersListContainer.querySelectorAll(".diet-select").forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        state.members[idx].diet = e.target.value;
        saveMembers();
        renderMembersManager();
        renderAttendanceMatrix();
        renderActiveCard();
        updateShoppingList();
      };
    });

    membersListContainer.querySelectorAll(".delete-member-btn").forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (state.members.length <= 1) {
          alert("Mindestens ein Mitbewohner muss vorhanden sein!");
          return;
        }
        state.members.splice(idx, 1);
        saveMembers();
        renderMembersManager();
        renderAttendanceMatrix();
        renderActiveCard();
        updateShoppingList();
      };
    });

    if (window.lucide) lucide.createIcons();
  }

  if (addMemberBtn) {
    addMemberBtn.onclick = () => {
      const name = prompt("Name des Mitbewohners:", "Sarah");
      if (!name) return;
      const diet = prompt("Ernährungsform (vegi, vegan, fleisch, schweizerisch):", "vegi") || "vegi";
      state.members.push({
        id: "m-" + Date.now(),
        name: name.trim(),
        diet: diet.toLowerCase().trim()
      });
      saveMembers();
      renderMembersManager();
      renderAttendanceMatrix();
      renderActiveCard();
      updateShoppingList();
    };
  }

  // Interaktive Wochen-Anwesenheit & Diät-Matrix Tabelle
  const attendanceMatrixTable = document.getElementById("attendanceMatrixTable");

  function renderAttendanceMatrix() {
    if (!attendanceMatrixTable) return;
    attendanceMatrixTable.innerHTML = "";

    // Sicherstellen, dass jeder Tag im weekPlan die Esser-Liste hat
    state.weekPlan.forEach((day, dIdx) => {
      if (!day.eaters) {
        day.eaters = state.members.map(m => m.id);
      }
    });

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr class="text-slate-400 border-b border-slate-800">
        <th class="py-2 px-2 text-left font-semibold">Mitbewohner</th>
        <th class="py-2 px-1 text-center font-semibold">Mo</th>
        <th class="py-2 px-1 text-center font-semibold">Di</th>
        <th class="py-2 px-1 text-center font-semibold">Mi</th>
        <th class="py-2 px-1 text-center font-semibold">Do</th>
        <th class="py-2 px-1 text-center font-semibold">Fr</th>
        <th class="py-2 px-1 text-center font-semibold">Sa</th>
        <th class="py-2 px-1 text-center font-semibold">So</th>
      </tr>
    `;
    attendanceMatrixTable.appendChild(thead);

    const tbody = document.createElement("tbody");
    tbody.className = "divide-y divide-slate-800/60";

    // Eine Zeile pro Mitbewohner
    state.members.forEach((mem) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-900/50 transition";

      let dietColor = "text-emerald-400";
      if (mem.diet === "vegan") dietColor = "text-cyan-400";
      if (mem.diet === "fleisch") dietColor = "text-amber-400";

      let tdHtml = `
        <td class="py-2 px-2 text-left">
          <div class="flex items-center space-x-1.5">
            <span class="font-bold text-slate-200">${mem.name}</span>
            <span class="text-[9px] font-mono px-1 py-0.2 rounded border border-slate-700/60 ${dietColor}">${mem.diet.substring(0,3).toUpperCase()}</span>
          </div>
        </td>
      `;

      // 7 Spalten für Mo bis So
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayPlan = state.weekPlan[dayIdx];
        const isAttending = dayPlan && dayPlan.eaters && dayPlan.eaters.includes(mem.id);

        tdHtml += `
          <td class="py-1.5 px-0.5 text-center">
            <button class="matrix-toggle-btn w-6 h-6 rounded-lg font-bold text-xs transition inline-flex items-center justify-center ${
              isAttending
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-slate-800/80 text-slate-600 hover:text-slate-400"
            }" data-member-id="${mem.id}" data-day-idx="${dayIdx}" title="${mem.name} am ${DAYS[dayIdx]} ${isAttending ? 'dabei' : 'abwesend'}">
              ${isAttending ? "✓" : "–"}
            </button>
          </td>
        `;
      }
      tr.innerHTML = tdHtml;
      tbody.appendChild(tr);
    });

    // Zusammenfassungs-Zeile: Diät & Anzahl Esser
    const summaryTr = document.createElement("tr");
    summaryTr.className = "bg-slate-900/80 font-bold border-t border-slate-700/80 text-[10px]";
    let summaryHtml = `<td class="py-2 px-2 text-left text-slate-400">Total / Diät</td>`;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayPlan = state.weekPlan[dayIdx];
      const count = (dayPlan && dayPlan.eaters ? dayPlan.eaters.length : 0) + (dayPlan && dayPlan.extra_guests ? dayPlan.extra_guests : 0);
      const diet = dayPlan ? (dayPlan.effective_diet || "vegi").substring(0, 3).toUpperCase() : "VEG";

      let dietColor = "text-emerald-400";
      if (diet === "VEG" && dayPlan && dayPlan.effective_diet === "vegan") dietColor = "text-cyan-400";
      if (diet === "FLE") dietColor = "text-amber-400";

      summaryHtml += `
        <td class="py-1.5 px-0.5 text-center">
          <div class="flex flex-col items-center">
            <span class="text-white">${count}P</span>
            <span class="${dietColor} text-[8px] font-mono">${diet}</span>
          </div>
        </td>
      `;
    }
    summaryTr.innerHTML = summaryHtml;
    tbody.appendChild(summaryTr);

    attendanceMatrixTable.appendChild(tbody);

    // Klick-Handler für Matrix Checkboxen
    attendanceMatrixTable.querySelectorAll(".matrix-toggle-btn").forEach(btn => {
      btn.onclick = () => {
        const memId = btn.getAttribute("data-member-id");
        const dayIdx = parseInt(btn.getAttribute("data-day-idx"), 10);
        const dayPlan = state.weekPlan[dayIdx];
        if (!dayPlan) return;

        if (!dayPlan.eaters) dayPlan.eaters = [];
        if (dayPlan.eaters.includes(memId)) {
          dayPlan.eaters = dayPlan.eaters.filter(id => id !== memId);
        } else {
          dayPlan.eaters.push(memId);
        }

        dayPlan.effective_diet = calculateEffectiveDiet(dayPlan.eaters);
        dayPlan.person_count = dayPlan.eaters.length + (dayPlan.extra_guests || 0);

        savePlan();
        renderAttendanceMatrix();
        renderActiveCard();
        updateShoppingList();
      };
    });
  }

  // Dezentraler P2P / Mesh Sync via URL-Hash
  const shareP2pPlanBtn = document.getElementById("shareP2pPlanBtn");
  if (shareP2pPlanBtn) {
    shareP2pPlanBtn.onclick = () => {
      try {
        const payload = {
          v: 1,
          wgId: state.wgId,
          members: state.members,
          weekPlan: state.weekPlan,
          ts: Date.now()
        };
        const jsonStr = JSON.stringify(payload);
        const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
        const baseUrl = window.location.href.split("#")[0];
        const shareUrl = `${baseUrl}#plan=${encodeURIComponent(base64Data)}`;

        if (navigator.share) {
          navigator.share({
            title: `BringFrisch WG-Plan (${state.wgId})`,
            text: `Hier ist unser aktueller Wochen- und Einkaufsplan für die WG!`,
            url: shareUrl
          }).catch(() => {
            navigator.clipboard.writeText(shareUrl);
            alert("🔗 Plan-Link erfolgreich in die Zwischenablage kopiert!\n\nSende den Link per WhatsApp/Signal an deine Mitbewohner. Wenn sie den Link öffnen, wird die WG-Woche auf ihren Handys synchronisiert.");
          });
        } else {
          navigator.clipboard.writeText(shareUrl);
          alert("🔗 Plan-Link erfolgreich in die Zwischenablage kopiert!\n\nSende den Link per WhatsApp/Signal an deine Mitbewohner. Wenn sie den Link öffnen, wird die WG-Woche auf ihren Handys synchronisiert.");
        }
      } catch (err) {
        console.error("P2P share error", err);
        alert("Fehler beim Erstellen des Sharing-Links: " + err.message);
      }
    };
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
