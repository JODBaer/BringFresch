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

  /**
   * Analysiert eine Rezept-URL (Betty Bossi, Swissmilk, Fooby, Chefkoch, etc.)
   * und leitet daraus Domain und einen sauberen Rezepttitel ab.
   */
  analyzeRecipeUrl(url) {
    if (!url) return { title: "", domain: "" };
    try {
      const u = new URL(url.trim());
      const domain = u.hostname.replace(/^www\./, "");
      const segments = u.pathname.split("/").filter(s => s && s.length > 2 && !/^(de|fr|it|en|rezepte|rezept|showrezept|recipes)$/i.test(s));
      
      let candidate = "";
      if (segments.length > 0) {
        candidate = segments[segments.length - 1];
        // Dateiendungen wie .html entfernen
        candidate = candidate.replace(/\.(html|php|asp)$/i, "");
        // Typische IDs / Hash-Prefixe entfernen (z.B. BB_KUCA130802_0060A-40-de-lauch-waehe)
        candidate = candidate.replace(/^[A-Z0-9_-]{8,}[-_]/i, "");
        // Trennzeichen ersetzen
        candidate = decodeURIComponent(candidate).replace(/[-_]+/g, " ").trim();
        // Groß-/Kleinschreibung formatieren
        candidate = candidate.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }

      if (!candidate || candidate.length < 3) {
        candidate = `Rezept (${domain})`;
      }

      return { title: candidate, domain: domain };
    } catch (e) {
      return { title: "Web-Rezept", domain: "" };
    }
  }

  /**
   * Erstellt ein Rezept aus einer Web-URL und speichert den Link für den Browser.
   */
  createRecipeFromUrl(url, title, rawIngredientsText = "", diet = "vegi", costEstimate = 3.50) {
    let cleanTitle = title;
    if (!cleanTitle && url) {
      const analysis = this.analyzeRecipeUrl(url);
      cleanTitle = analysis.title;
    }
    if (!cleanTitle) cleanTitle = "Web-Rezept aus Browser";

    const recipe = this.createRecipeFromText(cleanTitle, rawIngredientsText, "Zubereitung siehe Originalrezept im Browser.", diet, costEstimate);
    recipe.source_url = url.trim();
    recipe.is_web_recipe = true;
    recipe.health_tip = `Direkt verlinkt mit Rezeptseite (${url ? new URL(url).hostname : 'Web'}).`;
    this.saveCustomRecipes();
    return recipe;
  }

  deleteCustomRecipe(id) {
    this.customRecipes = this.customRecipes.filter(r => r.id !== id);
    this.saveCustomRecipes();
  }
}

window.recipeImporter = new RecipeImporter();


