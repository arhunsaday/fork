"use client";

import * as React from "react";
import type { RecipeData } from "@/lib/recipe/schema";
import { RecipeTable } from "@/components/recipe/recipe-table";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/recipe/units";

/** Interactive mini-demo of the table: scale + unit toggles right in the hero. */
export function HeroDemo({ recipe }: { recipe: RecipeData }) {
  const [factor, setFactor] = React.useState(1);
  const [units, setUnits] = React.useState<UnitSystem>("original");
  return (
    <div className="min-w-0 border bg-background shadow-2xl shadow-black/20">
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="flex gap-1">
          <span className="size-2 bg-del/70" />
          <span className="size-2 bg-chart-4/70" />
          <span className="size-2 bg-add/70" />
        </span>
        <span className="ml-2 truncate">ada_bakes/banana-nut-bread — table.view</span>
        <span className="ml-auto flex gap-px">
          {[0.5, 1, 2].map((f) => (
            <button key={f} onClick={() => setFactor(f)} data-cuelume-select className={cn("px-1.5", factor === f ? "bg-foreground text-background" : "hover:bg-muted")}>
              {f === 0.5 ? "½" : f}×
            </button>
          ))}
        </span>
        <span className="flex gap-px">
          {(["original", "us"] as const).map((u) => (
            <button key={u} onClick={() => setUnits(u)} data-cuelume-select className={cn("px-1.5", units === u ? "bg-foreground text-background" : "hover:bg-muted")}>
              {u === "original" ? "g" : "US"}
            </button>
          ))}
        </span>
      </div>
      <div className="p-3">
        <RecipeTable recipe={recipe} factor={factor} units={units} compact />
      </div>
    </div>
  );
}
