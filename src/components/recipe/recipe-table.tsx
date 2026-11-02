"use client";

import * as React from "react";
import { ThermometerIcon, TimerIcon } from "@phosphor-icons/react";
import type { Ingredient, RecipeData, Step } from "@/lib/recipe/schema";
import { buildTable, downstreamOf } from "@/lib/recipe/graph";
import { convert, formatAmount, formatMinutes, type UnitSystem } from "@/lib/recipe/units";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export type TableProps = {
  recipe: RecipeData;
  factor?: number;
  units?: UnitSystem;
  bakers?: Map<string, number> | null;
  done?: Set<string>;
  onToggleDone?: (stepId: string) => void;
  compact?: boolean;
  className?: string;
};

export function fmtIngredient(i: Ingredient, factor: number, units: UnitSystem) {
  const q = i.qty == null ? null : i.qty * factor;
  const qm = i.qtyMax == null ? null : i.qtyMax * factor;
  return formatAmount(convert(q, i.unit, i.name, units, qm));
}

/**
 * Cooking-for-Engineers table. Ingredients on the left, operations merge
 * rightwards. Hover any cell to trace what feeds it (upstream) and where it
 * goes (downstream). Click a step to mark it done.
 */
export function RecipeTable({ recipe, factor = 1, units = "original", bakers, done, onToggleDone, compact, className }: TableProps) {
  const table = React.useMemo(() => buildTable(recipe), [recipe]);
  const downstream = React.useMemo(() => downstreamOf(recipe), [recipe]);
  const [hover, setHover] = React.useState<string | null>(null);

  // Ingredient → consuming step (for downstream from an ingredient)
  const consumerOf = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of recipe.steps) for (const i of s.inputs ?? []) if (!m.has(i)) m.set(i, s.id);
    return m;
  }, [recipe]);

  const lit = React.useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>(table.upstream.get(hover) ?? [hover]);
    const startDown = recipe.steps.some((s) => s.id === hover) ? hover : consumerOf.get(hover);
    if (startDown) {
      set.add(startDown);
      downstream.get(startDown)?.forEach((x) => set.add(x));
    }
    return set;
  }, [hover, table, downstream, consumerOf, recipe.steps]);

  const cols = table.levels + 2;
  const gridTemplateColumns = `minmax(${compact ? "3.5rem" : "4.5rem"}, max-content) minmax(${compact ? "7rem" : "9rem"}, 1.4fr) repeat(${table.levels}, minmax(${compact ? "4.6rem" : "7.5rem"}, 1fr))`;

  const dim = (id: string) => lit !== null && !lit.has(id);

  return (
    <div className={cn("overflow-x-auto", className)}>
      {table.setup.length > 0 && (
        <div className="mb-px flex flex-col gap-px">
          {table.setup.map(({ step, index }) => (
            <SetupRow key={step.id} step={step} index={index} done={done?.has(step.id)} onToggle={onToggleDone} />
          ))}
        </div>
      )}
      <div
        className="grid min-w-fit gap-px border bg-border"
        style={{ gridTemplateColumns, gridTemplateRows: `repeat(${Math.max(1, table.rows.length)}, minmax(2.25rem, auto))` }}
        onMouseLeave={() => setHover(null)}
      >
        {/* qty column */}
        {table.rows.map((ing, row) =>
          ing ? (
            <div
              key={`q-${ing.id}`}
              className={cn(
                "flex items-center justify-end bg-card px-2.5 text-right text-xs font-semibold text-brand tabular transition-opacity",
                dim(ing.id) && "opacity-30",
              )}
              style={{ gridRow: row + 1, gridColumn: 1 }}
              onMouseEnter={() => setHover(ing.id)}
            >
              <span className="flex flex-col items-end leading-tight">
                {fmtIngredient(ing, factor, units) || <span className="text-faint">—</span>}
                {bakers?.has(ing.id) && <span className="text-[10px] font-normal text-muted-foreground">{bakers.get(ing.id)!.toFixed(bakers.get(ing.id)! < 10 ? 1 : 0)}%</span>}
              </span>
            </div>
          ) : null,
        )}
        {table.cells.map((c) => {
          if (c.kind === "blank") {
            return <div key={`b-${c.row}`} className="bg-card bg-dots" style={{ gridRow: c.row + 1, gridColumn: `${c.col + 1} / span ${c.colSpan}` }} />;
          }
          if (c.kind === "ingredient") {
            const i = c.ingredient;
            return (
              <div
                key={`i-${i.id}`}
                onMouseEnter={() => setHover(i.id)}
                className={cn("flex items-center bg-card px-2.5 py-1.5 text-xs transition-opacity", dim(i.id) && "opacity-30", lit?.has(i.id) && "bg-brand-tint")}
                style={{ gridRow: c.row + 1, gridColumn: `${c.col + 1} / span ${c.colSpan}` }}
              >
                <span>
                  {i.name}
                  {i.note && <span className="text-muted-foreground">, {i.note}</span>}
                </span>
              </div>
            );
          }
          const s = c.step;
          const isDone = done?.has(s.id);
          const depth = (c.col - 1) / Math.max(1, table.levels);
          return (
            <HoverCard key={`s-${s.id}`} openDelay={350} closeDelay={50}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onMouseEnter={() => setHover(s.id)}
                  onClick={() => onToggleDone?.(s.id)}
                  data-cuelume-toggle={onToggleDone ? "" : undefined}
                  className={cn(
                    "group/step relative flex flex-col items-start justify-center gap-0.5 px-2.5 py-1.5 text-left transition-[opacity,background-color]",
                    "bg-[color-mix(in_oklch,var(--card),var(--brand)_calc(var(--d)*16%))]",
                    lit?.has(s.id) && "bg-[color-mix(in_oklch,var(--card),var(--brand)_30%)]",
                    dim(s.id) && "opacity-30",
                    isDone && "opacity-45",
                  )}
                  style={{ gridRow: `${c.row + 1} / span ${c.rowSpan}`, gridColumn: `${c.col + 1} / span ${c.colSpan}`, ["--d" as string]: depth }}
                >
                  <span className="absolute top-1 right-1.5 text-[9.5px] text-muted-foreground tabular">{String(c.index + 1).padStart(2, "0")}</span>
                  <span className={cn("pr-4 text-[13px] font-semibold leading-tight", isDone && "line-through decoration-brand decoration-2")}>{s.action}</span>
                  {(s.minutes || s.temperature) && (
                    <span className="flex flex-wrap gap-x-2 text-[10.5px] text-muted-foreground tabular">
                      {s.minutes ? (
                        <span className="flex items-center gap-0.5">
                          <TimerIcon className="size-3" />
                          {formatMinutes(s.minutes)}
                        </span>
                      ) : null}
                      {s.temperature ? (
                        <span className="flex items-center gap-0.5">
                          <ThermometerIcon className="size-3" />
                          {s.temperature.value}°{s.temperature.unit}
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="top" className="w-80 text-xs leading-relaxed">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-brand">
                  step {c.index + 1} · {s.action}
                </p>
                {s.text}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] text-faint" data-noprint>
        hover to trace dependencies · {onToggleDone ? "click a step to mark it done · " : ""}
        {cols - 2} levels deep
      </p>
    </div>
  );
}

function SetupRow({ step, index, done, onToggle }: { step: Step; index: number; done?: boolean; onToggle?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle?.(step.id)}
      className={cn("flex w-full items-center gap-3 border border-dashed bg-card px-3 py-1.5 text-left text-xs", done && "opacity-45")}
    >
      <span className="text-[10px] text-muted-foreground tabular">{String(index + 1).padStart(2, "0")}</span>
      <span className={cn("font-semibold", done && "line-through decoration-brand decoration-2")}>{step.action}</span>
      <span className="truncate text-muted-foreground">{step.text}</span>
      {step.temperature && (
        <span className="ml-auto shrink-0 text-brand tabular">
          {step.temperature.value}°{step.temperature.unit}
        </span>
      )}
    </button>
  );
}
