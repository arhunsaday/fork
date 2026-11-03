import { describe, expect, it } from "vitest";
import { parseIngredientLine, parseRecipeText, inferAction, inferTiming } from "./parse";
import { buildTable, schedule } from "./graph";
import { convert, formatAmount, formatQty, toGrams } from "./units";
import { applySelected, diffKeys, diffRecipes } from "./diff";
import { extractRecipeFromHtml, isoMinutes } from "./jsonld";
import { bakersPercentages } from "./scale";
import { coverage, pantryHas } from "./match";
import { bananaBread, bananaBreadForkCommits, sourdough } from "@/db/seed-data";

describe("parseIngredientLine", () => {
  it.each([
    ["1 1/2 cups (190g) all-purpose flour, sifted", { qty: 1.5, unit: "cup", name: "all-purpose flour", note: "190g; sifted" }],
    ["2-3 large eggs", { qty: 2, qtyMax: 3, unit: null, name: "large eggs" }],
    ["½ tsp salt", { qty: 0.5, unit: "tsp", name: "salt" }],
    ["200g butter", { qty: 200, unit: "g", name: "butter" }],
    ["1 (14 oz) can tomatoes", { qty: 1, unit: "can", name: "tomatoes", note: "14 oz" }],
    ["a pinch of nutmeg", { qty: 1, unit: "pinch", name: "nutmeg" }],
    ["Salt to taste", { qty: null, name: "Salt", note: "to taste" }],
    ["1½ tbsp olive oil", { qty: 1.5, unit: "tbsp", name: "olive oil" }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });
});

describe("step inference", () => {
  it("derives action labels", () => {
    expect(inferAction("Fold in the flour gently")).toBe("Fold in");
    expect(inferAction("1. Preheat the oven to 180C")).toBe("Preheat");
  });
  it("reads times and temperatures", () => {
    expect(inferTiming("Bake at 350°F for 25-30 minutes")).toEqual({ minutes: 30, temperature: { value: 350, unit: "F" } });
    expect(inferTiming("Rest 1 hour 15 minutes")).toMatchObject({ minutes: 75 });
  });
});

describe("parseRecipeText", () => {
  const r = parseRecipeText(`Grandma's Pancakes
Fluffy and easy.
Serves 4
Ingredients
1 1/2 cups flour
2 tbsp sugar
1 cup milk
1 egg
Instructions
1. Whisk the flour and sugar.
2. Add milk and egg and stir.
3. Cook on a hot griddle for 2 minutes per side.`);
  it("extracts structure", () => {
    expect(r.title).toBe("Grandma's Pancakes");
    expect(r.servings).toBe(4);
    expect(r.category).toBe("meal"); // "pancakes" must not match "cake"
    expect(r.ingredients).toHaveLength(4);
    expect(r.steps.map((s) => s.action)).toEqual(["Whisk", "Add", "Cook"]);
  });
  it("treats 'makes 300 ml' as a yield, not servings", () => {
    const y = parseRecipeText("Lemon Curd\nMakes 300 ml\nIngredients\n3 eggs\nMethod\n1. Cook over low heat for 8 minutes.");
    expect(y.servings).toBe(4);
    expect(y.yieldLabel).toBe("300 ml");
    expect(y.steps[0].action).toBe("Cook");
  });
  it("wires every ingredient into the graph", () => {
    const used = new Set(r.steps.flatMap((s) => s.inputs));
    for (const i of r.ingredients) expect(used.has(i.id)).toBe(true);
  });
});

describe("buildTable", () => {
  const t = buildTable(bananaBread);
  it("places every ingredient exactly once", () => {
    const ings = t.rows.filter(Boolean);
    expect(ings).toHaveLength(bananaBread.ingredients.length);
  });
  it("final step spans all rows and sits in the last column", () => {
    const bake = t.cells.find((c) => c.kind === "step" && c.step.id === "bnb_bake")!;
    expect(bake.kind === "step" && bake.rowSpan).toBe(t.rows.length);
    expect(bake.col + bake.colSpan).toBe(t.levels + 2);
  });
  it("has no overlapping cells", () => {
    const occupied = new Set<string>();
    for (const c of t.cells) {
      const rs = c.kind === "step" ? c.rowSpan : 1;
      for (let r = c.row; r < c.row + rs; r++)
        for (let k = c.col; k < c.col + c.colSpan; k++) {
          const key = `${r}:${k}`;
          expect(occupied.has(key), `overlap at ${key}`).toBe(false);
          occupied.add(key);
        }
    }
  });
  it("schedules parallel branches", () => {
    const s = schedule(sourdough);
    const preheat = s.find((x) => x.id === "sd_preheat")!;
    expect(preheat.start).toBe(0); // can start immediately, in parallel with the dough
  });
});

describe("units", () => {
  it("uses ingredient densities", () => {
    expect(toGrams(1, "cup", "all-purpose flour")).toBeCloseTo(125, 0);
    expect(toGrams(1, "cup", "sugar")).toBeCloseTo(201, 0);
    expect(toGrams(2, null, "large eggs")).toBe(100);
  });
  it("converts and formats", () => {
    expect(formatAmount(convert(190, "g", "all-purpose flour", "us"))).toBe("~1½ cups");
    expect(formatAmount(convert(2, "cup", "milk", "metric"))).toBe("475ml");
    expect(formatQty(0.333, "cup")).toBe("⅓");
    expect(formatQty(1234, "g")).toBe("1235");
  });
  it("computes baker's percentages", () => {
    const b = bakersPercentages(sourdough)!;
    expect(b.flourGrams).toBe(500);
    expect(Math.round(b.hydration)).toBe(75);
  });
});

describe("diff", () => {
  const [v1, , v3] = bananaBreadForkCommits();
  const d = diffRecipes(v1.data, v3.data);
  it("detects ingredient adds and amount changes", () => {
    expect(d.ingredients.filter((c) => c.type === "added").map((c) => c.type === "added" && c.after.name)).toEqual(["ground cinnamon", "dark chocolate"]);
    const sugar = d.ingredients.find((c) => c.type === "changed" && c.after.name === "light brown sugar");
    expect(sugar && sugar.type === "changed" && sugar.fields).toContain("amount");
  });
  it("applies a partial selection", () => {
    const keys = new Set(diffKeys(d).filter((k) => k === "i-bbb_choc"));
    const merged = applySelected(v1.data, v3.data, d, keys);
    expect(merged.ingredients.some((i) => i.id === "bbb_choc")).toBe(true);
    expect(merged.ingredients.some((i) => i.id === "bbb_cinnamon")).toBe(false);
    expect(merged.title).toBe(v1.data.title); // meta not accepted
  });
});

describe("JSON-LD import", () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: "x" },
      {
        "@type": ["Recipe"],
        name: "Test Brownies",
        description: "Fudgy &amp; dense.",
        recipeYield: ["16", "16 squares"],
        prepTime: "PT15M",
        cookTime: "PT25M",
        recipeIngredient: ["200 g dark chocolate", "150 g butter", "250 g sugar", "3 eggs", "100 g flour"],
        recipeInstructions: [
          { "@type": "HowToSection", name: "Batter", itemListElement: [{ "@type": "HowToStep", text: "Melt the chocolate and butter." }, { "@type": "HowToStep", text: "Whisk in the sugar and eggs." }] },
          { "@type": "HowToStep", text: "Fold in the flour and bake at 180°C for 25 minutes." },
        ],
        keywords: "chocolate, brownies",
        author: { "@type": "Person", name: "Someone" },
      },
    ],
  })}</script></head><body><article>story…</article></body></html>`;
  const { recipe } = extractRecipeFromHtml(html, "https://example.com/brownies");
  it("finds the recipe inside @graph and parses it", () => {
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe("Test Brownies");
    expect(recipe!.description).toBe("Fudgy & dense.");
    expect(recipe!.servings).toBe(16);
    expect(recipe!.prepMinutes).toBe(15);
    expect(recipe!.ingredients).toHaveLength(5);
    expect(recipe!.steps).toHaveLength(3);
    expect(recipe!.steps[2].temperature).toEqual({ value: 180, unit: "C" });
    expect(recipe!.source?.name).toBe("Someone");
  });
  it("parses ISO durations", () => {
    expect(isoMinutes("PT1H20M")).toBe(80);
    expect(isoMinutes("P1DT2H")).toBe(1560);
  });
});

describe("pantry matching", () => {
  it("matches on significant keywords", () => {
    expect(pantryHas(["flour"], "all-purpose flour")).toBe(true);
    expect(pantryHas(["butter"], "unsalted butter")).toBe(true);
    expect(pantryHas(["peanut butter"], "unsalted butter")).toBe(false);
    expect(pantryHas([], "water")).toBe(true);
  });
  it("computes coverage", () => {
    const c = coverage(bananaBread, ["bananas", "butter", "brown sugar", "eggs", "vanilla", "baking soda", "salt", "flour"], ["oven"]);
    expect(c.missing.map((m) => m.name)).toEqual(["walnuts"]);
    expect(c.eqHave).toEqual(["oven"]);
  });
});

describe("db connection ssl", async () => {
  const { sslFor } = await import("@/db/connection");
  it("requires TLS for hosted databases without sslmode", () => {
    expect(sslFor("postgresql://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb")).toBe("require");
    expect(sslFor("postgres://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?channel_binding=require")).toBe("require");
  });
  it("defers to an explicit sslmode in the URL", () => {
    expect(sslFor("postgres://u:p@db.example.com/x?sslmode=require")).toBeUndefined();
    expect(sslFor("postgres://u:p@db.example.com/x?sslmode=disable")).toBeUndefined();
  });
  it("keeps local databases plain", () => {
    expect(sslFor("postgres://fork@localhost:5544/forkdb")).toBe(false);
    expect(sslFor("postgres://fork@127.0.0.1/forkdb")).toBe(false);
  });
});
