import type { RecipeData } from "./schema";
import { formatAmount, unitLabel } from "./units";

const amt = (i: RecipeData["ingredients"][number]) => formatAmount({ qty: i.qty, qtyMax: i.qtyMax, unit: i.unit });

export function toMarkdown(r: RecipeData, path?: string): string {
  const lines = [`# ${r.title}`, ""];
  if (r.description) lines.push(r.description, "");
  const meta = [
    `serves ${r.servings}`,
    r.yieldLabel,
    r.prepMinutes ? `prep ${r.prepMinutes}m` : null,
    r.cookMinutes ? `cook ${r.cookMinutes}m` : null,
  ].filter(Boolean);
  lines.push(`> ${meta.join(" · ")}`, "");
  if (r.equipment.length) lines.push(`**Requires:** ${r.equipment.join(", ")}`, "");
  lines.push("## Ingredients", "");
  for (const i of r.ingredients) lines.push(`- ${amt(i) ? `**${amt(i)}** ` : ""}${i.name}${i.note ? `, ${i.note}` : ""}`);
  lines.push("", "## Method", "");
  r.steps.forEach((s, idx) => lines.push(`${idx + 1}. **${s.action}.** ${s.text}`));
  if (r.notes) lines.push("", "## Notes", "", r.notes);
  if (path) lines.push("", `---`, `forked on fork: ${path}`);
  return lines.join("\n");
}

/** Cooklang (https://cooklang.org) export: ingredients inlined into steps. */
export function toCooklang(r: RecipeData): string {
  const ingById = new Map(r.ingredients.map((i) => [i.id, i]));
  const out = [`>> title: ${r.title}`, `>> servings: ${r.servings}`];
  if (r.prepMinutes) out.push(`>> prep time: ${r.prepMinutes} minutes`);
  if (r.cookMinutes) out.push(`>> cook time: ${r.cookMinutes} minutes`);
  out.push("");
  for (const s of r.steps) {
    let text = s.text;
    const extras: string[] = [];
    for (const id of s.inputs ?? []) {
      const i = ingById.get(id);
      if (!i) continue;
      const q = i.qty != null ? `{${+i.qty.toFixed(3)}${i.unit ? `%${unitLabel(i.unit)}` : ""}}` : "{}";
      const tag = `@${i.name}${q}`;
      const re = new RegExp(`\\b${i.name.split(" ").pop()!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text) && !text.includes("@")) text = text.replace(re, tag);
      else extras.push(tag);
    }
    if (s.minutes) text += ` ~{${s.minutes}%minutes}`;
    out.push(extras.length ? `${text} (${extras.join(", ")})` : text, "");
  }
  return out.join("\n");
}

export function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
