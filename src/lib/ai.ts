import "server-only";
import { z } from "zod";
import type { LanguageModel } from "ai";
import { CATEGORIES, recipeDataSchema, type RecipeData } from "@/lib/recipe/schema";

/**
 * Provider selection, in priority order:
 *   ANTHROPIC_API_KEY  → Claude (default model: claude-sonnet-5-5)
 *   OPENAI_API_KEY     → OpenAI (default model: gpt-5-mini)
 *   AI_GATEWAY_API_KEY → Vercel AI Gateway (default: anthropic/claude-sonnet-5.5)
 * Override the model id with AI_MODEL.
 */
export function aiProvider(): "anthropic" | "openai" | "gateway" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.AI_GATEWAY_API_KEY) return "gateway";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

export async function getModel(): Promise<LanguageModel> {
  const p = aiProvider();
  if (p === "anthropic") {
    const { anthropic } = await import("@ai-sdk/anthropic");
    return anthropic(process.env.AI_MODEL ?? "claude-sonnet-5-5");
  }
  if (p === "openai") {
    const { openai } = await import("@ai-sdk/openai");
    return openai(process.env.AI_MODEL ?? "gpt-5-mini");
  }
  if (p === "gateway") {
    const { gateway } = await import("ai");
    return gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5");
  }
  throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.");
}

/**
 * LLM-facing schema: every field required (nullable instead of optional) so it
 * works with strict structured-output modes on every provider.
 */
export const llmRecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe("1–2 sentence summary in the author's voice"),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()).describe("3–6 lowercase kebab-case tags"),
  servings: z.number(),
  yieldLabel: z.string().nullable().describe('e.g. "1 loaf", "24 cookies"'),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  equipment: z.array(z.string()),
  ingredients: z.array(
    z.object({
      id: z.string().describe("stable id: keep existing ids; new ones like i1, i2…"),
      name: z.string().describe("ingredient name only, lowercase unless proper noun"),
      qty: z.number().nullable(),
      qtyMax: z.number().nullable().describe("upper bound for ranges, else null"),
      unit: z.string().nullable().describe("g, kg, ml, l, tsp, tbsp, cup, oz, lb, pinch, clove, can… or null for countables"),
      note: z.string().nullable().describe('prep note e.g. "melted", "finely chopped"'),
      group: z.string().nullable().describe('sub-recipe group e.g. "dough", "filling"'),
    }),
  ),
  steps: z.array(
    z.object({
      id: z.string().describe("stable id: keep existing ids; new ones like s1, s2…"),
      action: z.string().describe('1–2 word imperative label for a table cell, e.g. "Cream", "Fold in", "Bake"'),
      text: z.string(),
      inputs: z.array(z.string()).describe("ids of ingredients AND earlier steps this step consumes. Each id should be consumed by exactly one step."),
      minutes: z.number().nullable(),
      temperature: z.object({ value: z.number(), unit: z.enum(["C", "F"]) }).nullable(),
    }),
  ),
  notes: z.string().nullable(),
});

export const RECIPE_GRAPH_GUIDE = `
Recipes are modelled as a dependency graph (like a build system):
- Every ingredient id must appear in the "inputs" of exactly one step (the first step that uses it).
- Every step except the final one should be consumed by exactly one later step (via its id in "inputs").
- Steps that only prepare equipment (preheat oven, line pan) have no inputs and are consumed by the step that needs them (e.g. "bake").
- Independent sub-preparations (e.g. "whisk dry ingredients" and "cream butter + sugar") are separate branches merged by a later step.
- "action" is a short verb label (1–2 words). "text" is the full instruction.
- Prefer metric weights when the source gives them. Keep the author's quantities otherwise; never invent precision.`;

export function normaliseLlmRecipe(r: z.infer<typeof llmRecipeSchema>, source?: { url?: string | null; name?: string | null }): RecipeData {
  return recipeDataSchema.parse({ ...r, source: source ?? null });
}
