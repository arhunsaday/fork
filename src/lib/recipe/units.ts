/**
 * Unit handling: normalisation, mass/volume conversion and ingredient-aware
 * density so "1 cup flour" can become 120 g while "1 cup sugar" becomes 200 g.
 */

export type UnitKind = "mass" | "volume" | "count";

type UnitDef = { kind: "mass" | "volume"; toBase: number; label: string };

/** Base units: grams for mass, millilitres for volume. */
const UNITS: Record<string, UnitDef> = {
  g: { kind: "mass", toBase: 1, label: "g" },
  kg: { kind: "mass", toBase: 1000, label: "kg" },
  mg: { kind: "mass", toBase: 0.001, label: "mg" },
  oz: { kind: "mass", toBase: 28.3495, label: "oz" },
  lb: { kind: "mass", toBase: 453.592, label: "lb" },
  ml: { kind: "volume", toBase: 1, label: "ml" },
  cl: { kind: "volume", toBase: 10, label: "cl" },
  dl: { kind: "volume", toBase: 100, label: "dl" },
  l: { kind: "volume", toBase: 1000, label: "l" },
  tsp: { kind: "volume", toBase: 4.92892, label: "tsp" },
  tbsp: { kind: "volume", toBase: 14.7868, label: "tbsp" },
  cup: { kind: "volume", toBase: 236.588, label: "cup" },
  floz: { kind: "volume", toBase: 29.5735, label: "fl oz" },
  pint: { kind: "volume", toBase: 473.176, label: "pint" },
  quart: { kind: "volume", toBase: 946.353, label: "quart" },
  gallon: { kind: "volume", toBase: 3785.41, label: "gallon" },
  pinch: { kind: "volume", toBase: 0.31, label: "pinch" },
  dash: { kind: "volume", toBase: 0.62, label: "dash" },
};

const ALIASES: Record<string, string> = {
  gram: "g", grams: "g", gr: "g", grs: "g",
  kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  milligram: "mg", milligrams: "mg",
  ounce: "oz", ounces: "oz",
  pound: "lb", pounds: "lb", lbs: "lb",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", mls: "ml",
  centiliter: "cl", centilitre: "cl",
  deciliter: "dl", decilitre: "dl",
  liter: "l", liters: "l", litre: "l", litres: "l",
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp", t: "tsp", "c.c.": "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", T: "tbsp", "c.s.": "tbsp",
  cups: "cup", c: "cup",
  "fl oz": "floz", "fl. oz": "floz", "fl.oz": "floz", "fluid ounce": "floz", "fluid ounces": "floz",
  pints: "pint", pt: "pint",
  quarts: "quart", qt: "quart",
  gallons: "gallon", gal: "gallon",
  pinches: "pinch",
  dashes: "dash",
};

/** Words that act as countable units (kept as-is, scaled but never converted). */
export const COUNT_UNITS = new Set([
  "clove", "cloves", "can", "cans", "slice", "slices", "stick", "sticks", "sprig", "sprigs",
  "bunch", "bunches", "head", "heads", "piece", "pieces", "pc", "pcs", "packet", "packets",
  "package", "packages", "pkg", "jar", "jars", "bottle", "bottles", "handful", "handfuls",
  "leaf", "leaves", "sheet", "sheets", "egg", "eggs", "large", "medium", "small", "whole",
  "knob", "drop", "drops", "stalk", "stalks", "fillet", "fillets", "bag", "bags", "box",
]);

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\.$/, "");
  if (trimmed === "T") return "tbsp";
  if (trimmed === "t") return "tsp";
  const lower = trimmed.toLowerCase();
  if (UNITS[lower]) return lower;
  if (ALIASES[lower]) return ALIASES[lower];
  return lower || null;
}

export function unitKind(unit: string | null | undefined): UnitKind {
  const u = normalizeUnit(unit);
  if (u && UNITS[u]) return UNITS[u].kind;
  return "count";
}

export function unitLabel(unit: string | null | undefined, qty?: number | null): string {
  const u = normalizeUnit(unit);
  if (!u) return "";
  const def = UNITS[u];
  if (!def) return unit ?? "";
  if ((u === "cup" || u === "pint" || u === "quart" || u === "gallon") && qty != null && qty > 1) {
    return `${def.label}s`;
  }
  return def.label;
}

/**
 * Approximate densities in g/ml. Matched by substring against the ingredient
 * name (longest key first) so "light brown sugar" hits "brown sugar".
 */
const DENSITY: Record<string, number> = {
  "all-purpose flour": 0.53,
  "bread flour": 0.55,
  "cake flour": 0.48,
  "whole wheat flour": 0.51,
  "almond flour": 0.4,
  "rye flour": 0.43,
  flour: 0.53,
  "powdered sugar": 0.51,
  "icing sugar": 0.51,
  "confectioners": 0.51,
  "brown sugar": 0.93,
  "caster sugar": 0.85,
  sugar: 0.85,
  honey: 1.42,
  "maple syrup": 1.32,
  syrup: 1.37,
  molasses: 1.4,
  butter: 0.96,
  "olive oil": 0.91,
  oil: 0.92,
  milk: 1.03,
  buttermilk: 1.03,
  cream: 1.0,
  yogurt: 1.03,
  "sour cream": 1.0,
  water: 1.0,
  "cocoa": 0.42,
  "baking soda": 1.1,
  "baking powder": 0.9,
  "kosher salt": 0.6,
  salt: 1.2,
  yeast: 0.6,
  "rolled oats": 0.38,
  oats: 0.38,
  rice: 0.85,
  "chocolate chips": 0.71,
  walnuts: 0.47,
  pecans: 0.46,
  almonds: 0.6,
  nuts: 0.5,
  cornstarch: 0.54,
  "corn starch": 0.54,
  "vanilla": 0.88,
  "peanut butter": 1.08,
  "cream cheese": 0.97,
  parmesan: 0.42,
  cheese: 0.45,
  "mashed banana": 0.95,
  banana: 0.95,
  raisins: 0.68,
  "coconut": 0.35,
};
const DENSITY_KEYS = Object.keys(DENSITY).sort((a, b) => b.length - a.length);

export function densityFor(name: string): number | null {
  const n = name.toLowerCase();
  for (const key of DENSITY_KEYS) if (n.includes(key)) return DENSITY[key];
  return null;
}

/** Convert a quantity into grams if possible (mass directly, volume via density). */
export function toGrams(qty: number, unit: string | null, name: string): number | null {
  const u = normalizeUnit(unit);
  if (!u) {
    // countable items with typical weights
    const n = name.toLowerCase();
    if (/\begg(s)?\b/.test(n) && !/yolk|white/.test(n)) return qty * 50;
    if (/\byolk/.test(n)) return qty * 18;
    if (/\begg white/.test(n)) return qty * 32;
    if (/\bbanana/.test(n)) return qty * 118;
    return null;
  }
  const def = UNITS[u];
  if (!def) {
    if (u === "stick" || u === "sticks") return /butter/i.test(name) ? qty * 113 : null;
    return null;
  }
  if (def.kind === "mass") return qty * def.toBase;
  const d = densityFor(name);
  return d ? qty * def.toBase * d : null;
}

export function toMl(qty: number, unit: string | null): number | null {
  const u = normalizeUnit(unit);
  if (!u || !UNITS[u] || UNITS[u].kind !== "volume") return null;
  return qty * UNITS[u].toBase;
}

export type UnitSystem = "original" | "metric" | "us";

export type DisplayQty = { qty: number | null; qtyMax?: number | null; unit: string | null; approx?: boolean };

const LIQUID = /(water|milk|cream|oil|juice|stock|broth|wine|vinegar|buttermilk|beer|coffee|syrup|sauce)/i;

/** Re-express a quantity in the requested unit system. */
export function convert(
  qty: number | null,
  unit: string | null,
  name: string,
  system: UnitSystem,
  qtyMax?: number | null,
): DisplayQty {
  if (qty == null || system === "original") return { qty, qtyMax, unit };
  const u = normalizeUnit(unit);
  const kind = unitKind(u);
  const ratio = qtyMax != null && qty ? qtyMax / qty : null;

  if (system === "metric") {
    if (kind === "mass") {
      const g = qty * UNITS[u!].toBase;
      return withMax(g >= 1000 ? { qty: g / 1000, unit: "kg" } : { qty: g, unit: "g" }, ratio);
    }
    if (kind === "volume") {
      const ml = qty * UNITS[u!].toBase;
      // small spoon measures stay as spoons, they're universal
      if (u === "tsp" || u === "tbsp" || u === "pinch" || u === "dash") return { qty, qtyMax, unit: u };
      if (!LIQUID.test(name)) {
        const g = toGrams(qty, u, name);
        if (g != null) return withMax({ qty: g, unit: "g", approx: true }, ratio);
      }
      return withMax(ml >= 1000 ? { qty: ml / 1000, unit: "l" } : { qty: ml, unit: "ml" }, ratio);
    }
    return { qty, qtyMax, unit };
  }

  // US customary
  if (kind === "mass") {
    const g = qty * UNITS[u!].toBase;
    // flour/sugar etc. read better as cups in US kitchens
    const d = densityFor(name);
    if (d && !/butter|chocolate|cheese|meat|chicken|beef|pork|fish/i.test(name) && g < 2000) {
      return withMax(bestVolume(g / d), ratio, true);
    }
    const oz = g / UNITS.oz.toBase;
    return withMax(oz >= 16 ? { qty: oz / 16, unit: "lb" } : { qty: oz, unit: "oz" }, ratio);
  }
  if (kind === "volume") {
    return withMax(bestVolume(qty * UNITS[u!].toBase), ratio);
  }
  return { qty, qtyMax, unit };
}

function withMax(d: DisplayQty, ratio: number | null, approx?: boolean): DisplayQty {
  return { ...d, qtyMax: ratio != null && d.qty != null ? d.qty * ratio : null, approx: approx ?? d.approx };
}

function bestVolume(ml: number): DisplayQty {
  if (ml < 14) return { qty: ml / UNITS.tsp.toBase, unit: "tsp" };
  if (ml < 59) return { qty: ml / UNITS.tbsp.toBase, unit: "tbsp" };
  if (ml < 3785) return { qty: ml / UNITS.cup.toBase, unit: "cup" };
  return { qty: ml / UNITS.gallon.toBase, unit: "gallon" };
}

const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

/** Human formatting: fractions for spoon/cup measures, sensible rounding for grams. */
export function formatQty(qty: number | null | undefined, unit?: string | null): string {
  if (qty == null || Number.isNaN(qty)) return "";
  const u = normalizeUnit(unit ?? null);
  const fractional = !u || ["tsp", "tbsp", "cup", "pint", "quart", "gallon", "lb", "oz"].includes(u) || COUNT_UNITS.has(u);
  if (u === "g" || u === "ml") {
    if (qty >= 100) return String(Math.round(qty / 5) * 5);
    if (qty >= 10) return String(Math.round(qty));
    return String(Math.round(qty * 10) / 10);
  }
  if (fractional) {
    const whole = Math.floor(qty + 1e-9);
    const rest = qty - whole;
    if (rest < 0.06) return String(whole || (qty > 0 ? "⅛" : 0));
    if (rest > 0.94) return String(whole + 1);
    let best = FRACTIONS[0];
    for (const f of FRACTIONS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
    return whole ? `${whole}${best[1]}` : best[1];
  }
  if (qty >= 100) return String(Math.round(qty));
  return String(Math.round(qty * 100) / 100);
}

export function formatAmount(d: DisplayQty): string {
  if (d.qty == null) return "";
  const main = formatQty(d.qty, d.unit);
  const max = d.qtyMax != null && d.qtyMax !== d.qty ? `–${formatQty(d.qtyMax, d.unit)}` : "";
  const label = unitLabel(d.unit, d.qtyMax ?? d.qty);
  return `${d.approx ? "~" : ""}${main}${max}${label ? (label.length <= 3 && /^(g|kg|mg|ml|l|cl|dl|oz|lb)$/.test(label) ? "" : " ") + label : ""}`;
}

export function formatMinutes(m: number | null | undefined): string {
  if (!m) return "–";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${r}m` : `${h}h`;
}
