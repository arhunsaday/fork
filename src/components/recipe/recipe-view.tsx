"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsFloat, parseAsStringLiteral, parseAsBoolean, useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  BasketIcon,
  ChartBarHorizontalIcon,
  CheckIcon,
  ListNumbersIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  PrinterIcon,
  TableIcon,
  ThermometerIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { RecipeData } from "@/lib/recipe/schema";
import { BAKERS_CATEGORIES } from "@/lib/recipe/schema";
import { bakersPercentages, totalMassGrams } from "@/lib/recipe/scale";
import { formatMinutes, type UnitSystem } from "@/lib/recipe/units";
import { schedule } from "@/lib/recipe/graph";
import { coverage, pantryHas } from "@/lib/recipe/match";
import { RecipeTable, fmtIngredient } from "./recipe-table";
import { TimersProvider, useTimers } from "./timers";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addToShoppingAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { cn } from "@/lib/utils";

const VIEWS = ["table", "steps", "timeline"] as const;
const UNITS = ["original", "metric", "us"] as const;

export type RecipeViewProps = {
  recipe: RecipeData;
  recipeId: string;
  signedIn: boolean;
  pantry: { ingredients: string[]; equipment: string[] } | null;
};

export function RecipeView(props: RecipeViewProps) {
  return (
    <TimersProvider>
      <RecipeViewInner {...props} />
    </TimersProvider>
  );
}

function RecipeViewInner({ recipe, recipeId, signedIn, pantry }: RecipeViewProps) {
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("table"));
  const [units, setUnits] = useQueryState("units", parseAsStringLiteral(UNITS).withDefault("original"));
  const [servings, setServings] = useQueryState("servings", parseAsFloat.withDefault(recipe.servings));
  const bakersDefault = BAKERS_CATEGORIES.includes(recipe.category);
  const [showBakers, setShowBakers] = useQueryState("bakers", parseAsBoolean.withDefault(bakersDefault));
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const { play } = useSound();

  const factor = servings / recipe.servings;
  const bakers = React.useMemo(() => bakersPercentages(recipe), [recipe]);
  const mass = React.useMemo(() => totalMassGrams(recipe), [recipe]);

  const toggleDone = (id: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setFactor = (f: number) => setServings(Math.max(0.25, Math.round(recipe.servings * f * 100) / 100));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border bg-card px-2 py-1.5" data-noprint>
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as (typeof VIEWS)[number])} size="sm" variant="outline">
          <ToggleGroupItem value="table" aria-label="Table view" data-cuelume-select>
            <TableIcon /> table
          </ToggleGroupItem>
          <ToggleGroupItem value="steps" aria-label="Steps view" data-cuelume-select>
            <ListNumbersIcon /> steps
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" aria-label="Timeline view" data-cuelume-select>
            <ChartBarHorizontalIcon /> timeline
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">yield</span>
          <Button variant="outline" size="icon-xs" onClick={() => setServings(Math.max(1, Math.round(servings) - 1))} aria-label="Fewer servings" data-cuelume-select>
            <MinusIcon />
          </Button>
          <input
            className="h-6 w-10 border bg-background text-center text-xs tabular outline-none focus:border-brand"
            value={Number.isInteger(servings) ? servings : servings.toFixed(2)}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) setServings(n);
            }}
            inputMode="decimal"
            aria-label="Servings"
          />
          <Button variant="outline" size="icon-xs" onClick={() => setServings(Math.round(servings) + 1)} aria-label="More servings" data-cuelume-select>
            <PlusIcon />
          </Button>
          <span className="ml-1 hidden gap-px sm:flex">
            {[0.5, 1, 2, 3].map((f) => (
              <button
                key={f}
                onClick={() => setFactor(f)}
                data-cuelume-select
                className={cn("h-6 px-1.5 text-[11px] hover:bg-muted", Math.abs(factor - f) < 0.001 ? "bg-foreground text-background hover:bg-foreground" : "text-muted-foreground")}
              >
                {f === 0.5 ? "½" : f}×
              </button>
            ))}
          </span>
        </div>

        <ToggleGroup type="single" value={units} onValueChange={(v) => v && setUnits(v as UnitSystem)} size="sm" variant="outline">
          <ToggleGroupItem value="original" data-cuelume-select>
            orig
          </ToggleGroupItem>
          <ToggleGroupItem value="metric" data-cuelume-select>
            metric
          </ToggleGroupItem>
          <ToggleGroupItem value="us" data-cuelume-select>
            US
          </ToggleGroupItem>
        </ToggleGroup>

        {bakers && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={showBakers} onCheckedChange={(v) => setShowBakers(!!v)} data-cuelume-toggle />
            baker&apos;s %
            {bakers.hydration > 1 && <span className="text-foreground tabular">hydration {bakers.hydration.toFixed(0)}%</span>}
          </label>
        )}

        <div className="ml-auto flex items-center gap-1">
          {factor !== 1 && (
            <span className="text-[11px] text-brand tabular">
              ×{factor.toFixed(2).replace(/\.?0+$/, "")}
              {mass ? ` · ${Math.round((mass * factor) / 5) * 5} g total` : ""}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => window.print()} aria-label="Print">
                <PrinterIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>print / save as PDF</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {view === "table" && (
        <RecipeTable
          recipe={recipe}
          factor={factor}
          units={units}
          bakers={showBakers ? bakers?.pct : null}
          done={done}
          onToggleDone={(id) => {
            toggleDone(id);
            if (!done.has(id) && done.size + 1 === recipe.steps.length) play("success");
          }}
        />
      )}
      {view === "steps" && <StepsView recipe={recipe} factor={factor} units={units} done={done} onToggle={toggleDone} bakers={showBakers ? bakers?.pct : null} />}
      {view === "timeline" && <TimelineView recipe={recipe} />}

      <PantryPanel recipe={recipe} recipeId={recipeId} factor={factor} signedIn={signedIn} pantry={pantry} />
    </div>
  );
}

function StepsView({
  recipe,
  factor,
  units,
  done,
  onToggle,
  bakers,
}: {
  recipe: RecipeData;
  factor: number;
  units: UnitSystem;
  done: Set<string>;
  onToggle: (id: string) => void;
  bakers?: Map<string, number> | null;
}) {
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const { start } = useTimers();
  const ingById = new Map(recipe.ingredients.map((i) => [i.id, i]));
  const groups = Array.from(new Set(recipe.ingredients.map((i) => i.group ?? "")));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <div>
        <h3 className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>
            <span className="text-brand">#</span> mise en place
          </span>
          <span className="tabular normal-case tracking-normal">
            {checked.size}/{recipe.ingredients.length}
          </span>
        </h3>
        {groups.map((g) => (
          <div key={g} className="mb-3">
            {g && <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{g}</p>}
            <ul className="divide-y border">
              {recipe.ingredients
                .filter((i) => (i.group ?? "") === g)
                .map((i) => (
                  <li key={i.id}>
                    <label className={cn("flex cursor-pointer items-baseline gap-2.5 px-2.5 py-1.5 text-xs hover:bg-muted/60", checked.has(i.id) && "text-muted-foreground line-through")}>
                      <Checkbox
                        className="translate-y-0.5"
                        checked={checked.has(i.id)}
                        data-cuelume-toggle
                        onCheckedChange={() =>
                          setChecked((c) => {
                            const n = new Set(c);
                            if (n.has(i.id)) n.delete(i.id);
                            else n.add(i.id);
                            return n;
                          })
                        }
                      />
                      <span className="w-20 shrink-0 text-right font-semibold text-brand tabular">{fmtIngredient(i, factor, units)}</span>
                      <span className="flex-1">
                        {i.name}
                        {i.note && <span className="text-muted-foreground">, {i.note}</span>}
                      </span>
                      {bakers?.has(i.id) && <span className="text-[10px] text-muted-foreground tabular">{bakers.get(i.id)!.toFixed(bakers.get(i.id)! < 10 ? 1 : 0)}%</span>}
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <ol className="space-y-px">
        {recipe.steps.map((s, idx) => {
          const used = (s.inputs ?? []).map((id) => ingById.get(id)).filter(Boolean);
          const isDone = done.has(s.id);
          return (
            <li key={s.id} className={cn("group flex gap-3 border bg-card p-3 transition-opacity", isDone && "opacity-50")}>
              <button
                onClick={() => onToggle(s.id)}
                data-cuelume-toggle
                className={cn("flex size-7 shrink-0 items-center justify-center border text-xs font-bold tabular", isDone ? "border-brand bg-brand text-brand-foreground" : "hover:border-brand")}
                aria-label={isDone ? "Mark step not done" : "Mark step done"}
              >
                {isDone ? <CheckIcon weight="bold" /> : idx + 1}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">{s.action}</span>
                  {s.temperature && (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground tabular">
                      <ThermometerIcon className="size-3" />
                      {s.temperature.value}°{s.temperature.unit}
                    </span>
                  )}
                  {s.minutes ? (
                    <button
                      onClick={() => start(s.id, `${idx + 1}. ${s.action}`, s.minutes!)}
                      className="flex items-center gap-1 border px-1.5 text-[11px] text-muted-foreground tabular hover:border-brand hover:text-brand"
                      data-cuelume-tap
                    >
                      <PlayIcon className="size-2.5" weight="fill" /> {formatMinutes(s.minutes)}
                    </button>
                  ) : null}
                </div>
                <p className={cn("mt-1 text-[13px] leading-relaxed", isDone && "line-through decoration-muted-foreground")}>{s.text}</p>
                {used.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {used.map((i) => (
                      <span key={i!.id} className="bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                        <span className="text-foreground tabular">{fmtIngredient(i!, factor, units)}</span> {i!.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Gantt chart on a log-time axis: long rests don't swallow the short active steps. */
function TimelineView({ recipe }: { recipe: RecipeData }) {
  const sched = schedule(recipe);
  const total = Math.max(1, ...sched.map((s) => s.end));
  const pos = (t: number) => (Math.log1p(t) / Math.log1p(total)) * 100;
  const byId = new Map(recipe.steps.map((s) => [s.id, s]));
  const ticks = [0, 5, 15, 30, 60, 120, 240, 480, 960, 1440, 2880].filter((t) => t <= total);
  const parallel = sched.filter((a) => sched.some((b) => b !== a && b.start < a.end && a.start < b.end)).length;
  return (
    <div className="border bg-card p-3">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          critical path: <span className="font-semibold text-foreground tabular">{formatMinutes(total)}</span>
        </span>
        <span>
          sum of steps: <span className="text-foreground tabular">{formatMinutes(recipe.steps.reduce((a, s) => a + (s.minutes ?? 2), 0))}</span>
        </span>
        <span>{parallel ? `${parallel} steps can overlap` : "fully sequential"}</span>
        <span className="ml-auto">x-axis: log(t)</span>
      </div>
      <div className="relative space-y-1">
        <div className="pointer-events-none absolute inset-0 ml-[9.5rem]">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-y-0 border-l border-dashed border-grid" style={{ left: `${pos(t)}%` }}>
              <span className="absolute -bottom-5 -translate-x-1/2 text-[9.5px] text-faint tabular">{formatMinutes(t) === "–" ? "0" : formatMinutes(t)}</span>
            </div>
          ))}
        </div>
        {sched.map((s, i) => {
          const step = byId.get(s.id)!;
          return (
            <div key={s.id} className="relative flex items-center gap-2">
              <span className="w-36 shrink-0 truncate text-xs">
                <span className="text-faint tabular">{String(i + 1).padStart(2, "0")}</span> {step.action}
              </span>
              <div className="relative h-5 flex-1">
                <div
                  className="absolute inset-y-0 flex items-center bg-brand/80 px-1 text-[10px] text-brand-foreground tabular"
                  style={{ left: `${pos(s.start)}%`, width: `max(${pos(s.end) - pos(s.start)}%, 3px)` }}
                  title={step.text}
                >
                  <span className="truncate">{step.minutes ? formatMinutes(step.minutes) : ""}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-6" />
    </div>
  );
}

function PantryPanel({ recipe, recipeId, factor, signedIn, pantry }: { recipe: RecipeData; recipeId: string; factor: number; signedIn: boolean; pantry: RecipeViewProps["pantry"] }) {
  const [pending, setPending] = React.useTransition();
  const { play } = useSound();
  const router = useRouter();
  const cov = pantry ? coverage(recipe, pantry.ingredients, pantry.equipment) : null;

  const add = (onlyMissing: boolean) =>
    setPending(async () => {
      const items = recipe.ingredients
        .filter((i) => !onlyMissing || !pantry || !pantryHas(pantry.ingredients, i.name))
        .map((i) => ({ name: i.name, qty: i.qty == null ? null : i.qty * factor, unit: i.unit, recipeId, recipeTitle: recipe.title }));
      const res = await addToShoppingAction(items);
      if (res.ok) {
        play("success", { emphasis: "subtle" });
        toast.success(`${res.added} added, ${res.merged} merged into your shopping list`, { action: { label: "open", onClick: () => router.push("/shopping") } });
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-px border bg-border sm:grid-cols-[1fr_auto]" data-noprint>
      <div className="bg-card p-3 text-xs">
        {!signedIn ? (
          <p className="text-muted-foreground">
            <Link href="/sign-in" className="text-brand hover:underline">
              Sign in
            </Link>{" "}
            to check this recipe against your pantry and send ingredients to your shopping list.
          </p>
        ) : cov ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">pantry match</span>
              <div className="h-1.5 w-40 bg-muted">
                <div className="h-full bg-add" style={{ width: `${cov.pct * 100}%` }} />
              </div>
              <span className="tabular">
                {cov.have.length}/{recipe.ingredients.length}
              </span>
              {!pantry?.ingredients.length && (
                <Link href="/pantry" className="text-brand hover:underline">
                  set up your pantry →
                </Link>
              )}
            </div>
            {cov.missing.length > 0 && (
              <p className="flex flex-wrap gap-1">
                <span className="text-muted-foreground">missing deps:</span>
                {cov.missing.map((i) => (
                  <span key={i.id} className="bg-del-tint px-1.5 text-del">
                    {i.name}
                  </span>
                ))}
              </p>
            )}
            {recipe.equipment.length > 0 && (
              <p className="flex flex-wrap gap-1">
                <span className="text-muted-foreground">requires:</span>
                {recipe.equipment.map((e) => {
                  const ok = pantry ? pantryHas(pantry.equipment, e) : false;
                  return (
                    <span key={e} className={cn("flex items-center gap-1 px-1.5", ok ? "bg-add-tint text-add" : "bg-muted text-muted-foreground")}>
                      {ok ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
                      {e}
                    </span>
                  );
                })}
              </p>
            )}
          </div>
        ) : null}
      </div>
      {signedIn && (
        <div className="flex items-center gap-1 bg-card p-3">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => add(true)}>
            <BasketIcon /> add missing
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => add(false)}>
            add all
          </Button>
        </div>
      )}
    </div>
  );
}
