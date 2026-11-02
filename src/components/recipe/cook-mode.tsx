"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftIcon, ArrowRightIcon, PlayIcon, ThermometerIcon, XIcon, CheckCircleIcon } from "@phosphor-icons/react";
import type { RecipeData } from "@/lib/recipe/schema";
import { formatMinutes } from "@/lib/recipe/units";
import { TimersProvider, useTimers } from "./timers";
import { fmtIngredient } from "./recipe-table";
import { useSound } from "@/components/providers";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export function CookMode(props: { recipe: RecipeData; path: string; factor: number }) {
  return (
    <TimersProvider>
      <Inner {...props} />
    </TimersProvider>
  );
}

/** Distraction-free, one-step-at-a-time view. j/k or ←/→ to move, t to start the step timer. */
function Inner({ recipe, path, factor }: { recipe: RecipeData; path: string; factor: number }) {
  const [i, setI] = React.useState(-1); // -1 = mise en place
  const [dir, setDir] = React.useState(1);
  const { start } = useTimers();
  const { play } = useSound();
  const total = recipe.steps.length;
  const step = i >= 0 ? recipe.steps[i] : null;
  const ingById = new Map(recipe.ingredients.map((x) => [x.id, x]));
  const stepById = new Map(recipe.steps.map((x, idx) => [x.id, idx]));

  const go = React.useCallback(
    (d: number) => {
      setI((cur) => {
        const next = Math.max(-1, Math.min(total, cur + d));
        if (next !== cur) {
          setDir(d);
          if (next === total) play("success", { emphasis: "strong" });
        }
        return next;
      });
    },
    [total, play],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "j", " ", "l"].includes(e.key)) {
        e.preventDefault();
        go(1);
      }
      if (["ArrowLeft", "k", "h"].includes(e.key)) go(-1);
      if (e.key === "t" && step?.minutes) start(step.id, `${i + 1}. ${step.action}`, step.minutes);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, start, i]);

  // Keep the screen awake while cooking.
  React.useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-xs">
        <Link href={path} className="flex items-center gap-1 text-muted-foreground hover:text-foreground" aria-label="Exit cook mode">
          <XIcon /> exit
        </Link>
        <span className="truncate font-semibold">{recipe.title}</span>
        {factor !== 1 && <span className="text-brand tabular">×{+factor.toFixed(2)}</span>}
        <span className="ml-auto text-muted-foreground tabular">
          {i < 0 ? "mise en place" : i >= total ? "done" : `step ${i + 1}/${total}`}
        </span>
      </div>
      <div className="h-1 bg-muted">
        <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${(Math.max(0, i + 1) / (total + 1)) * 100}%` }} />
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-10"
          >
            {i < 0 && (
              <>
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-brand">mise en place</p>
                <h1 className="mb-6 text-3xl font-bold">Gather everything first.</h1>
                <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {recipe.ingredients.map((x) => (
                    <li key={x.id} className="flex gap-3 border-b pb-2 text-base">
                      <span className="w-24 shrink-0 text-right font-semibold text-brand tabular">{fmtIngredient(x, factor, "original")}</span>
                      <span>{x.name}</span>
                    </li>
                  ))}
                </ul>
                {recipe.equipment.length > 0 && <p className="mt-6 text-sm text-muted-foreground">requires: {recipe.equipment.join(" · ")}</p>}
              </>
            )}
            {step && (
              <>
                <p className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-brand">
                  <span className="tabular">{String(i + 1).padStart(2, "0")}</span> {step.action}
                  {step.temperature && (
                    <span className="flex items-center gap-1 normal-case tracking-normal text-muted-foreground">
                      <ThermometerIcon /> {step.temperature.value}°{step.temperature.unit}
                    </span>
                  )}
                </p>
                <p className="text-2xl leading-snug font-medium text-balance sm:text-3xl">{step.text}</p>
                {(step.inputs ?? []).length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {step.inputs.map((id) => {
                      const ing = ingById.get(id);
                      if (ing)
                        return (
                          <span key={id} className="border px-3 py-1.5 text-sm">
                            <span className="font-semibold text-brand tabular">{fmtIngredient(ing, factor, "original")}</span> {ing.name}
                          </span>
                        );
                      const si = stepById.get(id);
                      return si != null ? (
                        <span key={id} className="border border-dashed px-3 py-1.5 text-sm text-muted-foreground">
                          ↳ result of step {si + 1} ({recipe.steps[si].action.toLowerCase()})
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {step.minutes ? (
                  <button
                    onClick={() => start(step.id, `${i + 1}. ${step.action}`, step.minutes!)}
                    className="mt-8 flex w-fit items-center gap-2 bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/85"
                  >
                    <PlayIcon weight="fill" /> start {formatMinutes(step.minutes)} timer <Kbd className="!rounded-none bg-black/15 text-inherit">t</Kbd>
                  </button>
                ) : null}
              </>
            )}
            {i >= total && (
              <div className="text-center">
                <CheckCircleIcon className="mx-auto size-16 text-add" weight="fill" />
                <h1 className="mt-4 text-3xl font-bold">Build passed.</h1>
                <p className="mt-2 text-muted-foreground">Log how it went so others (and future you) can learn from it.</p>
                <Link href={path} className="mt-6 inline-block bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
                  back to recipe → log build
                </Link>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3">
        <button onClick={() => go(-1)} disabled={i < 0} className="flex items-center gap-2 border px-4 py-2 text-sm disabled:opacity-30">
          <ArrowLeftIcon /> prev
        </button>
        <div className="hidden gap-1 sm:flex">
          {[-1, ...recipe.steps.map((_, idx) => idx)].map((idx) => (
            <button
              key={idx}
              onClick={() => {
                setDir(idx > i ? 1 : -1);
                setI(idx);
              }}
              className={cn("h-1.5 w-6", idx === i ? "bg-brand" : idx < i ? "bg-foreground/50" : "bg-muted")}
              aria-label={idx < 0 ? "Mise en place" : `Step ${idx + 1}`}
            />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={i >= total} className="flex items-center gap-2 bg-foreground px-4 py-2 text-sm text-background disabled:opacity-30">
          next <ArrowRightIcon />
        </button>
      </div>
      <p className="pb-2 text-center text-[10.5px] text-faint">
        <Kbd className="!rounded-none">←</Kbd> <Kbd className="!rounded-none">→</Kbd> or <Kbd className="!rounded-none">j</Kbd> <Kbd className="!rounded-none">k</Kbd> to navigate · screen stays awake
      </p>
    </div>
  );
}
