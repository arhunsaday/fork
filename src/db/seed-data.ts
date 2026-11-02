import type { Category, Ingredient, RecipeData, Step } from "@/lib/recipe/schema";

/**
 * Hand-written demo content. Recipes are declared compactly with local keys so
 * the step graph (`in: [...]`) reads naturally.
 */

type I = [key: string, qty: number | null, unit: string | null, name: string, note?: string];
type S = { k: string; a: string; t: string; in?: string[]; m?: number; temp?: [number, "C" | "F"] };

export function build(
  base: Omit<RecipeData, "ingredients" | "steps" | "tags" | "equipment" | "description"> & {
    description?: string;
    tags?: string[];
    equipment?: string[];
    category: Category;
  },
  ings: I[],
  steps: S[],
  prefix: string,
): RecipeData {
  const id = (k: string) => `${prefix}_${k}`;
  const ingKeys = new Set(ings.map((i) => i[0]));
  for (const s of steps) if (ingKeys.has(s.k)) throw new Error(`seed: step key "${s.k}" collides with an ingredient key`);
  const ingredients: Ingredient[] = ings.map(([k, qty, unit, name, note]) => ({
    id: id(k),
    qty,
    qtyMax: null,
    unit,
    name,
    note: note ?? null,
    group: null,
  }));
  const st: Step[] = steps.map((s) => ({
    id: id(s.k),
    action: s.a,
    text: s.t,
    inputs: (s.in ?? []).map(id),
    minutes: s.m ?? null,
    temperature: s.temp ? { value: s.temp[0], unit: s.temp[1] } : null,
  }));
  return {
    description: "",
    tags: [],
    equipment: [],
    ...base,
    ingredients,
    steps: st,
  };
}

export const SEED_USERS = [
  { id: "seed_fork", username: "fork", displayName: "Fork", bio: "The official recipe registry. Sane defaults, reproducible results." },
  { id: "seed_ada", username: "ada_bakes", displayName: "Ada", bio: "Firmware by day, laminated dough by night. Weighs everything." },
  { id: "seed_kernel", username: "kernel_cook", displayName: "Kernel Cook", bio: "Ships fast, cooks faster. Opinionated about chili." },
  { id: "seed_sam", username: "sous_vide_sam", displayName: "Sam", bio: "Temperature is a parameter, not a suggestion. Sourdough maintainer." },
];

export const bananaBread = build(
  {
    title: "Banana Nut Bread",
    description:
      "The reference implementation. Very ripe bananas, melted butter, no mixer. Moist crumb, crackly top, 15 minutes of work.",
    category: "baking",
    tags: ["quick-bread", "one-bowl", "breakfast"],
    servings: 10,
    yieldLabel: "1 loaf (9×5 in)",
    prepMinutes: 15,
    cookMinutes: 60,
    equipment: ["9×5 loaf pan", "oven", "mixing bowl", "fork"],
    notes: "Bananas should be heavily speckled or black. Underripe bananas = bland, dry loaf.",
    source: null,
  },
  [
    ["banana", 3, null, "very ripe bananas", "about 350 g peeled"],
    ["butter", 75, "g", "unsalted butter", "melted"],
    ["sugar", 150, "g", "light brown sugar"],
    ["egg", 1, null, "large egg", "beaten"],
    ["vanilla", 1, "tsp", "vanilla extract"],
    ["soda", 1, "tsp", "baking soda"],
    ["salt", 1, "pinch", "salt"],
    ["flour", 190, "g", "all-purpose flour"],
    ["walnuts", 60, "g", "walnuts", "roughly chopped"],
  ],
  [
    { k: "preheat", a: "Preheat", t: "Preheat the oven to 175°C / 350°F and butter a 9×5 loaf pan.", m: 10, temp: [175, "C"] },
    { k: "mash", a: "Mash", t: "Mash the bananas in a large bowl with a fork until mostly smooth.", in: ["banana"], m: 3 },
    { k: "stir", a: "Stir in", t: "Stir the melted butter into the mashed bananas.", in: ["mash", "butter"], m: 1 },
    { k: "wet", a: "Mix", t: "Mix in the brown sugar, beaten egg and vanilla.", in: ["stir", "sugar", "egg", "vanilla"], m: 2 },
    { k: "sprinkle", a: "Sprinkle", t: "Sprinkle the baking soda and salt over the mixture and stir in.", in: ["wet", "soda", "salt"], m: 1 },
    { k: "toast", a: "Toast", t: "Toast the walnuts in a dry pan for 4–5 minutes until fragrant.", in: ["walnuts"], m: 5 },
    { k: "fold", a: "Fold in", t: "Fold in the flour and toasted walnuts until just combined — a few streaks of flour are fine.", in: ["sprinkle", "flour", "toast"], m: 2 },
    { k: "bake", a: "Bake", t: "Pour into the pan and bake for 55–65 minutes, until a skewer comes out clean. Cool 10 minutes in the pan.", in: ["fold", "preheat"], m: 60, temp: [175, "C"] },
  ],
  "bnb",
);

/** Kernel's fork: brown butter, less sugar, chocolate. Built as successive commits. */
export function bananaBreadForkCommits(): { message: string; data: RecipeData }[] {
  const v1 = structuredClone(bananaBread);
  const v2 = structuredClone(v1);
  v2.title = "Brown Butter Banana Bread";
  v2.description = "Fork of the reference loaf with nutty brown butter and a hint of cinnamon.";
  v2.ingredients = v2.ingredients.map((i) => (i.id === "bnb_butter" ? { ...i, qty: 90, note: "browned and cooled slightly" } : i));
  v2.ingredients.splice(5, 0, { id: "bbb_cinnamon", qty: 1, qtyMax: null, unit: "tsp", name: "ground cinnamon", note: null, group: null });
  v2.steps = v2.steps.map((s) => {
    if (s.id === "bnb_stir") return { ...s, action: "Brown", text: "Brown the butter in a small pan until it smells nutty and the solids turn deep amber, ~5 minutes. Stir it into the mashed bananas." , minutes: 6 };
    if (s.id === "bnb_sprinkle") return { ...s, text: "Sprinkle the baking soda, salt and cinnamon over the mixture and stir in.", inputs: [...s.inputs, "bbb_cinnamon"] };
    return s;
  });
  const v3 = structuredClone(v2);
  v3.ingredients = v3.ingredients.map((i) => (i.id === "bnb_sugar" ? { ...i, qty: 120 } : i));
  v3.ingredients.push({ id: "bbb_choc", qty: 80, qtyMax: null, unit: "g", name: "dark chocolate", note: "70%, chopped", group: null });
  v3.steps = v3.steps.map((s) =>
    s.id === "bnb_fold"
      ? { ...s, text: "Fold in the flour, toasted walnuts and chopped chocolate until just combined.", inputs: [...s.inputs, "bbb_choc"] }
      : s,
  );
  v3.tags = [...v3.tags, "chocolate"];
  return [
    { message: "fork: ada_bakes/banana-nut-bread", data: v1 },
    { message: "brown the butter (+15 g to offset water loss), add cinnamon", data: v2 },
    { message: "-30 g sugar, +80 g dark chocolate", data: v3 },
  ];
}

export const sourdough = build(
  {
    title: "Country Sourdough",
    description: "75% hydration, 10% whole wheat. Open crumb, blistered crust. Overnight cold retard for flavour and scheduling.",
    category: "bread",
    tags: ["sourdough", "levain", "overnight"],
    servings: 12,
    yieldLabel: "1 boule (~950 g)",
    prepMinutes: 45,
    cookMinutes: 45,
    equipment: ["dutch oven", "banneton", "bench scraper", "lame", "kitchen scale"],
    notes: "Levain should be at peak — doubled, domed, and passes the float test. Room temp assumed 24°C; adjust bulk time accordingly.",
    source: null,
  },
  [
    ["bread", 450, "g", "bread flour"],
    ["ww", 50, "g", "whole wheat flour"],
    ["water", 350, "g", "water", "30°C"],
    ["levain", 100, "g", "levain", "100% hydration, at peak"],
    ["salt", 10, "g", "fine sea salt"],
    ["water2", 25, "g", "water", "for salt"],
  ],
  [
    { k: "autolyse", a: "Autolyse", t: "Mix the flours and 350 g water until no dry bits remain. Cover and rest 1 hour.", in: ["bread", "ww", "water"], m: 60 },
    { k: "addlevain", a: "Add levain", t: "Add the levain and pinch it through the dough until fully incorporated.", in: ["autolyse", "levain"], m: 5 },
    { k: "addsalt", a: "Add salt", t: "Sprinkle the salt with the remaining 25 g water and squeeze in. Slap and fold 2–3 minutes.", in: ["addlevain", "salt", "water2"], m: 5 },
    { k: "bulk", a: "Bulk ferment", t: "Bulk ferment at ~24°C for 4–5 hours with 4 sets of coil folds every 30 minutes in the first 2 hours. Stop at +50% volume.", in: ["addsalt"], m: 270 },
    { k: "shape", a: "Shape", t: "Pre-shape into a round, bench rest 20 minutes, then shape tightly and place seam-up in a floured banneton.", in: ["bulk"], m: 30 },
    { k: "retard", a: "Retard", t: "Cover and refrigerate 12–16 hours.", in: ["shape"], m: 720 },
    { k: "preheat", a: "Preheat", t: "Preheat the oven with the dutch oven inside to 250°C / 480°F for 45 minutes.", m: 45, temp: [250, "C"] },
    { k: "bake", a: "Bake", t: "Turn out, score, and bake covered 20 minutes, then uncovered at 230°C for 20–25 minutes until deeply browned. Cool 2 hours before cutting.", in: ["retard", "preheat"], m: 45, temp: [250, "C"] },
  ],
  "sd",
);

export const choux = build(
  {
    title: "Pâte à Choux",
    description: "Classic choux paste for profiteroles and éclairs. Half milk, half water for colour and tenderness.",
    category: "pastry",
    tags: ["french", "choux", "profiteroles", "eclairs"],
    servings: 24,
    yieldLabel: "~24 profiteroles",
    prepMinutes: 25,
    cookMinutes: 35,
    equipment: ["saucepan", "stand mixer", "piping bag", "10 mm round tip", "baking sheet"],
    notes: "Egg quantity is a range: stop when the paste forms a V that slowly folds over itself on the spatula.",
    source: null,
  },
  [
    ["water", 125, "g", "water"],
    ["milk", 125, "g", "whole milk"],
    ["butter", 110, "g", "unsalted butter", "cubed"],
    ["salt", 2, "g", "salt"],
    ["sugar", 5, "g", "sugar"],
    ["flour", 140, "g", "bread flour", "sifted"],
    ["eggs", 250, "g", "eggs", "about 5, beaten"],
  ],
  [
    { k: "preheat", a: "Preheat", t: "Preheat the oven to 200°C / 390°F (fan off). Line a baking sheet.", m: 15, temp: [200, "C"] },
    { k: "boil", a: "Boil", t: "Bring water, milk, butter, salt and sugar to a rolling boil, making sure the butter is fully melted.", in: ["water", "milk", "butter", "salt", "sugar"], m: 4 },
    { k: "panade", a: "Panade", t: "Off the heat, dump in all the flour and stir hard. Return to medium heat and cook, stirring, 2–3 minutes until a film forms on the pan.", in: ["boil", "flour"], m: 4 },
    { k: "cool", a: "Cool", t: "Transfer to the mixer bowl and beat on low for 1–2 minutes to release steam (below 60°C).", in: ["panade"], m: 2 },
    { k: "beat", a: "Beat in", t: "Add the eggs in 4–5 additions, beating fully between each, until the paste is glossy and forms a V.", in: ["cool", "eggs"], m: 5 },
    { k: "pipe", a: "Pipe", t: "Pipe 3.5 cm mounds, spaced well apart. Smooth tips with a wet finger.", in: ["beat"], m: 8 },
    { k: "bake", a: "Bake", t: "Bake 15 minutes at 200°C, then 20 minutes at 170°C without opening the door. Pierce each and cool on a rack.", in: ["pipe", "preheat"], m: 35, temp: [200, "C"] },
  ],
  "ch",
);

export const chili = build(
  {
    title: "Weeknight Chili",
    description: "One pot, 45 minutes, deep flavour via bloomed spices and a splash of espresso. Scales linearly to a team lunch.",
    category: "meal",
    tags: ["one-pot", "spicy", "meal-prep"],
    servings: 6,
    yieldLabel: null,
    prepMinutes: 15,
    cookMinutes: 45,
    equipment: ["dutch oven", "wooden spoon"],
    notes: "Better on day 2. Freezes for 3 months.",
    source: null,
  },
  [
    ["oil", 2, "tbsp", "neutral oil"],
    ["onion", 1, null, "large onion", "diced"],
    ["garlic", 4, "cloves", "garlic", "minced"],
    ["beef", 700, "g", "ground beef", "20% fat"],
    ["chili", 3, "tbsp", "chili powder"],
    ["cumin", 2, "tsp", "ground cumin"],
    ["paprika", 1, "tsp", "smoked paprika"],
    ["paste", 2, "tbsp", "tomato paste"],
    ["tomatoes", 800, "g", "crushed tomatoes", "1 large can"],
    ["beans", 2, "cans", "kidney beans", "drained"],
    ["espresso", 30, "ml", "espresso", "or strong coffee"],
    ["salt", null, null, "salt and pepper", "to taste"],
  ],
  [
    { k: "sweat", a: "Sweat", t: "Heat oil over medium. Cook onion with a pinch of salt 6–8 minutes until soft, add garlic for 1 minute.", in: ["oil", "onion", "garlic"], m: 9 },
    { k: "brown", a: "Brown", t: "Increase heat, add beef and brown well, breaking it up, ~8 minutes.", in: ["sweat", "beef"], m: 8 },
    { k: "bloom", a: "Bloom", t: "Add chili powder, cumin, paprika and tomato paste; stir 1–2 minutes until brick red and fragrant.", in: ["brown", "chili", "cumin", "paprika", "paste"], m: 2 },
    { k: "simmer", a: "Simmer", t: "Add tomatoes, beans and espresso. Simmer partially covered 30 minutes, stirring occasionally.", in: ["bloom", "tomatoes", "beans", "espresso"], m: 30 },
    { k: "season", a: "Season", t: "Season to taste with salt and pepper. Serve with sour cream, cheddar and scallions.", in: ["simmer", "salt"], m: 1 },
  ],
  "chl",
);

export const cookies = build(
  {
    title: "Chocolate Chip Cookies",
    description: "Crisp edges, chewy centre, puddles of chocolate. Uses browned butter and a mandatory dough rest.",
    category: "baking",
    tags: ["cookies", "chocolate", "brown-butter"],
    servings: 18,
    yieldLabel: "18 cookies",
    prepMinutes: 20,
    cookMinutes: 12,
    equipment: ["baking sheet", "parchment", "saucepan", "cookie scoop"],
    notes: null,
    source: null,
  },
  [
    ["butter", 170, "g", "unsalted butter"],
    ["brown", 160, "g", "dark brown sugar"],
    ["white", 70, "g", "granulated sugar"],
    ["egg", 1, null, "large egg"],
    ["yolk", 1, null, "egg yolk"],
    ["vanilla", 2, "tsp", "vanilla extract"],
    ["flour", 250, "g", "all-purpose flour"],
    ["soda", 0.75, "tsp", "baking soda"],
    ["salt", 1, "tsp", "kosher salt"],
    ["choc", 200, "g", "dark chocolate", "chopped"],
  ],
  [
    { k: "brownb", a: "Brown", t: "Brown the butter until nutty and amber. Cool 10 minutes.", in: ["butter"], m: 15 },
    { k: "whisk", a: "Whisk", t: "Whisk the browned butter with both sugars, then the egg, yolk and vanilla until glossy.", in: ["brownb", "brown", "white", "egg", "yolk", "vanilla"], m: 3 },
    { k: "dry", a: "Whisk", t: "In another bowl, whisk flour, baking soda and salt.", in: ["flour", "soda", "salt"], m: 1 },
    { k: "fold", a: "Fold", t: "Fold the dry mix into the wet, then fold in the chocolate.", in: ["whisk", "dry", "choc"], m: 2 },
    { k: "bake", a: "Bake", t: "Scoop 50 g balls onto lined sheets and bake at 180°C for 11–12 minutes until the edges are set.", in: ["fold"], m: 12, temp: [180, "C"] },
  ],
  "ccc",
);

export function cookieCommits(): { message: string; data: RecipeData }[] {
  const v1 = structuredClone(cookies);
  const v2 = structuredClone(v1);
  v2.steps.splice(4, 0, {
    id: "ccc_rest",
    action: "Rest",
    text: "Cover and refrigerate the dough at least 24 hours (up to 72). Hydrates the flour, deepens the caramel notes.",
    inputs: ["ccc_fold"],
    minutes: 1440,
    temperature: null,
  });
  v2.steps = v2.steps.map((s) => (s.id === "ccc_bake" ? { ...s, inputs: ["ccc_rest"] } : s));
  const v3 = structuredClone(v2);
  v3.ingredients.push({ id: "ccc_flaky", qty: 1, qtyMax: null, unit: "pinch", name: "flaky sea salt", note: "to finish", group: null });
  v3.steps = v3.steps.map((s) =>
    s.id === "ccc_bake"
      ? { ...s, text: "Scoop 50 g balls onto lined sheets, sprinkle with flaky salt and bake at 180°C for 11–12 minutes until the edges are set.", inputs: [...s.inputs, "ccc_flaky"] }
      : s,
  );
  return [
    { message: "initial commit", data: v1 },
    { message: "add 24h dough rest", data: v2 },
    { message: "finish with flaky salt", data: v3 },
  ];
}

export const pancakes = build(
  {
    title: "Sunday Buttermilk Pancakes",
    description: "Tall, fluffy, tangy. Don't overmix: lumps are a feature.",
    category: "meal",
    tags: ["breakfast", "quick"],
    servings: 4,
    yieldLabel: "12 pancakes",
    prepMinutes: 10,
    cookMinutes: 20,
    equipment: ["griddle", "whisk", "two bowls"],
    notes: null,
    source: null,
  },
  [
    ["flour", 2, "cup", "all-purpose flour"],
    ["sugar", 2, "tbsp", "sugar"],
    ["bp", 2, "tsp", "baking powder"],
    ["soda", 0.5, "tsp", "baking soda"],
    ["salt", 0.5, "tsp", "salt"],
    ["bm", 2, "cup", "buttermilk"],
    ["eggs", 2, null, "eggs"],
    ["butter", 3, "tbsp", "butter", "melted"],
  ],
  [
    { k: "dry", a: "Whisk", t: "Whisk the dry ingredients together.", in: ["flour", "sugar", "bp", "soda", "salt"], m: 1 },
    { k: "wet", a: "Whisk", t: "Whisk buttermilk, eggs and melted butter.", in: ["bm", "eggs", "butter"], m: 1 },
    { k: "combine", a: "Combine", t: "Pour wet into dry and stir just until combined. Rest 5 minutes.", in: ["dry", "wet"], m: 6 },
    { k: "cook", a: "Cook", t: "Cook ¼-cup portions on a buttered griddle over medium heat until bubbles pop, flip, 1–2 minutes more.", in: ["combine"], m: 15 },
  ],
  "pc",
);

export const vinaigrette = build(
  {
    title: "Shallot Vinaigrette",
    description: "3:1 oil to acid, emulsified with Dijon. The house dressing.",
    category: "sauce",
    tags: ["dressing", "5-minutes"],
    servings: 8,
    yieldLabel: "~250 ml",
    prepMinutes: 5,
    cookMinutes: null,
    equipment: ["jar with lid"],
    notes: null,
    source: null,
  },
  [
    ["shallot", 1, null, "shallot", "finely minced"],
    ["vinegar", 60, "ml", "red wine vinegar"],
    ["salt", 0.5, "tsp", "salt"],
    ["dijon", 1, "tbsp", "Dijon mustard"],
    ["honey", 1, "tsp", "honey"],
    ["oil", 180, "ml", "extra virgin olive oil"],
  ],
  [
    { k: "macerate", a: "Macerate", t: "Combine shallot, vinegar and salt; let sit 10 minutes to mellow the shallot.", in: ["shallot", "vinegar", "salt"], m: 10 },
    { k: "emulsify", a: "Shake", t: "Add Dijon, honey and olive oil. Shake hard in a sealed jar until emulsified.", in: ["macerate", "dijon", "honey", "oil"], m: 1 },
  ],
  "vin",
);
