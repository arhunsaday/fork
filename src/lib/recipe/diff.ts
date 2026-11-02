import { diffWords } from "diff";
import type { Ingredient, RecipeData, Step } from "./schema";
import { formatAmount } from "./units";

/**
 * Structural diff between two recipe snapshots. Ingredients and steps are
 * matched by id first (edits keep ids), then by normalised name/text so
 * imported or AI-rewritten recipes still line up.
 */

export type FieldChange = { field: string; before: string; after: string };

export type IngredientChange =
  | { type: "added"; after: Ingredient }
  | { type: "removed"; before: Ingredient }
  | { type: "changed"; before: Ingredient; after: Ingredient; fields: string[] }
  | { type: "same"; after: Ingredient };

export type StepChange =
  | { type: "added"; after: Step; index: number }
  | { type: "removed"; before: Step; index: number }
  | { type: "changed"; before: Step; after: Step; index: number; words: { value: string; added?: boolean; removed?: boolean }[] }
  | { type: "same"; after: Step; index: number };

export type RecipeDiff = {
  meta: FieldChange[];
  ingredients: IngredientChange[];
  steps: StepChange[];
  stats: { additions: number; deletions: number; changes: number };
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function matchBy<T extends { id: string }>(before: T[], after: T[], key: (t: T) => string) {
  const pairs = new Map<string, T>(); // after.id -> before
  const usedBefore = new Set<string>();
  const beforeById = new Map(before.map((b) => [b.id, b]));
  for (const a of after) {
    const b = beforeById.get(a.id);
    if (b) {
      pairs.set(a.id, b);
      usedBefore.add(b.id);
    }
  }
  for (const a of after) {
    if (pairs.has(a.id)) continue;
    const b = before.find((x) => !usedBefore.has(x.id) && key(x) === key(a));
    if (b) {
      pairs.set(a.id, b);
      usedBefore.add(b.id);
    }
  }
  return { pairs, usedBefore };
}

export function amountString(i: Ingredient) {
  return formatAmount({ qty: i.qty, qtyMax: i.qtyMax, unit: i.unit });
}

export function diffRecipes(before: RecipeData, after: RecipeData): RecipeDiff {
  const meta: FieldChange[] = [];
  const cmp = (field: string, b: unknown, a: unknown) => {
    const bs = Array.isArray(b) ? b.join(", ") : b == null ? "" : String(b);
    const as = Array.isArray(a) ? a.join(", ") : a == null ? "" : String(a);
    if (bs !== as) meta.push({ field, before: bs, after: as });
  };
  cmp("title", before.title, after.title);
  cmp("description", before.description, after.description);
  cmp("category", before.category, after.category);
  cmp("servings", before.servings, after.servings);
  cmp("prep", before.prepMinutes, after.prepMinutes);
  cmp("cook", before.cookMinutes, after.cookMinutes);
  cmp("equipment", before.equipment, after.equipment);
  cmp("tags", before.tags, after.tags);
  cmp("notes", before.notes, after.notes);

  // Ingredients
  const ingMatch = matchBy(before.ingredients, after.ingredients, (i) => norm(i.name));
  const ingredients: IngredientChange[] = [];
  for (const a of after.ingredients) {
    const b = ingMatch.pairs.get(a.id);
    if (!b) {
      ingredients.push({ type: "added", after: a });
      continue;
    }
    const fields: string[] = [];
    if (norm(a.name) !== norm(b.name)) fields.push("name");
    if (amountString(a) !== amountString(b)) fields.push("amount");
    if ((a.note ?? "") !== (b.note ?? "")) fields.push("note");
    ingredients.push(fields.length ? { type: "changed", before: b, after: a, fields } : { type: "same", after: a });
  }
  // Insert removals near their original position.
  before.ingredients.forEach((b, idx) => {
    if (ingMatch.usedBefore.has(b.id)) return;
    ingredients.splice(Math.min(idx, ingredients.length), 0, { type: "removed", before: b });
  });

  // Steps
  const stepMatch = matchBy(before.steps, after.steps, (s) => norm(s.text));
  const steps: StepChange[] = [];
  after.steps.forEach((a, index) => {
    const b = stepMatch.pairs.get(a.id);
    if (!b) return steps.push({ type: "added", after: a, index });
    if (b.text !== a.text || b.action !== a.action || (b.minutes ?? null) !== (a.minutes ?? null)) {
      const words = diffWords(b.text, a.text).map((p) => ({ value: p.value, added: p.added, removed: p.removed }));
      return steps.push({ type: "changed", before: b, after: a, index, words });
    }
    steps.push({ type: "same", after: a, index });
  });
  before.steps.forEach((b, idx) => {
    if (stepMatch.usedBefore.has(b.id)) return;
    steps.splice(Math.min(idx, steps.length), 0, { type: "removed", before: b, index: idx });
  });

  const count = (t: string) =>
    ingredients.filter((c) => c.type === t).length + steps.filter((c) => c.type === t).length;
  return {
    meta,
    ingredients,
    steps,
    stats: {
      additions: count("added"),
      deletions: count("removed"),
      changes: count("changed") + meta.length,
    },
  };
}

export function isEmptyDiff(d: RecipeDiff) {
  return d.stats.additions + d.stats.deletions + d.stats.changes === 0;
}

/**
 * Apply a partial selection of a diff: start from `before` and only take the
 * accepted ingredient / step changes from `after`. Used by the AI suggestion
 * review UI where each row can be toggled.
 */
export function applySelected(
  before: RecipeData,
  after: RecipeData,
  diff: RecipeDiff,
  accepted: Set<string>,
): RecipeData {
  const keyOfIng = (c: IngredientChange) => (c.type === "removed" ? `i-${c.before.id}` : `i-${c.after.id}`);
  const keyOfStep = (c: StepChange) => (c.type === "removed" ? `s-${c.before.id}` : `s-${c.after.id}`);

  const ingredients: Ingredient[] = [];
  for (const c of diff.ingredients) {
    const on = accepted.has(keyOfIng(c));
    if (c.type === "same") ingredients.push(c.after);
    else if (c.type === "added" && on) ingredients.push(c.after);
    else if (c.type === "removed" && !on) ingredients.push(c.before);
    else if (c.type === "changed") ingredients.push(on ? c.after : c.before);
  }
  const steps: Step[] = [];
  for (const c of diff.steps) {
    const on = accepted.has(keyOfStep(c));
    if (c.type === "same") steps.push(c.after);
    else if (c.type === "added" && on) steps.push(c.after);
    else if (c.type === "removed" && !on) steps.push(c.before);
    else if (c.type === "changed") steps.push(on ? c.after : c.before);
  }
  const ids = new Set([...ingredients.map((i) => i.id), ...steps.map((s) => s.id)]);
  const metaOn = accepted.has("meta");
  const base = metaOn ? after : before;
  return {
    ...base,
    ingredients,
    steps: steps.map((s) => ({ ...s, inputs: (s.inputs ?? []).filter((i) => ids.has(i)) })),
  };
}

export function diffKeys(d: RecipeDiff): string[] {
  const keys: string[] = [];
  if (d.meta.length) keys.push("meta");
  for (const c of d.ingredients) if (c.type !== "same") keys.push(c.type === "removed" ? `i-${c.before.id}` : `i-${c.after.id}`);
  for (const c of d.steps) if (c.type !== "same") keys.push(c.type === "removed" ? `s-${c.before.id}` : `s-${c.after.id}`);
  return keys;
}
