import { normalizeUnit, COUNT_UNITS } from "./units";
import { emptyRecipe, uid, type Ingredient, type RecipeData, type Step, type Category } from "./schema";

/**
 * Deterministic (non-AI) parsing: ingredient lines, free text recipes and step
 * graph inference. Used for imports when no AI key is configured and as a
 * pre-pass for schema.org JSON-LD recipes.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6,
  "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const UNIT_WORDS = [
  "fluid ounces", "fluid ounce", "fl\\. oz", "fl oz", "fl\\.oz",
  "tablespoons", "tablespoon", "tbsps", "tbsp", "tbs", "tbl", "T",
  "teaspoons", "teaspoon", "tsps", "tsp", "t",
  "kilograms", "kilogram", "kilos", "kilo", "kg",
  "milligrams", "milligram", "mg",
  "grams", "gram", "grs", "gr", "g",
  "milliliters", "millilitres", "milliliter", "millilitre", "mls", "ml",
  "centiliters", "centilitres", "cl", "deciliters", "decilitres", "dl",
  "liters", "litres", "liter", "litre", "l",
  "ounces", "ounce", "oz", "pounds", "pound", "lbs", "lb",
  "cups", "cup", "c",
  "pints", "pint", "pt", "quarts", "quart", "qt", "gallons", "gallon", "gal",
  "pinches", "pinch", "dashes", "dash",
  ...[...COUNT_UNITS].filter((u) => !["large", "medium", "small", "whole", "egg", "eggs"].includes(u)),
];
const UNIT_RE = new RegExp(`^(${UNIT_WORDS.sort((a, b) => b.length - a.length).join("|")})\\.?(?=\\s|$|\\))`, "i");

function parseNumberToken(token: string): number | null {
  token = token.trim();
  if (!token) return null;
  // "1½"
  const mixedUnicode = token.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (mixedUnicode) return (mixedUnicode[1] ? Number(mixedUnicode[1]) : 0) + UNICODE_FRACTIONS[mixedUnicode[2]];
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(token.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const NUM = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\\d+(?:[.,]\\d+)?)";
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?`);

/** Parse a single ingredient line such as "1 1/2 cups (190g) all-purpose flour, sifted". */
export function parseIngredientLine(line: string, group?: string | null): Ingredient | null {
  let s = line
    .replace(/^[\s•\-*·▪◦–]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  let qty: number | null = null;
  let qtyMax: number | null = null;
  let unit: string | null = null;
  let note: string | null = null;

  const q = s.match(QTY_RE);
  if (q) {
    qty = parseNumberToken(q[1]);
    qtyMax = q[2] ? parseNumberToken(q[2]) : null;
    s = s.slice(q[0].length).trim();
    // "1 (14 oz) can tomatoes" → note first, then unit
    const lead = s.match(/^\(([^)]*)\)\s*/);
    if (lead) {
      note = lead[1].trim();
      s = s.slice(lead[0].length);
    }
    // "200g" glued unit
    const u = s.match(UNIT_RE);
    if (u) {
      unit = normalizeUnit(u[1]);
      s = s.slice(u[0].length).trim();
    }
  } else if (/^(a|an|one)\s/i.test(s)) {
    const rest = s.replace(/^(a|an|one)\s/i, "");
    const u = rest.match(UNIT_RE);
    if (u) {
      qty = 1;
      unit = normalizeUnit(u[1]);
      s = rest.slice(u[0].length).trim();
    }
  }

  // Strip "of" ("2 cups of flour")
  s = s.replace(/^of\s+/i, "");

  // Notes: parenthetical or after comma
  const paren = s.match(/\(([^)]*)\)/);
  if (paren) {
    note = [note, paren[1].trim()].filter(Boolean).join("; ");
    s = s.replace(paren[0], " ").replace(/\s+/g, " ").trim();
  }
  const comma = s.indexOf(",");
  if (comma > 0) {
    const tail = s.slice(comma + 1).trim();
    s = s.slice(0, comma).trim();
    note = [note, tail].filter(Boolean).join("; ") || null;
  }
  if (/to taste$/i.test(s)) {
    s = s.replace(/,?\s*to taste$/i, "").trim();
    note = [note, "to taste"].filter(Boolean).join("; ");
  }

  if (!s) return null;
  return { id: uid("i"), name: s, qty, qtyMax, unit, note, group: group ?? null };
}

const COOKING_VERBS = [
  "add", "arrange", "bake", "baste", "beat", "blanch", "blend", "boil", "braise", "bring", "broil",
  "brown", "brush", "caramelize", "chill", "chop", "coat", "combine", "cook", "cool", "cover", "cream",
  "crush", "cube", "cut", "deglaze", "dice", "dissolve", "divide", "drain", "dredge", "drizzle", "dust",
  "fill", "flip", "fold", "fry", "garnish", "grate", "grease", "grill", "heat", "incorporate", "knead",
  "layer", "let", "line", "marinate", "mash", "measure", "melt", "microwave", "mince", "mix", "pipe",
  "place", "poach", "pour", "preheat", "press", "proof", "prove", "puree", "reduce", "refrigerate",
  "remove", "rest", "roast", "roll", "rub", "saute", "sauté", "scald", "scatter", "score", "sear",
  "season", "separate", "serve", "shape", "shred", "sift", "simmer", "slice", "soak", "spread",
  "sprinkle", "steam", "stir", "strain", "stuff", "temper", "toast", "top", "toss", "transfer", "trim",
  "turn", "whip", "whisk", "zest", "laminate", "rise", "freeze", "pulse", "process", "set", "split",
  "squeeze", "wrap", "glaze", "brine", "cure", "smoke", "skim", "stretch", "punch", "form", "spoon", "ladle",
];
const VERB_SET = new Set(COOKING_VERBS);

/** Derive a short table label ("Whisk", "Fold in") from a step's text. */
export function inferAction(text: string): string {
  const words = text
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[^\p{L}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < Math.min(words.length, 8); i++) {
    const w = words[i].toLowerCase();
    if (VERB_SET.has(w)) {
      const next = words[i + 1]?.toLowerCase();
      const label = ["in", "together", "out", "off", "up"].includes(next ?? "")
        ? `${w} ${next}`
        : w;
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  const first = words[0] ?? "Step";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Extract duration (minutes) and oven temperature hints from step text. */
export function inferTiming(text: string): Pick<Step, "minutes" | "temperature"> {
  let minutes: number | null = null;
  const h = text.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|to)?\s*(\d+(?:[.,]\d+)?)?\s*(hours?|hrs?|h)\b/i);
  const m = text.match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(minutes?|mins?|m)\b/i);
  if (h) minutes = Math.round(Number((h[2] ?? h[1]).replace(",", ".")) * 60);
  if (m) minutes = (minutes ?? 0) + Number(m[2] ?? m[1]);
  let temperature: Step["temperature"] = null;
  const t = text.match(/(\d{2,3})\s*°?\s*(F|C)\b|(\d{2,3})\s*degrees\s*(F|C|fahrenheit|celsius)?/i);
  if (t) {
    const value = Number(t[1] ?? t[3]);
    const unitRaw = (t[2] ?? t[4] ?? "").toUpperCase();
    const unit = unitRaw.startsWith("C") ? "C" : unitRaw.startsWith("F") ? "F" : value > 250 ? "F" : "C";
    temperature = { value, unit };
  }
  return { minutes, temperature };
}

function ingredientKeywords(name: string): string[] {
  const stop = new Set(["of", "and", "or", "the", "a", "fresh", "large", "small", "medium", "chopped", "ground", "unsalted", "salted", "whole", "all-purpose", "purpose", "granulated", "plain", "room", "temperature", "extra", "virgin", "finely", "softened", "melted", "cold", "warm"]);
  return name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !stop.has(w))
    .map((w) => w.replace(/(es|s)$/, ""));
}

/**
 * Infer the step graph for recipes that don't specify `inputs`:
 *  - each ingredient goes to the first step whose text mentions it
 *  - each step consumes the previous "open" step chain, giving a linear spine
 *  - steps that only set up equipment (preheat, line a pan) stay disconnected
 */
export function inferGraph(ingredients: Ingredient[], steps: Step[]): Step[] {
  const assigned = new Set<string>();
  const out: Step[] = steps.map((s) => ({ ...s, inputs: [] as string[] }));
  const prepOnly = (text: string) =>
    /^(preheat|heat the oven|line|grease|butter (a|the) pan|set (an|the) oven)/i.test(text.trim());

  out.forEach((step) => {
    const text = step.text.toLowerCase();
    for (const ing of ingredients) {
      if (assigned.has(ing.id)) continue;
      const kws = ingredientKeywords(ing.name);
      if (kws.length && kws.some((k) => new RegExp(`\\b${k}`, "i").test(text))) {
        step.inputs.push(ing.id);
        assigned.add(ing.id);
      }
    }
  });

  // Unmentioned ingredients → first non-prep step (usually "mix the dry ingredients").
  const firstReal = out.find((s) => !prepOnly(s.text)) ?? out[0];
  if (firstReal) {
    for (const ing of ingredients) if (!assigned.has(ing.id)) firstReal.inputs.push(ing.id);
  }

  // Linear spine: connect each step to the previous non-prep step.
  let prev: Step | null = null;
  for (const step of out) {
    if (prepOnly(step.text) && step.inputs.length === 0) continue;
    if (prev) step.inputs.unshift(prev.id);
    prev = step;
  }
  return out;
}

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/sourdough|baguette|loaf|focaccia|brioche|levain|ciabatta|\bbread\b/.test(t)) return "bread";
  if (/croissant|choux|éclair|eclair|macaron|tart|pâte|pate|puff pastry|mille|crème pât|meringue/.test(t)) return "pastry";
  if (/\b(cakes?|cookies?|muffins?|brownies?|scones?|biscuits?|banana bread|cupcakes?|pies?|loaf cake)\b/.test(t)) return "baking";
  if (/ice cream|pudding|mousse|custard|sorbet|panna cotta/.test(t)) return "dessert";
  if (/cocktail|smoothie|latte|lemonade|syrup|drink/.test(t)) return "drink";
  if (/jam|pickle|preserve|chutney|ferment/.test(t)) return "preserve";
  if (/sauce|dressing|vinaigrette|pesto|aioli|gravy/.test(t)) return "sauce";
  return "meal";
}

export { guessCategory };

/**
 * Heuristic plain-text recipe parser. Looks for "Ingredients" / "Method"
 * headings; otherwise classifies lines by whether they start with a quantity.
 */
export function parseRecipeText(raw: string): RecipeData {
  const recipe = emptyRecipe();
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim());

  const nonEmpty = lines.filter(Boolean);
  recipe.title = (nonEmpty[0] ?? "Untitled recipe").replace(/^#+\s*/, "").slice(0, 120);

  type Section = "intro" | "ingredients" | "steps" | "notes";
  let section: Section = "intro";
  let group: string | null = null;
  const intro: string[] = [];
  const stepTexts: string[] = [];
  const notes: string[] = [];

  for (const line of lines.slice(lines.indexOf(nonEmpty[0] ?? "") + 1)) {
    if (!line) continue;
    const heading = line.replace(/[:#*]/g, "").trim().toLowerCase();
    if (/^(ingredients?|you('| wi)ll need|what you need)$/.test(heading)) { section = "ingredients"; group = null; continue; }
    if (/^(method|directions?|instructions?|steps?|preparation|how to make( it)?)$/.test(heading)) { section = "steps"; continue; }
    if (/^(notes?|tips?|variations?)$/.test(heading)) { section = "notes"; continue; }

    const servings = line.match(/^(?:serves|servings|yields?|makes)\s*:?\s*(?:about\s+)?(\d+)\s*([a-zA-Z]+)?/i);
    if (servings && section !== "steps") {
      const unit = servings[2]?.toLowerCase();
      // "Makes 300 ml" / "Yield: 2 loaves" are yields, not servings
      if (unit && !/^(servings?|people|persons?|portions?)$/.test(unit)) recipe.yieldLabel = line.replace(/^(?:yields?|makes)\s*:?\s*/i, "");
      else recipe.servings = Number(servings[1]);
      continue;
    }

    if (section === "intro" && QTY_RE.test(line.replace(/^[\s•\-*·]+/, ""))) section = "ingredients";

    if (section === "ingredients") {
      if (/^for the |:$/i.test(line) && !QTY_RE.test(line)) {
        group = line.replace(/:$/, "").replace(/^for the /i, "");
        continue;
      }
      if (/^\d+[.)]\s/.test(line) && line.length > 60) { section = "steps"; stepTexts.push(line.replace(/^\d+[.)]\s*/, "")); continue; }
      const ing = parseIngredientLine(line, group);
      if (ing) recipe.ingredients.push(ing);
    } else if (section === "steps") {
      stepTexts.push(line.replace(/^(step\s*)?\d+[.):]\s*/i, ""));
    } else if (section === "notes") {
      notes.push(line);
    } else {
      intro.push(line);
    }
  }

  recipe.description = intro.join(" ").slice(0, 500);
  recipe.notes = notes.join("\n") || null;
  const steps: Step[] = stepTexts.filter((t) => t.length > 2).map((text) => ({
    id: uid("s"),
    action: inferAction(text),
    text,
    inputs: [],
    ...inferTiming(text),
  }));
  recipe.steps = inferGraph(recipe.ingredients, steps);
  recipe.category = guessCategory(`${recipe.title} ${recipe.description}`);
  return recipe;
}
