"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CopyIcon, PackageIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AISLES, aisleLabel } from "@/lib/aisles";
import { formatAmount, type UnitSystem, convert } from "@/lib/recipe/units";
import { parseIngredientLine } from "@/lib/recipe/parse";
import { addToShoppingAction, checkedToPantryAction, clearShoppingAction, removeShoppingItemAction, toggleShoppingItemAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { Empty } from "@/components/common";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; qty: number | null; unit: string | null; aisle: string; checked: boolean; recipeTitle: string | null };

export function ShoppingList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setItems(initial);
  }
  const [units, setUnits] = React.useState<UnitSystem>("original");
  const [text, setText] = React.useState("");
  const [, start] = React.useTransition();
  const router = useRouter();
  const { play } = useSound();

  const order = [...AISLES.map((a) => a.id), "other"] as string[];
  const groups = order.map((a) => ({ aisle: a, items: items.filter((i) => i.aisle === a) })).filter((g) => g.items.length);
  const done = items.filter((i) => i.checked).length;

  const fmt = (i: Item) => formatAmount(convert(i.qty, i.unit, i.name, units));

  const toggle = (i: Item) => {
    setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, checked: !x.checked } : x)));
    play("toggle", { emphasis: "subtle" });
    if (!i.checked && done + 1 === items.length) setTimeout(() => play("success"), 150);
    start(async () => {
      await toggleShoppingItemAction(i.id, !i.checked);
    });
  };

  const asMarkdown = () =>
    groups.map((g) => `## ${aisleLabel(g.aisle)}\n${g.items.map((i) => `- [${i.checked ? "x" : " "}] ${fmt(i)} ${i.name}`.replace(/\s+/g, " ")).join("\n")}`).join("\n\n");

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-brand">~/</span>shopping
          </h1>
          <p className="text-xs text-muted-foreground tabular">
            {done}/{items.length} in cart
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {(["original", "metric", "us"] as const).map((u) => (
            <button key={u} onClick={() => setUnits(u)} className={cn("border px-2 py-0.5 text-[11px]", units === u ? "border-foreground bg-foreground text-background" : "hover:border-brand")}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-4 h-1 bg-muted">
          <div className="h-full bg-add transition-[width]" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = text.split(",").map((t) => parseIngredientLine(t)).filter(Boolean);
          if (!parsed.length) return;
          start(async () => {
            const res = await addToShoppingAction(parsed.map((p) => ({ name: p!.name, qty: p!.qty, unit: p!.unit })));
            if (res.ok) {
              setText("");
              router.refresh();
            } else toast.error(res.error);
          });
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="add items: 2 lemons, 500 g pasta, parsley…" className="h-8" data-cuelume-type />
        <Button type="submit" size="sm" className="h-8" disabled={!text.trim()}>
          <PlusIcon /> add
        </Button>
      </form>

      {items.length === 0 ? (
        <Empty title="Your list is empty">
          Open a recipe and hit <span className="text-foreground">add missing</span> to send its ingredients here. Quantities from multiple recipes are merged.{" "}
          <Link href="/explore" className="text-brand hover:underline">
            Explore recipes →
          </Link>
        </Empty>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.aisle}>
              <h2 className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="text-brand">#</span> {aisleLabel(g.aisle)}
              </h2>
              <ul className="divide-y border bg-card">
                {g.items.map((i) => (
                  <li key={i.id} className="group flex items-center gap-3 px-3 py-2 text-[13px]">
                    <Checkbox checked={i.checked} onCheckedChange={() => toggle(i)} aria-label={`Got ${i.name}`} />
                    <button onClick={() => toggle(i)} className={cn("flex min-w-0 flex-1 items-baseline gap-2 text-left", i.checked && "text-muted-foreground line-through")}>
                      <span className="w-20 shrink-0 text-right font-semibold text-brand tabular">{fmt(i)}</span>
                      <span className="truncate">{i.name}</span>
                      {i.recipeTitle && <span className="hidden truncate text-[10.5px] text-faint sm:inline">← {i.recipeTitle}</span>}
                    </button>
                    <button
                      onClick={() =>
                        start(async () => {
                          setItems((xs) => xs.filter((x) => x.id !== i.id));
                          await removeShoppingItemAction(i.id);
                        })
                      }
                      className="text-faint opacity-0 group-hover:opacity-100 hover:text-del"
                      aria-label="Remove"
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={!done}
              onClick={() =>
                start(async () => {
                  const res = await checkedToPantryAction();
                  if (res.ok) {
                    play("success");
                    toast.success(`Moved ${res.moved} items to your pantry`);
                    router.refresh();
                  }
                })
              }
            >
              <PackageIcon /> checked → pantry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(asMarkdown());
                play("success", { emphasis: "subtle" });
                toast.success("Copied as markdown checklist");
              }}
            >
              <CopyIcon /> copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() =>
                start(async () => {
                  if (!confirm("Clear the whole list?")) return;
                  await clearShoppingAction(false);
                  router.refresh();
                })
              }
            >
              <TrashIcon /> clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
