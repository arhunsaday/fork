import type { RecipeData } from "./schema";

const STOP = new Set(["fresh", "large", "small", "medium", "ripe", "very", "unsalted", "salted", "whole", "ground", "fine", "finely", "chopped", "dark", "light", "extra", "virgin", "all-purpose", "purpose", "granulated", "plain", "and", "or", "of", "the", "for", "sea", "kosher", "raw", "cold", "warm", "hot"]);

export function keywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));
}

/** Does the pantry contain something matching this ingredient? (all significant pantry keywords present) */
export function pantryHas(pantry: string[], ingredient: string): boolean {
  const ik = new Set(keywords(ingredient));
  if (!ik.size) return false;
  // water and salt are assumed
  if (ik.has("water")) return true;
  return pantry.some((p) => {
    const pk = keywords(p);
    return pk.length > 0 && pk.every((k) => ik.has(k));
  });
}

export function coverage(recipe: Pick<RecipeData, "ingredients" | "equipment">, pantry: string[], equipment: string[]) {
  const have = recipe.ingredients.filter((i) => pantryHas(pantry, i.name));
  const missing = recipe.ingredients.filter((i) => !pantryHas(pantry, i.name));
  const eqHave = recipe.equipment.filter((e) => pantryHas(equipment, e));
  const eqMissing = recipe.equipment.filter((e) => !pantryHas(equipment, e));
  const pct = recipe.ingredients.length ? have.length / recipe.ingredients.length : 0;
  return { have, missing, eqHave, eqMissing, pct };
}
