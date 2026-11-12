// Geteilte Rezepte: alle WGs greifen auf denselben Bestand zu. Eigene Rezepte einer WG sind standardmässig für alle
// sichtbar (shared !== false, abwählbar im Rezept). Was gemocht wird (Wochenwahl, Rangliste), bleibt pro WG.
// Gespeichert im gemeinsamen Speicher (RAW, ohne WG-Präfix): shared:<slug> = { name, recipes, updated }, Liste der
// WGs mit geteilten Rezepten unter shared:index. Jede WG schreibt nur ihren eigenen Eintrag (kein Überschreiben fremder).
// Nur Fakten: Titel, Ernährung, Personen, Zeit, Zutaten, Saison, Link, eigene Zubereitung.

const MAX_RECIPES = 300;

function clean(r) {
  if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.id || typeof r.title !== "string") return null;
  const out = {
    id: r.id.slice(0, 60),
    title: r.title.slice(0, 120),
    diet: ["vegi", "fleisch", "vegan"].includes(r.diet) ? r.diet : "vegi",
    servings: Math.min(20, Math.max(1, parseInt(r.servings, 10) || 4)),
    prep_time_min: Math.min(600, Math.max(0, parseInt(r.prep_time_min, 10) || 30)),
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 60)
      .filter(i => i && typeof i.name === "string")
      .map(i => ({ name: i.name.slice(0, 80), amount: String(i.amount ?? "").slice(0, 20), unit: String(i.unit ?? "").slice(0, 20) })),
    season_months: (Array.isArray(r.season_months) ? r.season_months : []).filter(m => Number.isInteger(m) && m >= 1 && m <= 12),
  };
  if (!out.season_months.length) out.season_months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (typeof r.source_url === "string" && /^https:\/\//.test(r.source_url)) out.source_url = r.source_url.slice(0, 500);
  if (typeof r.instructions === "string" && r.instructions.trim()) out.instructions = r.instructions.slice(0, 4000);
  return out;
}

// Welche Rezepte dieser WG gehen an alle? (aus den WG-Einstellungen)
export const shareable = settings =>
  ((settings && Array.isArray(settings.customRecipes)) ? settings.customRecipes : [])
    .filter(r => r && r.shared !== false).map(clean).filter(Boolean).slice(0, MAX_RECIPES);

// Nach dem Speichern der Einstellungen: eigenen Eintrag nachführen (nur schreiben, wenn sich etwas geändert hat)
export async function publishShared(env, settings) {
  const wg = env.WG_CTX, key = `shared:${wg.slug}`;
  const recipes = shareable(settings);
  const cur = await env.RAW.get(key, "json");
  if (!cur || cur.name !== wg.name || JSON.stringify(cur.recipes) !== JSON.stringify(recipes)) {
    await env.RAW.put(key, JSON.stringify({ name: wg.name, recipes, updated: Date.now() }));
  }
  const index = (await env.RAW.get("shared:index", "json")) || [];
  if (!index.includes(wg.slug)) await env.RAW.put("shared:index", JSON.stringify([...index, wg.slug]));
}

// Rezepte der anderen WGs. Eigene stehen schon in den Einstellungen und kommen nicht doppelt.
// Ids bekommen den WG-Kurznamen vorne (x-<wg>-<id>), damit sie nie mit eigenen Rezepten zusammenfallen.
// Herkunft wird nicht angezeigt (Entscheid docs/plan-d1.md: geteilte Rezepte zeigen schlicht «geteilt»).
export async function getShared(env) {
  const wg = env.WG_CTX;
  const index = (await env.RAW.get("shared:index", "json")) || [];
  if (!index.includes(wg.slug)) { // WG hat schon Rezepte, aber seit dem Update noch nie gespeichert -> jetzt eintragen
    const own = await env.WG.get("settings", "json");
    if (own && own.settings && shareable(own.settings).length) await publishShared(env, own.settings);
  }
  const others = index.filter(s => s !== wg.slug);
  const entries = await Promise.all(others.map(async s => [s, await env.RAW.get(`shared:${s}`, "json")]));
  const recipes = [];
  for (const [s, e] of entries) {
    if (!e || !Array.isArray(e.recipes)) continue;
    for (const r of e.recipes) recipes.push({ ...r, id: `x-${s}-${r.id}`, shared_from: true });
  }
  return { recipes };
}
