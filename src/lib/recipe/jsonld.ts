import * as cheerio from "cheerio";
import { emptyRecipe, uid, type RecipeData, type Step } from "./schema";
import { guessCategory, inferAction, inferGraph, inferTiming, parseIngredientLine } from "./parse";

/**
 * Extract a schema.org/Recipe from a web page. Most food blogs embed one as
 * JSON-LD for Google rich results, which makes link imports deterministic
 * (no AI needed) for the majority of sites.
 */

type Json = Record<string, unknown>;

function findRecipeNode(node: unknown): Json | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Json;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) return obj;
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  if (obj.mainEntity) return findRecipeNode(obj.mainEntity);
  return null;
}

/** ISO 8601 duration (PT1H20M) → minutes. */
export function isoMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total || null;
}

const text = (v: unknown): string =>
  typeof v === "string"
    ? cheerio.load(`<div>${v}</div>`)("div").text().replace(/\s+/g, " ").trim()
    : "";

function flattenInstructions(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    return text(v)
      .split(/(?:\r?\n|(?<=\.)\s+(?=\d+\.\s))/)
      .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(flattenInstructions);
  if (typeof v === "object") {
    const o = v as Json;
    if (o.itemListElement) return flattenInstructions(o.itemListElement);
    if (o.text) return [text(o.text)];
    if (o.name) return [text(o.name)];
  }
  return [];
}

export function recipeFromJsonLd(node: Json, url?: string): RecipeData {
  const r = emptyRecipe();
  r.title = text(node.name) || "Imported recipe";
  r.description = text(node.description).slice(0, 600);
  const y = Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield;
  const servings = typeof y === "number" ? y : Number(String(y ?? "").match(/\d+/)?.[0]);
  if (servings) r.servings = servings;
  if (y && typeof y === "string" && !/^\d+$/.test(y.trim())) r.yieldLabel = y;
  r.prepMinutes = isoMinutes(node.prepTime);
  r.cookMinutes = isoMinutes(node.cookTime) ?? (isoMinutes(node.totalTime) ? isoMinutes(node.totalTime)! - (r.prepMinutes ?? 0) : null);
  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
    .map((l) => parseIngredientLine(text(l)))
    .filter((x): x is NonNullable<typeof x> => !!x);
  r.ingredients = ingredients;
  const steps: Step[] = flattenInstructions(node.recipeInstructions).map((t) => ({
    id: uid("s"),
    action: inferAction(t),
    text: t,
    inputs: [],
    ...inferTiming(t),
  }));
  r.steps = inferGraph(ingredients, steps);
  const kw = typeof node.keywords === "string" ? node.keywords.split(",") : Array.isArray(node.keywords) ? node.keywords : [];
  r.tags = kw.map((k) => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 6);
  const cat = [node.recipeCategory, node.recipeCuisine].flat().filter(Boolean).join(" ");
  r.category = guessCategory(`${r.title} ${cat} ${r.description}`);
  const author = Array.isArray(node.author) ? node.author[0] : node.author;
  r.source = { url: url ?? null, name: typeof author === "object" && author ? text((author as Json).name) : text(author) || null };
  return r;
}

export function extractRecipeFromHtml(html: string, url?: string): { recipe: RecipeData | null; pageText: string } {
  const $ = cheerio.load(html);
  let found: Json | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const parsed = JSON.parse($(el).contents().text());
      found = findRecipeNode(parsed);
    } catch {
      /* ignore malformed blocks */
    }
  });
  $("script, style, noscript, nav, footer, header, iframe, svg, form").remove();
  const pageText = $("article").first().text() || $("main").first().text() || $("body").text();
  return {
    recipe: found ? recipeFromJsonLd(found, url) : null,
    pageText: pageText.replace(/\n\s*\n+/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, 20000),
  };
}
