"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DotsSixVerticalIcon,
  FlowArrowIcon,
  GitCommitIcon,
  PlusIcon,
  TrashIcon,
  ClipboardTextIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";
import { CATEGORIES, CATEGORY_LABEL, recipeDataSchema, uid, type Ingredient, type RecipeData, type Step } from "@/lib/recipe/schema";
import { inferAction, inferGraph, inferTiming, parseIngredientLine } from "@/lib/recipe/parse";
import { diffRecipes, isEmptyDiff } from "@/lib/recipe/diff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RecipeTable } from "@/components/recipe/recipe-table";
import { DiffStat } from "@/components/recipe/diff-view";
import { commitRecipeAction, createRecipeAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { cn } from "@/lib/utils";

type Props =
  | { mode: "create"; initial: RecipeData; recipeId?: undefined; base?: undefined }
  | { mode: "commit"; initial: RecipeData; recipeId: string; base: RecipeData };

export function RecipeEditor(props: Props) {
  const [r, setR] = React.useState<RecipeData>(props.initial);
  const [message, setMessage] = React.useState(props.mode === "create" ? "initial commit" : "");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const { play } = useSound();
  const set = <K extends keyof RecipeData>(k: K, v: RecipeData[K]) => setR((x) => ({ ...x, [k]: v }));

  const diff = React.useMemo(() => (props.mode === "commit" ? diffRecipes(props.base, r) : null), [props, r]);
  const unchanged = diff ? isEmptyDiff(diff) : false;

  // Warn before leaving with unsaved edits.
  React.useEffect(() => {
    const dirty = JSON.stringify(r) !== JSON.stringify(props.initial);
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [r, props.initial]);

  const submit = () => {
    const parsed = recipeDataSchema.safeParse(r);
    if (!parsed.success) {
      play("error", { emphasis: "subtle" });
      toast.error(parsed.error.issues[0]?.path.join(".") + ": " + parsed.error.issues[0]?.message);
      return;
    }
    if (!parsed.data.ingredients.length || !parsed.data.steps.length) {
      toast.error("A recipe needs at least one ingredient and one step.");
      return;
    }
    start(async () => {
      const res = props.mode === "create" ? await createRecipeAction(parsed.data, message) : await commitRecipeAction(props.recipeId, parsed.data, message);
      if (res.ok) {
        play("success", { emphasis: "strong" });
        toast.success(props.mode === "create" ? "Recipe created" : "Committed to main");
        router.push(res.path);
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });
  };

  // ⌘↵ to commit
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="grid gap-6 pb-24 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="min-w-0 space-y-6">
        <Section title="meta">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="title">
              <Input value={r.title} onChange={(e) => set("title", e.target.value)} placeholder="Banana Nut Bread" className="text-base font-semibold" data-cuelume-type />
            </Field>
            <Field label="category">
              <Select value={r.category} onValueChange={(v) => set("category", v as RecipeData["category"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="description">
            <Textarea rows={2} value={r.description} onChange={(e) => set("description", e.target.value)} placeholder="What makes this version worth cooking?" />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="servings">
              <Input type="number" min={1} value={r.servings} onChange={(e) => set("servings", Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Field label="yield label">
              <Input value={r.yieldLabel ?? ""} onChange={(e) => set("yieldLabel", e.target.value || null)} placeholder="1 loaf" />
            </Field>
            <Field label="prep (min)">
              <Input type="number" min={0} value={r.prepMinutes ?? ""} onChange={(e) => set("prepMinutes", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="cook (min)">
              <Input type="number" min={0} value={r.cookMinutes ?? ""} onChange={(e) => set("cookMinutes", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="equipment (comma separated)">
              <ListInput value={r.equipment} onChange={(v) => set("equipment", v)} placeholder="loaf pan, stand mixer" />
            </Field>
            <Field label="tags (comma separated)">
              <ListInput value={r.tags} onChange={(v) => set("tags", v.map((t) => t.toLowerCase().replace(/\s+/g, "-")))} placeholder="quick-bread, breakfast" />
            </Field>
          </div>
        </Section>

        <IngredientsEditor r={r} setR={setR} />
        <StepsEditor r={r} setR={setR} />

        <Section title="notes">
          <Textarea rows={3} value={r.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="Tips, variations, storage… (markdown)" />
        </Section>
      </div>

      <div className="min-w-0">
        <div className="sticky top-16 space-y-2">
          <Section title="live preview">
            {r.ingredients.length || r.steps.length ? (
              <RecipeTable recipe={r} compact />
            ) : (
              <p className="bg-grid border border-dashed p-10 text-center text-xs text-muted-foreground">Add ingredients and steps — the table builds itself from the step graph.</p>
            )}
          </Section>
        </div>
      </div>

      {/* commit bar */}
      <div className="fixed inset-x-0 bottom-7 z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2 sm:px-5">
          <GitCommitIcon className="shrink-0 text-brand" />
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={props.mode === "commit" ? "commit message — what changed and why (e.g. “+15 g butter, bake 5 min longer”)" : "commit message"}
            className="flex-1"
            data-cuelume-type
          />
          {diff && <DiffStat diff={diff} className="hidden sm:inline-flex" />}
          <Button onClick={submit} disabled={pending || unchanged || (props.mode === "commit" && !message.trim())} className="bg-brand text-brand-foreground hover:bg-brand/85" data-cuelume-tap>
            {props.mode === "create" ? "create recipe" : "commit to main"}
            <span className="hidden text-[10px] opacity-70 sm:inline">⌘↵</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b pb-1">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="text-brand">#</span> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = React.useState(value.join(", "));
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    // external change (e.g. import / AI) → resync the text field
    setPrev(value);
    setText(value.join(", "));
  }
  return (
    <Input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

/* ───────────────────────── Ingredients ───────────────────────── */

function IngredientsEditor({ r, setR }: { r: RecipeData; setR: React.Dispatch<React.SetStateAction<RecipeData>> }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const update = (id: string, patch: Partial<Ingredient>) => setR((x) => ({ ...x, ingredients: x.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const remove = (id: string) =>
    setR((x) => ({ ...x, ingredients: x.ingredients.filter((i) => i.id !== id), steps: x.steps.map((s) => ({ ...s, inputs: s.inputs.filter((v) => v !== id) })) }));
  const add = () => setR((x) => ({ ...x, ingredients: [...x.ingredients, { id: uid("i"), name: "", qty: null, qtyMax: null, unit: null, note: null, group: null }] }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setR((x) => {
      const from = x.ingredients.findIndex((i) => i.id === e.active.id);
      const to = x.ingredients.findIndex((i) => i.id === e.over!.id);
      return { ...x, ingredients: arrayMove(x.ingredients, from, to) };
    });
  };

  return (
    <Section
      title={`ingredients (${r.ingredients.length})`}
      right={
        <BulkPaste
          title="paste ingredient lines"
          placeholder={"2 cups (250g) flour\n1 tsp baking soda\n½ cup butter, melted"}
          onSubmit={(text) => {
            const parsed = text
              .split("\n")
              .map((l) => parseIngredientLine(l))
              .filter((x): x is Ingredient => !!x);
            setR((x) => ({ ...x, ingredients: [...x.ingredients, ...parsed] }));
            toast.success(`Parsed ${parsed.length} ingredients`);
          }}
        />
      }
    >
      <div className="grid grid-cols-[1.25rem_4.5rem_4.5rem_1fr_1fr_1.75rem] gap-px text-[10.5px] text-muted-foreground">
        <span />
        <span className="px-1">qty</span>
        <span className="px-1">unit</span>
        <span className="px-1">name</span>
        <span className="px-1">note</span>
        <span />
      </div>
      <DndContext id="ingredients-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={r.ingredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-px">
            {r.ingredients.map((i) => (
              <SortableRow key={i.id} id={i.id} className="grid grid-cols-[1.25rem_4.5rem_4.5rem_1fr_1fr_1.75rem] items-center gap-px">
                <Input
                  className="h-7 text-right tabular"
                  value={i.qty ?? ""}
                  inputMode="decimal"
                  placeholder="–"
                  onChange={(e) => update(i.id, { qty: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) || 0 })}
                />
                <Input className="h-7" value={i.unit ?? ""} placeholder="g" onChange={(e) => update(i.id, { unit: e.target.value || null })} />
                <Input className="h-7" value={i.name} placeholder="ingredient" onChange={(e) => update(i.id, { name: e.target.value })} data-cuelume-type />
                <Input className="h-7 text-muted-foreground" value={i.note ?? ""} placeholder="note" onChange={(e) => update(i.id, { note: e.target.value || null })} />
                <Button variant="ghost" size="icon-xs" onClick={() => remove(i.id)} aria-label="Remove ingredient">
                  <TrashIcon />
                </Button>
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" onClick={add} className="w-full border-dashed" data-cuelume-tap>
        <PlusIcon /> add ingredient
      </Button>
    </Section>
  );
}

/* ───────────────────────── Steps ───────────────────────── */

function StepsEditor({ r, setR }: { r: RecipeData; setR: React.Dispatch<React.SetStateAction<RecipeData>> }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const update = (id: string, patch: Partial<Step>) => setR((x) => ({ ...x, steps: x.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const remove = (id: string) => setR((x) => ({ ...x, steps: x.steps.filter((s) => s.id !== id).map((s) => ({ ...s, inputs: s.inputs.filter((v) => v !== id) })) }));
  const add = () =>
    setR((x) => {
      const prev = x.steps[x.steps.length - 1];
      return { ...x, steps: [...x.steps, { id: uid("s"), action: "", text: "", inputs: prev ? [prev.id] : [], minutes: null, temperature: null }] };
    });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setR((x) => {
      const from = x.steps.findIndex((s) => s.id === e.active.id);
      const to = x.steps.findIndex((s) => s.id === e.over!.id);
      return { ...x, steps: arrayMove(x.steps, from, to) };
    });
  };
  const claimed = new Map<string, number>();
  r.steps.forEach((s, idx) => s.inputs.forEach((i) => !claimed.has(i) && claimed.set(i, idx)));
  const unused = r.ingredients.filter((i) => !claimed.has(i.id));

  return (
    <Section
      title={`method (${r.steps.length})`}
      right={
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setR((x) => ({ ...x, steps: inferGraph(x.ingredients, x.steps) }));
              toast.success("Re-wired the step graph from step text");
            }}
            title="Infer which ingredients/steps feed each step from the text"
          >
            <TreeStructureIcon /> auto-wire
          </Button>
          <BulkPaste
            title="paste method"
            placeholder={"1. Preheat the oven to 180°C.\n2. Whisk the flour and sugar.\n3. Bake for 25 minutes."}
            onSubmit={(text) => {
              const steps: Step[] = text
                .split("\n")
                .map((l) => l.replace(/^(step\s*)?\d+[.):]\s*/i, "").trim())
                .filter(Boolean)
                .map((t) => ({ id: uid("s"), action: inferAction(t), text: t, inputs: [], ...inferTiming(t) }));
              setR((x) => ({ ...x, steps: inferGraph(x.ingredients, [...x.steps, ...steps]) }));
              toast.success(`Parsed ${steps.length} steps`);
            }}
          />
        </div>
      }
    >
      {unused.length > 0 && (
        <p className="border border-dashed border-chart-4 px-2 py-1 text-[11px] text-chart-4">
          ⚠ {unused.length} ingredient{unused.length > 1 ? "s are" : " is"} not used by any step: {unused.map((u) => u.name || "(unnamed)").join(", ")}
        </p>
      )}
      <DndContext id="steps-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={r.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {r.steps.map((s, idx) => (
              <SortableRow key={s.id} id={s.id} className="flex gap-2 border bg-card p-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-center text-[11px] font-bold text-brand tabular">{idx + 1}</span>
                    <Input className="h-7 w-32 font-semibold" placeholder="Action" value={s.action} onChange={(e) => update(s.id, { action: e.target.value })} />
                    <Input
                      className="h-7 w-20 tabular"
                      placeholder="min"
                      inputMode="numeric"
                      value={s.minutes ?? ""}
                      onChange={(e) => update(s.id, { minutes: e.target.value ? Number(e.target.value) || 0 : null })}
                      title="minutes"
                    />
                    <Input
                      className="h-7 w-20 tabular"
                      placeholder="°C"
                      inputMode="numeric"
                      value={s.temperature?.value ?? ""}
                      onChange={(e) => update(s.id, { temperature: e.target.value ? { value: Number(e.target.value) || 0, unit: s.temperature?.unit ?? "C" } : null })}
                      title="temperature"
                    />
                    <button
                      className="h-7 border px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => s.temperature && update(s.id, { temperature: { ...s.temperature, unit: s.temperature.unit === "C" ? "F" : "C" } })}
                      title="toggle °C/°F"
                    >
                      °{s.temperature?.unit ?? "C"}
                    </button>
                    <InputsPicker step={s} index={idx} r={r} onChange={(inputs) => update(s.id, { inputs })} />
                    <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={() => remove(s.id)} aria-label="Remove step">
                      <TrashIcon />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    className="min-h-0 text-xs"
                    value={s.text}
                    placeholder="Full instruction…"
                    onChange={(e) => update(s.id, { text: e.target.value })}
                    onBlur={() => {
                      if (!s.action && s.text) update(s.id, { action: inferAction(s.text), ...(s.minutes == null ? inferTiming(s.text) : {}) });
                    }}
                    data-cuelume-type
                  />
                </div>
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" onClick={add} className="w-full border-dashed" data-cuelume-tap>
        <PlusIcon /> add step
      </Button>
    </Section>
  );
}

function InputsPicker({ step, index, r, onChange }: { step: Step; index: number; r: RecipeData; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(step.inputs.includes(id) ? step.inputs.filter((x) => x !== id) : [...step.inputs, id]);
  const prev = r.steps.slice(0, index);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-7 items-center gap-1 border px-1.5 text-[11px] text-muted-foreground hover:border-brand hover:text-brand" title="What feeds into this step?">
          <FlowArrowIcon /> {step.inputs.length} in
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b px-3 py-2 text-[11px] text-muted-foreground">inputs consumed by step {index + 1}</div>
        <div className="max-h-72 overflow-y-auto p-1 text-xs">
          {prev.length > 0 && <p className="px-2 pt-1 text-[10px] uppercase tracking-widest text-faint">previous steps</p>}
          {prev.map((p, i) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted">
              <Checkbox checked={step.inputs.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="text-brand tabular">{i + 1}.</span> {p.action || p.text.slice(0, 30)}
            </label>
          ))}
          <p className="px-2 pt-2 text-[10px] uppercase tracking-widest text-faint">ingredients</p>
          {r.ingredients.map((ing) => (
            <label key={ing.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted">
              <Checkbox checked={step.inputs.includes(ing.id)} onCheckedChange={() => toggle(ing.id)} />
              {ing.name || "(unnamed)"}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(className, isDragging && "relative z-10 opacity-80 shadow-lg")}>
      <button {...attributes} {...listeners} className="flex h-7 cursor-grab items-center justify-center text-faint hover:text-foreground active:cursor-grabbing" aria-label="Drag to reorder">
        <DotsSixVerticalIcon weight="bold" />
      </button>
      {children}
    </div>
  );
}

function BulkPaste({ title, placeholder, onSubmit }: { title: string; placeholder: string; onSubmit: (t: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <ClipboardTextIcon /> paste
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="font-mono text-xs" />
        <DialogFooter>
          <Button
            onClick={() => {
              onSubmit(text);
              setText("");
              setOpen(false);
            }}
            disabled={!text.trim()}
          >
            parse & add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
