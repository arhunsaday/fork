import { generateText, Output } from "ai";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { aiEnabled, getModel, llmRecipeSchema, normaliseLlmRecipe, RECIPE_GRAPH_GUIDE } from "@/lib/ai";
import { extractRecipeFromHtml } from "@/lib/recipe/jsonld";
import { parseRecipeText } from "@/lib/recipe/parse";

export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().url().optional(),
  text: z.string().max(40000).optional(),
  image: z.string().max(12_000_000).optional(), // data URL
  useAi: z.boolean().optional(),
});

const SYSTEM = `You convert messy recipe sources (blog pages, pasted text, cookbook photos) into a clean structured recipe.
Ignore life stories, ads, comments and navigation. Keep the author's quantities and wording, but tighten instructions.
${RECIPE_GRAPH_GUIDE}`;

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Sign in to import recipes." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { url, text, image, useAi = true } = parsed.data;
  const ai = aiEnabled() && useAi;

  try {
    if (url) {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ForkRecipeBot/1.0; +https://github.com/arhunsaday/fork)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return Response.json({ error: `Couldn't fetch that page (HTTP ${res.status}).` }, { status: 422 });
      const html = await res.text();
      const { recipe, pageText } = extractRecipeFromHtml(html, url);
      if (recipe && recipe.ingredients.length && recipe.steps.length) {
        if (!ai) return Response.json({ recipe, method: "json-ld" });
        // Structured data found: let the model refine the graph + action labels only.
        const { output } = await generateText({
          model: await getModel(),
          system: SYSTEM,
          output: Output.object({ schema: llmRecipeSchema }),
          prompt: `Refine this recipe extracted from schema.org data. Keep ingredient ids, fix ingredient parsing mistakes, write short "action" labels and build a correct step graph.\n\n${JSON.stringify(recipe)}`,
        });
        return Response.json({ recipe: normaliseLlmRecipe(output, recipe.source ?? { url }), method: "json-ld+ai" });
      }
      if (!ai) {
        return Response.json(
          { error: "This page has no structured recipe data. Add an AI key (ANTHROPIC_API_KEY or OPENAI_API_KEY) to import arbitrary pages, or paste the text instead." },
          { status: 422 },
        );
      }
      const { output } = await generateText({
        model: await getModel(),
        system: SYSTEM,
        output: Output.object({ schema: llmRecipeSchema }),
        prompt: `Extract the recipe from this web page text (source: ${url}).\n\n${pageText}`,
      });
      return Response.json({ recipe: normaliseLlmRecipe(output, { url }), method: "ai" });
    }

    if (image) {
      if (!ai) return Response.json({ error: "Photo import needs an AI key." }, { status: 422 });
      const { output } = await generateText({
        model: await getModel(),
        system: SYSTEM,
        output: Output.object({ schema: llmRecipeSchema }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe and structure the recipe in this photo." },
              { type: "image", image },
            ],
          },
        ],
      });
      return Response.json({ recipe: normaliseLlmRecipe(output), method: "ai-vision" });
    }

    if (text) {
      if (!ai) return Response.json({ recipe: parseRecipeText(text), method: "heuristic" });
      const { output } = await generateText({
        model: await getModel(),
        system: SYSTEM,
        output: Output.object({ schema: llmRecipeSchema }),
        prompt: `Structure this recipe:\n\n${text}`,
      });
      return Response.json({ recipe: normaliseLlmRecipe(output), method: "ai" });
    }
    return Response.json({ error: "Provide a url, text or image." }, { status: 400 });
  } catch (e) {
    console.error("[import]", e);
    // Graceful fallback for text if the model call fails.
    if (text) return Response.json({ recipe: parseRecipeText(text), method: "heuristic", warning: "AI import failed, used the offline parser." });
    return Response.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 500 });
  }
}
