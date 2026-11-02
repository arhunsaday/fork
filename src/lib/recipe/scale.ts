import type { Ingredient, RecipeData } from "./schema";
import { toGrams } from "./units";

/** Multiply every quantity by `factor`. */
export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (factor === 1) return ing;
  return {
    ...ing,
    qty: ing.qty == null ? null : ing.qty * factor,
    qtyMax: ing.qtyMax == null ? ing.qtyMax : ing.qtyMax * factor,
  };
}

export function totalMassGrams(recipe: Pick<RecipeData, "ingredients">): number | null {
  let sum = 0;
  let known = 0;
  for (const i of recipe.ingredients) {
    if (i.qty == null) continue;
    const g = toGrams(i.qty, i.unit, i.name);
    if (g != null) {
      sum += g;
      known++;
    }
  }
  return known ? sum : null;
}

const FLOUR_RE = /\b(flour|farine|mehl|semolina|masa harina)\b/i;
const WATER_RE = /\b(water|milk|buttermilk|eau)\b/i;

/**
 * Baker's percentages relative to total flour weight.
 * Returns null if the recipe has no weighable flour.
 */
export function bakersPercentages(recipe: Pick<RecipeData, "ingredients">) {
  const grams = new Map<string, number>();
  let flour = 0;
  let water = 0;
  for (const i of recipe.ingredients) {
    if (i.qty == null) continue;
    const g = toGrams(i.qty, i.unit, i.name);
    if (g == null) continue;
    grams.set(i.id, g);
    if (FLOUR_RE.test(i.name) && !/dust/i.test(i.note ?? "")) flour += g;
    if (WATER_RE.test(i.name)) water += /milk/i.test(i.name) ? g * 0.87 : g;
  }
  if (!flour) return null;
  const pct = new Map<string, number>();
  grams.forEach((g, id) => pct.set(id, (g / flour) * 100));
  return { flourGrams: flour, hydration: (water / flour) * 100, pct };
}
