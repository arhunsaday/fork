"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addPantryItemsAction, removePantryItemAction } from "@/app/actions";
import { useSound } from "@/components/providers";

type Item = { id: string; name: string; kind: "ingredient" | "equipment" };

const PRESETS: { label: string; kind: Item["kind"]; items: string[] }[] = [
  { label: "baking basics", kind: "ingredient", items: ["all-purpose flour", "sugar", "brown sugar", "butter", "eggs", "baking soda", "baking powder", "salt", "vanilla extract", "milk"] },
  { label: "savoury staples", kind: "ingredient", items: ["olive oil", "onion", "garlic", "salt", "black pepper", "tomato paste", "crushed tomatoes", "cumin", "chili powder", "rice"] },
  { label: "bread nerd", kind: "ingredient", items: ["bread flour", "whole wheat flour", "levain", "fine sea salt", "instant yeast"] },
  { label: "kitchen kit", kind: "equipment", items: ["oven", "kitchen scale", "mixing bowl", "whisk", "saucepan", "baking sheet", "loaf pan", "dutch oven"] },
];

export function PantryManager({ items }: { items: Item[] }) {
  const [kind, setKind] = React.useState<Item["kind"]>("ingredient");
  const [text, setText] = React.useState("");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const { play } = useSound();

  const add = (names: string[], k: Item["kind"]) =>
    start(async () => {
      const existing = new Set(items.filter((i) => i.kind === k).map((i) => i.name.toLowerCase()));
      const fresh = names.map((n) => n.trim()).filter((n) => n && !existing.has(n.toLowerCase()));
      if (!fresh.length) {
        toast("Already in your pantry");
        return;
      }
      const res = await addPantryItemsAction(fresh.map((name) => ({ name, kind: k })));
      if (res.ok) {
        play("success", { emphasis: "subtle" });
        setText("");
        router.refresh();
      } else toast.error(res.error);
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await removePantryItemAction(id);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });

  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text.split(","), kind);
        }}
      >
        <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as Item["kind"])} variant="outline" size="sm">
          <ToggleGroupItem value="ingredient">ingredient</ToggleGroupItem>
          <ToggleGroupItem value="equipment">equipment</ToggleGroupItem>
        </ToggleGroup>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "ingredient" ? "flour, eggs, butter…" : "stand mixer, dutch oven…"} className="h-8 min-w-48 flex-1" data-cuelume-type />
        <Button type="submit" size="sm" disabled={pending || !text.trim()} className="h-8 bg-brand text-brand-foreground hover:bg-brand/85">
          <PlusIcon /> add
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground">presets:</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => add(p.items, p.kind)} disabled={pending} className="border px-2 py-0.5 hover:border-brand hover:text-brand" data-cuelume-tap>
            + {p.label}
          </button>
        ))}
      </div>
      {(["ingredient", "equipment"] as const).map((k) => {
        const list = items.filter((i) => i.kind === k);
        return (
          <section key={k}>
            <h2 className="mb-2 border-b pb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="text-brand">#</span> {k === "ingredient" ? "ingredients" : "equipment"} <span className="tabular">({list.length})</span>
            </h2>
            {list.length ? (
              <div className="flex flex-wrap gap-1">
                {list.map((i) => (
                  <span key={i.id} className="group flex items-center gap-1 border bg-card py-0.5 pr-1 pl-2 text-xs">
                    {i.name}
                    <button onClick={() => remove(i.id)} className="text-faint hover:text-del" aria-label={`Remove ${i.name}`}>
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">empty</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
