/** Rough supermarket aisle classifier for grouping the shopping list. */
export const AISLES = [
  { id: "produce", label: "Produce", re: /(onion|garlic|shallot|lemon|lime|apple|banana|berr|tomato(?!.*(can|paste|crushed))|potato|carrot|celery|lettuce|spinach|kale|herb|parsley|cilantro|basil|mint|thyme|rosemary|ginger|pepper(?!corn)|chili(?! powder)|scallion|leek|cucumber|zucchini|squash|mushroom|avocado|orange|fruit|vegetable|cabbage|broccoli|cauliflower)/i },
  { id: "dairy", label: "Dairy & eggs", re: /(milk|butter(?!milk)|buttermilk|cream|cheese|yogurt|egg|crème|creme|parmesan|mozzarella|cheddar|ricotta)/i },
  { id: "meat", label: "Meat & fish", re: /(beef|pork|chicken|turkey|lamb|bacon|sausage|fish|salmon|tuna|shrimp|prawn|anchov|ham)/i },
  { id: "bakery", label: "Baking", re: /(flour|sugar|yeast|baking (soda|powder)|cocoa|chocolate|vanilla|cornstarch|starch|levain|sprinkles|gelatin|almond flour|oats)/i },
  { id: "pantry", label: "Pantry", re: /(oil|vinegar|salt|pepper|spice|cumin|paprika|cinnamon|nutmeg|powder|rice|pasta|noodle|bean|lentil|chickpea|can|stock|broth|sauce|paste|mustard|honey|syrup|jam|nut|walnut|pecan|almond|raisin|coffee|espresso|tea)/i },
  { id: "frozen", label: "Frozen", re: /(frozen|ice)/i },
  { id: "drinks", label: "Drinks", re: /(wine|beer|juice|soda water|sparkling)/i },
] as const;

export function aisleFor(name: string): string {
  for (const a of AISLES) if (a.re.test(name)) return a.id;
  return "other";
}

export function aisleLabel(id: string): string {
  return AISLES.find((a) => a.id === id)?.label ?? "Other";
}
