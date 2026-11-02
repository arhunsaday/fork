"use client";

import * as React from "react";
import { CheckIcon } from "@phosphor-icons/react";
import type { RecipeDiff, IngredientChange, StepChange } from "@/lib/recipe/diff";
import { amountString } from "@/lib/recipe/diff";
import { cn } from "@/lib/utils";

/**
 * Unified recipe diff. In `selectable` mode each changed row is a toggle that
 * includes/excludes that hunk (pattern adapted from Beautiful UI's Diff Table).
 */
export function DiffView({
  diff,
  selectable,
  accepted,
  onToggle,
  showUnchanged = true,
  animate,
}: {
  diff: RecipeDiff;
  selectable?: boolean;
  accepted?: Set<string>;
  onToggle?: (key: string) => void;
  showUnchanged?: boolean;
  animate?: boolean;
}) {
  const [stage, setStage] = React.useState(animate ? 0 : 2);
  React.useEffect(() => {
    if (!animate) return;
    const a = setTimeout(() => setStage(1), 180);
    const b = setTimeout(() => setStage(2), 460);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [animate]);

  const on = (k: string) => !selectable || !!accepted?.has(k);
  const row = (k: string) =>
    selectable
      ? {
          role: "checkbox" as const,
          "aria-checked": on(k),
          tabIndex: 0,
          onClick: () => onToggle?.(k),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onToggle?.(k);
            }
          },
          "data-cuelume-toggle": "",
        }
      : {};

  return (
    <div className="space-y-3 text-xs">
      {diff.meta.length > 0 && (
        <Hunk title="metadata">
          <div {...row("meta")} className={cn("divide-y", selectable && "cursor-pointer", !on("meta") && "opacity-45")}>
            {diff.meta.map((m) => (
              <div key={m.field} className="grid grid-cols-[6rem_1fr] gap-2 px-2 py-1">
                <span className="text-muted-foreground">{m.field}</span>
                <span className="min-w-0">
                  {m.before && <span className="mr-1 bg-del-tint text-del line-through decoration-del/50">{m.before}</span>}
                  <span className="bg-add-tint text-add">{m.after || "∅"}</span>
                </span>
              </div>
            ))}
            {selectable && <Mark on={on("meta")} tone="add" className="absolute top-1 right-1" />}
          </div>
        </Hunk>
      )}

      <Hunk title="ingredients">
        {diff.ingredients
          .filter((c) => showUnchanged || c.type !== "same")
          .map((c) => (
            <IngRow key={keyOfIng(c)} c={c} on={on(keyOfIng(c))} stage={stage} selectable={selectable} rowProps={row(keyOfIng(c))} />
          ))}
      </Hunk>

      <Hunk title="method">
        {diff.steps
          .filter((c) => showUnchanged || c.type !== "same")
          .map((c) => (
            <StepRow key={keyOfStep(c)} c={c} on={on(keyOfStep(c))} stage={stage} selectable={selectable} rowProps={row(keyOfStep(c))} />
          ))}
      </Hunk>
    </div>
  );
}

const keyOfIng = (c: IngredientChange) => (c.type === "removed" ? `i-${c.before.id}` : `i-${c.after.id}`);
const keyOfStep = (c: StepChange) => (c.type === "removed" ? `s-${c.before.id}` : `s-${c.after.id}`);

function Hunk({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border">
      <div className="border-b bg-muted/50 px-2 py-1 text-[10.5px] text-muted-foreground">@@ {title} @@</div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Mark({ on, tone, className }: { on: boolean; tone: "add" | "del"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center border transition-transform",
        on ? (tone === "add" ? "border-add bg-add text-background" : "border-del bg-del text-background") : "scale-90 bg-background",
        className,
      )}
    >
      {on && <CheckIcon weight="bold" className="size-3" />}
    </span>
  );
}

function IngRow({ c, on, stage, selectable, rowProps }: { c: IngredientChange; on: boolean; stage: number; selectable?: boolean; rowProps: object }) {
  const sign = c.type === "added" ? "+" : c.type === "removed" ? "−" : c.type === "changed" ? "~" : " ";
  const tone = c.type === "removed" ? "del" : "add";
  const visible = c.type !== "added" || stage >= 2;
  const tinted = c.type !== "same" && stage >= (c.type === "added" ? 2 : 1) && on;
  if (!visible) return null;
  return (
    <div
      {...(c.type !== "same" ? rowProps : {})}
      className={cn(
        "grid grid-cols-[1rem_6rem_1fr_auto] items-center gap-2 px-2 py-1 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
        c.type !== "same" && selectable && "cursor-pointer hover:brightness-95",
        tinted && (tone === "del" ? "bg-del-tint" : "bg-add-tint"),
        c.type === "same" && "text-muted-foreground",
        c.type === "added" && "animate-in fade-in slide-in-from-top-1",
      )}
    >
      <span className={cn("font-bold", c.type === "removed" ? "text-del" : c.type === "same" ? "text-faint" : "text-add")}>{sign}</span>
      {c.type === "changed" ? (
        <>
          <span className="tabular">
            {c.fields.includes("amount") ? (
              <>
                <span className="text-del line-through">{amountString(c.before)}</span> <span className="text-add">{amountString(c.after)}</span>
              </>
            ) : (
              amountString(c.after)
            )}
          </span>
          <span>
            {c.fields.includes("name") && <span className="mr-1 text-del line-through">{c.before.name}</span>}
            {c.after.name}
            {c.after.note && <span className="text-muted-foreground">, {c.after.note}</span>}
          </span>
        </>
      ) : (
        <>
          <span className={cn("tabular", c.type === "removed" && "text-del line-through", c.type === "added" && "text-add")}>
            {amountString(c.type === "removed" ? c.before : c.after)}
          </span>
          <span className={cn(c.type === "removed" && "text-del line-through decoration-del/50", c.type === "added" && "text-add")}>
            {(c.type === "removed" ? c.before : c.after).name}
            {(c.type === "removed" ? c.before : c.after).note && <span className="opacity-70">, {(c.type === "removed" ? c.before : c.after).note}</span>}
          </span>
        </>
      )}
      {selectable && c.type !== "same" ? <Mark on={on} tone={c.type === "removed" ? "del" : "add"} /> : <span />}
    </div>
  );
}

function StepRow({ c, on, stage, selectable, rowProps }: { c: StepChange; on: boolean; stage: number; selectable?: boolean; rowProps: object }) {
  const visible = c.type !== "added" || stage >= 2;
  if (!visible) return null;
  const tinted = c.type !== "same" && on && stage >= 1;
  const step = c.type === "removed" ? c.before : c.after;
  return (
    <div
      {...(c.type !== "same" ? rowProps : {})}
      className={cn(
        "grid grid-cols-[1rem_1fr_auto] gap-2 px-2 py-1.5 outline-none focus-visible:ring-1 focus-visible:ring-ring",
        c.type !== "same" && selectable && "cursor-pointer hover:brightness-95",
        tinted && (c.type === "removed" ? "bg-del-tint" : "bg-add-tint"),
        c.type === "same" && "text-muted-foreground",
      )}
    >
      <span className={cn("font-bold", c.type === "removed" ? "text-del" : c.type === "same" ? "text-faint" : "text-add")}>
        {c.type === "added" ? "+" : c.type === "removed" ? "−" : c.type === "changed" ? "~" : " "}
      </span>
      <span className="min-w-0 leading-relaxed">
        <span className="mr-1.5 font-semibold uppercase tracking-wider text-[10.5px]">{step.action}</span>
        {c.type === "changed" ? (
          c.words.map((w, i) => (
            <span key={i} className={cn(w.added && "bg-add-tint text-add", w.removed && "bg-del-tint text-del line-through")}>
              {w.value}
            </span>
          ))
        ) : (
          <span className={cn(c.type === "removed" && "text-del line-through decoration-del/50", c.type === "added" && "text-add")}>{step.text}</span>
        )}
      </span>
      {selectable && c.type !== "same" ? <Mark on={on} tone={c.type === "removed" ? "del" : "add"} /> : <span />}
    </div>
  );
}

export function DiffStat({ diff, className }: { diff: RecipeDiff; className?: string }) {
  const { additions, deletions, changes } = diff.stats;
  const total = Math.max(1, additions + deletions + changes);
  const blocks = 5;
  const a = Math.round((additions / total) * blocks);
  const d = Math.round((deletions / total) * blocks);
  const c = Math.max(0, blocks - a - d);
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] tabular", className)}>
      <span className="text-add">+{additions}</span>
      <span className="text-del">−{deletions}</span>
      <span className="text-chart-4">~{changes}</span>
      <span className="flex gap-px">
        {Array.from({ length: a }).map((_, i) => (
          <span key={`a${i}`} className="size-2 bg-add" />
        ))}
        {Array.from({ length: d }).map((_, i) => (
          <span key={`d${i}`} className="size-2 bg-del" />
        ))}
        {Array.from({ length: c }).map((_, i) => (
          <span key={`c${i}`} className="size-2 bg-muted-foreground/40" />
        ))}
      </span>
    </span>
  );
}
