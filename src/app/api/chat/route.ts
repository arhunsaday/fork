import { convertToModelMessages, createUIMessageStreamResponse, stepCountIs, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { aiEnabled, getModel, llmRecipeSchema, RECIPE_GRAPH_GUIDE } from "@/lib/ai";
import { recipeDataSchema } from "@/lib/recipe/schema";

export const maxDuration = 60;

const SYSTEM = (recipe: string, ctx: string) => `You are Fork's sous-chef: a precise, friendly cooking assistant for engineers.
You explain the *why* (food science, ratios, temperatures) concisely, like a senior engineer doing code review.
Use metric first with US in parentheses when useful. Use short paragraphs, bullet lists and **bold** for key numbers. No fluff.

When the user asks to change, adapt, fix, scale, substitute or improve the recipe, call the \`proposeChanges\` tool
with the COMPLETE updated recipe. Keep ids of unchanged ingredients/steps; use new ids for new ones. Keep the step graph valid.
Then briefly explain the reasoning behind each change in text.
For questions that don't require changing the recipe (explain, troubleshoot, timing), just answer.

${RECIPE_GRAPH_GUIDE}

Context: ${ctx}
Current recipe (JSON):
${recipe}`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to chat with the sous-chef." }, { status: 401 });
  if (!aiEnabled()) return Response.json({ error: "AI is not configured on this server." }, { status: 503 });

  const body = (await req.json()) as { messages: UIMessage[]; recipe?: unknown; context?: string };
  const recipe = recipeDataSchema.safeParse(body.recipe);
  const result = streamText({
    model: await getModel(),
    system: SYSTEM(recipe.success ? JSON.stringify(recipe.data) : "(none — general cooking question)", body.context ?? ""),
    messages: await convertToModelMessages(body.messages),
    stopWhen: stepCountIs(3),
    tools: {
      proposeChanges: tool({
        description: "Propose a modified version of the current recipe. The user reviews a diff and can accept each change, then fork/commit it.",
        inputSchema: z.object({
          commitMessage: z.string().describe("git-style commit message, imperative, <72 chars, e.g. 'swap butter for olive oil (-20% fat)'"),
          summary: z.string().describe("one sentence on what changed and why"),
          recipe: llmRecipeSchema,
        }),
        execute: async ({ commitMessage }) => ({ proposed: true, commitMessage }),
      }),
    },
  });
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
