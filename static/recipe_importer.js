// BringFrisch: Rezept-Importer & Foto-Erfassung
// Wandelt Fotos von Kochbüchern / Menükarten oder Rezept-URLs in swipebare Wochentagskarten um.

class RecipeImporter {
  constructor() {
    this.customRecipesKey = "bringfrisch_custom_recipes";
    this.customRecipes = this.loadCustomRecipes();
  }

  loadCustomRecipes() {
    const raw = localStorage.getItem(this.customRecipesKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn("Custom recipes load error", e);
      }
    }
    return [];
  }

  saveCustomRecipes() {
    localStorage.setItem(this.customRecipesKey, JSON.stringify(this.customRecipes));
  }

  /**
   * Erstellt ein Wochentagsrezept aus einem abfotografierten Text oder einer Notiz.
   */
  createRecipeFromText(title, rawIngredientsText, instructions = "", diet = "vegi", costEstimate = 3.50) {
    const lines = rawIngredientsText.split("\n").map(l => l.trim()).filter(Boolean);
    const ingredients = [];

    lines.forEach(line => {
      // Regex für Mengen wie 500g, 2 Stk, 1 dl, etc.
      const match = line.match(/^([0-9.,]+)?\s*(g|kg|dl|ml|el|tl|stk|bund|prise|glas|dose)?\s*(.+)$/i);
      if (match) {
        const amount = match[1] || "1";
        const unit = match[2] || "Stk";
        const name = match[3] || line;
        
        let bring_cat = "Sonstiges";
        const lowerName = name.toLowerCase();
        if (/rüebli|lauch|kartoffel|wirz|salat|zwiebel|kürbis|gemüse|tomate|pilz/i.test(lowerName)) {
          bring_cat = "Obst & Gemüse";
        } else if (/käse|quark|milch|butter|rahm|joghurt|ei/i.test(lowerName)) {
          bring_cat = "Milch & Käse";
        } else if (/fleisch|hack|schinken|poulet|rind/i.test(lowerName)) {
          bring_cat = "Fleisch & Fisch";
        } else if (/brot|teig/i.test(lowerName)) {
          bring_cat = "Brot & Gebäck";
        } else if (/nudel|teigwaren|reis|mehl|linse/i.test(lowerName)) {
          bring_cat = "Vorrat & Konserven";
        }

        ingredients.push({
          name: name.trim(),
          amount: amount.trim(),
          unit: unit.trim(),
          bring_cat: bring_cat
        });
      } else {
        ingredients.push({
          name: line,
          amount: "1",
          unit: "Stk",
          bring_cat: "Sonstiges"
        });
      }
    });

    const newRecipe = {
      id: "custom-" + Date.now(),
      title: title || "Foto-Rezept (Kochbuch / Menü)",
      category: "schweizerisch",
      diet: diet,
      prep_time_min: 30,
      cost_per_person_chf: parseFloat(costEstimate) || 3.50,
      primary_vegetables: ["Saisongemüse nach Wahl"],
      ingredients: ingredients,
      instructions: instructions || "Nach Kochbuch-/Foto-Anleitung zubereiten.",
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      health_tip: "Eigenes Lieblingsrezept aus Kochbuch / Menükarte."
    };

    this.customRecipes.push(newRecipe);
    this.saveCustomRecipes();
    return newRecipe;
  }
}

window.recipeImporter = new RecipeImporter();
