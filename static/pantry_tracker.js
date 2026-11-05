// BringFrisch: Vorrats- & Tiefkühler-Gedächtnis («Haben wir noch altes Hackfleisch?»)
// Läuft 100% lokal im Browser (localStorage)

class PantryTracker {
  constructor() {
    this.storageKey = "bringfrisch_freezer_pantry";
    this.items = this.loadItems();
  }

  loadItems() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn("Pantry load error", e);
      }
    }
    // Standard-Einträge für Demo (z.B. Hackfleisch vor 25 Tagen eingefroren)
    const twentyFiveDaysAgo = new Date(Date.now() - 25 * 86400000).toISOString().split("T")[0];
    const twelveDaysAgo = new Date(Date.now() - 12 * 86400000).toISOString().split("T")[0];
    return [
      {
        id: "hackfleisch-1",
        name: "Schweizer Rindshackfleisch",
        amount: "500 g",
        frozenDate: twentyFiveDaysAgo,
        category: "Fleisch & Fisch",
        location: "Tiefkühler",
        suggestedRecipeId: "ghackets_hoernli",
        warningDays: 20
      },
      {
        id: "lauch-vorrat",
        name: "Lauchstangen (geputzt & geschnitten)",
        amount: "300 g",
        frozenDate: twelveDaysAgo,
        category: "Obst & Gemüse",
        location: "Tiefkühler",
        suggestedRecipeId: "lauch_waehe",
        warningDays: 30
      }
    ];
  }

  saveItems() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
  }

  addItem(name, amount, dateStr, location = "Tiefkühler", suggestedRecipeId = null) {
    const item = {
      id: "item-" + Date.now(),
      name,
      amount: amount || "1 Portion",
      frozenDate: dateStr || new Date().toISOString().split("T")[0],
      location,
      suggestedRecipeId
    };
    this.items.push(item);
    this.saveItems();
    return item;
  }

  removeItem(id) {
    this.items = this.items.filter(it => it.id !== id);
    this.saveItems();
  }

  getAlerts() {
    const now = new Date();
    const alerts = [];
    this.items.forEach(it => {
      const frozen = new Date(it.frozenDate);
      const diffTime = Math.abs(now - frozen);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Warnung ab 14 Tagen für Fleisch/Fisch, sonst ab 21 Tagen
      const threshold = it.category === "Fleisch & Fisch" ? 14 : 21;
      if (diffDays >= threshold) {
        alerts.push({
          item: it,
          daysOld: diffDays,
          message: `🚨 ${it.name} (${it.amount}) liegt seit ${diffDays} Tagen im ${it.location}!`,
          suggestedRecipeId: it.suggestedRecipeId
        });
      }
    });
    return alerts;
  }
}

window.pantryTracker = new PantryTracker();

