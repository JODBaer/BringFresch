// Obsonare: Eigene Rezepte (von Hand oder mit Link einer Rezeptseite), bearbeiten, löschen

const UNIT_PATTERN = "kg|g|dl|ml|cl|l|el|tl|stk|stück|bund|prise|glas|dose|becher|pck|packung|tranchen|kopf|rolle|zehe|zehen|portion";

class RecipeImporter {
  constructor() {
    this.customRecipesKey = "bringfrisch_custom_recipes";
    this.customRecipes = this.loadCustomRecipes();
  }

  loadCustomRecipes() {
    try {
      const raw = localStorage.getItem(this.customRecipesKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Eigene Rezepte konnten nicht geladen werden", e);
      return [];
    }
  }

  saveCustomRecipes() {
    localStorage.setItem(this.customRecipesKey, JSON.stringify(this.customRecipes));
  }

  // Erkennt die Supermarkt-Abteilung grob am Namen
  guessCategory(name) {
    const n = name.toLowerCase();
    if (/rüebli|lauch|kartoffel|wirz|salat|zwiebel|kürbis|gemüse|tomate|pilz|randen|sellerie|knoblauch|apfel|zitrone|kräuter|petersilie|spinat|kohl|fenchel|zucchetti|peperoni/.test(n)) return "Obst & Gemüse";
    if (/käse|quark|milch|butter|rahm|joghurt|\bei\b|eier|mozzarella|feta|halloumi/.test(n)) return "Milch & Käse";
    if (/fleisch|hack|schinken|poulet|rind|speck|wurst|lachs|fisch|kalb|schwein/.test(n)) return "Fleisch & Fisch";
    if (/brot|teig|zopf/.test(n)) return "Brot & Gebäck";
    if (/nudel|teigwaren|pasta|spaghetti|hörnli|reis|mehl|linse|bohne|kichererbse|dose|polenta|couscous/.test(n)) return "Vorrat & Konserven";
    return "Sonstiges";
  }

  // "500 g Kartoffeln" / "2 Stk Zwiebeln" / "1 Bund Schnittlauch" / "Salz"
  parseIngredients(text) {
    const re = new RegExp(`^([0-9]+(?:[.,][0-9]+)?)?\\s*(?:(${UNIT_PATTERN})\\.?\\s+)?(.+)$`, "i");
    return (text || "")
      .split("\n")
      .map(l => l.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean)
      .map(line => {
        const m = line.match(re);
        const amount = m && m[1] ? m[1].replace(",", ".") : "1";
        const unit = m && m[2] ? m[2] : "Stk";
        const name = (m && m[3] ? m[3] : line).trim();
        return { name, amount, unit, bring_cat: this.guessCategory(name) };
      });
  }

  // Leitet aus einer Rezept-URL einen lesbaren Titel ab
  analyzeRecipeUrl(url) {
    if (!url) return { title: "", domain: "" };
    try {
      const u = new URL(url.trim());
      const domain = u.hostname.replace(/^www\./, "");
      const segments = u.pathname.split("/").filter(s => s && s.length > 2 && !/^(de|fr|it|en|rezepte|rezept|showrezept|recipes|rezepte-kochideen)$/i.test(s));
      let candidate = "";
      if (segments.length > 0) {
        candidate = segments[segments.length - 1]
          .replace(/\.(html|php|asp)$/i, "")
          .replace(/^[A-Z0-9_-]{8,}[-_]/i, "");
        candidate = decodeURIComponent(candidate).replace(/[-_]+/g, " ").trim();
        candidate = candidate.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
      if (!candidate || candidate.length < 3 || /^[A-Z0-9 ]+$/.test(candidate)) candidate = `Rezept von ${domain}`;
      return { title: candidate, domain };
    } catch (e) {
      return { title: "", domain: "" };
    }
  }

  // shared: für alle WGs sichtbar (Standard). Nur «false» wird gespeichert (fehlt = geteilt).
  createCustomRecipe({ title, url = "", diet = "vegi", servings = 4, ingredientsText = "", instructions = "", shared = true }) {
    const cleanUrl = (url || "").trim();
    const recipe = {
      id: "custom-" + Date.now(),
      title: (title || "").trim() || this.analyzeRecipeUrl(cleanUrl).title || "Eigenes Rezept",
      category: "eigenes",
      diet,
      servings: Math.max(1, parseInt(servings, 10) || 4),
      prep_time_min: 30,
      ingredients: this.parseIngredients(ingredientsText),
      instructions: instructions.trim(),
      season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      is_custom: true
    };
    if (shared === false) recipe.shared = false;
    if (cleanUrl) recipe.source_url = cleanUrl;
    // gleicher Link nochmals geholt -> bestehendes Rezept aktualisieren statt doppelt
    const same = cleanUrl && this.customRecipes.find(r => r.source_url === cleanUrl);
    if (same) return this.updateCustomRecipe(same.id, { title, url: cleanUrl, diet, servings, ingredientsText, instructions, shared });
    this.customRecipes.push(recipe);
    this.saveCustomRecipes();
    return recipe;
  }

  updateCustomRecipe(id, { title, url = "", diet = "vegi", servings = 4, ingredientsText = "", instructions = "", shared = true }) {
    const r = this.customRecipes.find(x => x.id === id);
    if (!r) return null;
    const cleanUrl = (url || "").trim();
    Object.assign(r, {
      title: (title || "").trim() || r.title,
      diet,
      servings: Math.max(1, parseInt(servings, 10) || r.servings || 4),
      ingredients: this.parseIngredients(ingredientsText),
      instructions: (instructions || "").trim(),
    });
    if (cleanUrl) r.source_url = cleanUrl; else delete r.source_url;
    if (shared === false) r.shared = false; else delete r.shared;
    this.saveCustomRecipes();
    return r;
  }

  // Zutaten zurück in Text (zum Bearbeiten): «500 g Lauch»
  ingredientsToText(ingredients) {
    return (ingredients || []).map(i => [i.amount && !(i.amount === "1" && i.unit === "Stk" && !/^\d/.test(i.name)) ? i.amount : "", i.unit && i.unit !== "Stk" ? i.unit : (i.amount && i.amount !== "1" ? "Stk" : ""), i.name].filter(Boolean).join(" ")).join("\n");
  }

  deleteCustomRecipe(id) {
    this.customRecipes = this.customRecipes.filter(r => r.id !== id);
    this.saveCustomRecipes();
  }
}

window.recipeImporter = new RecipeImporter();
