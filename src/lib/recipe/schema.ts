import { z } from "zod";

/**
 * The canonical recipe document. Every commit stores one of these as a JSON
 * snapshot, so diffs between versions / forks are computed from two RecipeData
 * values.
 *
 * Steps form a graph: each step lists the ingredient ids and/or previous step
 * ids it consumes (`inputs`). That graph is what powers the Cooking-for-Engineers
 * style table, the timeline and the "what feeds into what" highlighting.
 */

export const CATEGORIES = [
  "meal",
  "baking",
  "bread",
  "pastry",
  "dessert",
  "sauce",
  "drink",
  "preserve",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  meal: "Meals",
  baking: "Baking",
  bread: "Bread",
  pastry: "Pâtisserie",
  dessert: "Desserts",
  sauce: "Sauces",
  drink: "Drinks",
  preserve: "Preserves",
  other: "Other",
};

/** Categories where baker's percentages are shown by default. */
export const BAKERS_CATEGORIES: Category[] = ["baking", "bread", "pastry"];

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  qty: z.number().nullable(),
  /** Upper bound for ranges like "2-3 eggs". */
  qtyMax: z.number().nullable().optional(),
  unit: z.string().nullable(),
  note: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const stepSchema = z.object({
  id: z.string(),
  /** Short imperative label used in the table, e.g. "Cream", "Fold in". */
  action: z.string(),
  /** Full instruction text. */
  text: z.string(),
  /** Ingredient ids and/or step ids consumed by this step. */
  inputs: z.array(z.string()).default([]),
  /** Active/passive time for the step in minutes. */
  minutes: z.number().nullable().optional(),
  temperature: z
    .object({ value: z.number(), unit: z.enum(["C", "F"]) })
    .nullable()
    .optional(),
});
export type Step = z.infer<typeof stepSchema>;

export const recipeDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  category: z.enum(CATEGORIES).default("meal"),
  tags: z.array(z.string()).default([]),
  servings: z.number().positive().default(4),
  yieldLabel: z.string().nullable().optional(),
  prepMinutes: z.number().nullable().optional(),
  cookMinutes: z.number().nullable().optional(),
  equipment: z.array(z.string()).default([]),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  notes: z.string().nullable().optional(),
  source: z
    .object({ url: z.string().nullable().optional(), name: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
export type RecipeData = z.infer<typeof recipeDataSchema>;

export function emptyRecipe(): RecipeData {
  return {
    title: "",
    description: "",
    category: "meal",
    tags: [],
    servings: 4,
    yieldLabel: null,
    prepMinutes: null,
    cookMinutes: null,
    equipment: [],
    ingredients: [],
    steps: [],
    notes: null,
    source: null,
  };
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "recipe"
  );
}

let counter = 0;
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}${counter.toString(36)}`;
}
