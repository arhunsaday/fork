import type { RecipeData } from "@/lib/recipe/schema";
import { buildTable } from "@/lib/recipe/graph";
import { cn } from "@/lib/utils";

/**
 * A tiny silhouette of the recipe's table: ingredient rows on the left and
 * step blocks merging rightwards. Doubles as a visual fingerprint of the recipe.
 */
export function MiniGraph({ data, className }: { data: RecipeData; className?: string }) {
  const t = buildTable(data);
  const rows = Math.max(1, t.rows.length);
  const cols = t.levels + 2;
  const W = 100;
  const H = 80;
  const rh = H / rows;
  const cw = W / (cols + 1.2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("text-foreground", className)} aria-hidden>
      {t.cells.map((c, i) => {
        if (c.kind === "blank") return null;
        const x = c.kind === "ingredient" ? 0 : (c.col + 0.2) * cw;
        const w = c.kind === "ingredient" ? cw * 2 : c.colSpan * cw - 1.5;
        return (
          <rect
            key={i}
            x={x}
            y={c.row * rh + 0.75}
            width={w}
            height={c.rowSpan * rh - 1.5}
            className={c.kind === "ingredient" ? "fill-muted-foreground/25" : "fill-brand/70 group-hover:fill-brand"}
            style={c.kind === "step" ? { opacity: 0.35 + (0.65 * (c.col - 1)) / Math.max(1, t.levels) } : undefined}
          />
        );
      })}
    </svg>
  );
}
