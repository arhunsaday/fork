import type { Ingredient, RecipeData, Step } from "./schema";

/**
 * Turns the recipe's step graph into a Cooking-for-Engineers style grid.
 *
 * Columns: [qty] [ingredient] [step level 1] … [step level H]
 * Each step cell spans the rows of every ingredient that (transitively) feeds
 * it, and stretches leftwards to fill the gap up to its inputs, so the table
 * has no holes. Steps without ingredients (preheat oven, …) become full-width
 * "setup" rows above the grid.
 */

export type TableCell =
  | { kind: "blank"; row: number; col: number; colSpan: number; rowSpan: 1 }
  | { kind: "ingredient"; ingredient: Ingredient; row: number; col: number; colSpan: number; rowSpan: 1 }
  | { kind: "step"; step: Step; index: number; row: number; col: number; colSpan: number; rowSpan: number };

export type RecipeTable = {
  /** Ingredient rows in display order (null = spacer row for an ingredient-less step). */
  rows: (Ingredient | null)[];
  /** Number of step columns (excluding qty + ingredient columns). */
  levels: number;
  cells: TableCell[];
  /** Steps that don't consume ingredients/steps and aren't consumed (setup). */
  setup: { step: Step; index: number }[];
  /** For hover highlighting: node id → set of ingredient + step ids upstream of it. */
  upstream: Map<string, Set<string>>;
};

type Node = { id: string; kind: "ing" | "step"; children: string[] };

export function buildTable(recipe: Pick<RecipeData, "ingredients" | "steps">): RecipeTable {
  const ingById = new Map(recipe.ingredients.map((i) => [i.id, i]));
  const stepById = new Map(recipe.steps.map((s) => [s.id, s]));
  const stepIndex = new Map(recipe.steps.map((s, i) => [s.id, i]));

  // Build a tree: each node is claimed by its first consumer only.
  const claimed = new Set<string>();
  const nodes = new Map<string, Node>();
  for (const i of recipe.ingredients) nodes.set(i.id, { id: i.id, kind: "ing", children: [] });
  for (const s of recipe.steps) nodes.set(s.id, { id: s.id, kind: "step", children: [] });

  for (const s of recipe.steps) {
    const node = nodes.get(s.id)!;
    for (const input of s.inputs ?? []) {
      if (input === s.id || claimed.has(input)) continue;
      if (!ingById.has(input) && !stepById.has(input)) continue;
      // Only allow consuming earlier steps to avoid cycles.
      if (stepById.has(input) && (stepIndex.get(input)! >= stepIndex.get(s.id)!)) continue;
      node.children.push(input);
      claimed.add(input);
    }
  }

  // Roots are unclaimed steps. Unclaimed ingredients get attached to the last root.
  const roots = recipe.steps.filter((s) => !claimed.has(s.id)).map((s) => s.id);
  const setup: RecipeTable["setup"] = [];
  const treeRoots: string[] = [];
  for (const r of roots) {
    const n = nodes.get(r)!;
    if (n.children.length === 0) setup.push({ step: stepById.get(r)!, index: stepIndex.get(r)! });
    else treeRoots.push(r);
  }
  const orphanIngs = recipe.ingredients.filter((i) => !claimed.has(i.id));

  // Height (levels from leaves).
  const heightMemo = new Map<string, number>();
  const height = (id: string): number => {
    if (heightMemo.has(id)) return heightMemo.get(id)!;
    const n = nodes.get(id)!;
    const h = n.kind === "ing" ? 0 : 1 + Math.max(0, ...n.children.map(height));
    heightMemo.set(id, h);
    return h;
  };
  const levels = Math.max(1, ...treeRoots.map(height));

  const rows: (Ingredient | null)[] = [];
  const cells: TableCell[] = [];
  const upstream = new Map<string, Set<string>>();

  // Columns: 0 = qty, 1 = ingredient, 2..levels+1 = steps.
  const STEP0 = 2;

  // Returns [rowStart, rowCount] for the subtree.
  const place = (id: string, colEnd: number): [number, number] => {
    const n = nodes.get(id)!;
    if (n.kind === "ing") {
      const row = rows.length;
      rows.push(ingById.get(id)!);
      cells.push({ kind: "ingredient", ingredient: ingById.get(id)!, row, col: 1, colSpan: colEnd - 1 + 1, rowSpan: 1 });
      upstream.set(id, new Set([id]));
      return [row, 1];
    }
    const h = height(id);
    const colStart = STEP0 + h - 1;
    const set = new Set<string>([id]);
    // Ingredients first (closer to the top, like CFE), then sub-steps.
    const kids = [...n.children].sort((a, b) => {
      const ka = nodes.get(a)!.kind === "ing" ? 1 : 0;
      const kb = nodes.get(b)!.kind === "ing" ? 1 : 0;
      if (ka !== kb) return ka - kb; // sub-steps first: their ingredients were prepared earlier
      return 0;
    });
    let start = -1;
    let count = 0;
    for (const k of kids) {
      const [s, c] = place(k, colStart - 1);
      if (start < 0) start = s;
      count += c;
      upstream.get(k)?.forEach((x) => set.add(x));
    }
    if (start < 0) {
      // Ingredient-less step inside the tree (e.g. "preheat" consumed by "bake").
      start = rows.length;
      rows.push(null);
      cells.push({ kind: "blank", row: start, col: 0, colSpan: colStart, rowSpan: 1 });
      count = 1;
    }
    upstream.set(id, set);
    cells.push({
      kind: "step",
      step: stepById.get(id)!,
      index: stepIndex.get(id)!,
      row: start,
      col: colStart,
      colSpan: colEnd - colStart + 1,
      rowSpan: Math.max(1, count),
    });
    return [start, count];
  };

  const lastCol = STEP0 + levels - 1;
  treeRoots.forEach((r, i) => {
    const before = rows.length;
    const [, count] = place(r, lastCol);
    // Attach orphan ingredients to the final tree, as extra rows with an empty step span.
    if (i === treeRoots.length - 1 && orphanIngs.length) {
      for (const ing of orphanIngs) {
        const row = rows.length;
        rows.push(ing);
        cells.push({ kind: "ingredient", ingredient: ing, row, col: 1, colSpan: lastCol, rowSpan: 1 });
        upstream.set(ing.id, new Set([ing.id]));
      }
    }
    void before;
    void count;
  });
  if (treeRoots.length === 0) {
    for (const ing of orphanIngs) {
      const row = rows.length;
      rows.push(ing);
      cells.push({ kind: "ingredient", ingredient: ing, row, col: 1, colSpan: lastCol, rowSpan: 1 });
      upstream.set(ing.id, new Set([ing.id]));
    }
  }

  return { rows, levels, cells, setup, upstream };
}

/** Downstream map: for each node, which steps eventually consume it. */
export function downstreamOf(recipe: Pick<RecipeData, "steps">): Map<string, Set<string>> {
  const consumers = new Map<string, string[]>();
  for (const s of recipe.steps) for (const i of s.inputs ?? []) {
    if (!consumers.has(i)) consumers.set(i, []);
    consumers.get(i)!.push(s.id);
  }
  const memo = new Map<string, Set<string>>();
  const walk = (id: string): Set<string> => {
    if (memo.has(id)) return memo.get(id)!;
    const set = new Set<string>();
    memo.set(id, set);
    for (const c of consumers.get(id) ?? []) {
      set.add(c);
      walk(c).forEach((x) => set.add(x));
    }
    return set;
  };
  const all = new Map<string, Set<string>>();
  for (const s of recipe.steps) all.set(s.id, walk(s.id));
  return all;
}

/**
 * Critical-path schedule: earliest start for each step given its inputs, so the
 * timeline view can show what can happen in parallel.
 */
export function schedule(recipe: Pick<RecipeData, "steps">): { id: string; start: number; end: number }[] {
  const byId = new Map(recipe.steps.map((s) => [s.id, s]));
  const end = new Map<string, number>();
  const out: { id: string; start: number; end: number }[] = [];
  for (const s of recipe.steps) {
    const start = Math.max(0, ...(s.inputs ?? []).filter((i) => byId.has(i)).map((i) => end.get(i) ?? 0));
    const dur = s.minutes ?? 2;
    end.set(s.id, start + dur);
    out.push({ id: s.id, start, end: start + dur });
  }
  return out;
}
