"use client";

import * as React from "react";
import { ThinkingOrb } from "thinking-orbs";
import { toast } from "sonner";
import { CameraIcon, FileTextIcon, LinkIcon, PencilLineIcon, SparkleIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { emptyRecipe, type RecipeData } from "@/lib/recipe/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RecipeEditor } from "./recipe-editor";
import { useSound } from "@/components/providers";

const STAGES = ["fetching page", "reading structured data", "parsing ingredients", "building step graph", "laying out table"];

/** Step 1: get a recipe in (link / text / photo / blank). Step 2: review in the editor and commit. */
export function NewRecipe({ ai, initialTab, username }: { ai: boolean; initialTab: string; username: string }) {
  const [draft, setDraft] = React.useState<RecipeData | null>(null);
  const [method, setMethod] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [url, setUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const { play } = useSound();

  React.useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 1400);
    return () => clearInterval(id);
  }, [loading]);

  const run = async (body: Record<string, unknown>) => {
    setStage(0);
    setLoading(true);
    play("loading");
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      if (data.warning) toast.warning(data.warning);
      setDraft(data.recipe);
      setMethod(data.method);
      play("ready");
    } catch (e) {
      play("error");
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const onImage = (file: File) => {
    if (file.size > 8_000_000) return toast.error("Image too large (max 8 MB)");
    const reader = new FileReader();
    reader.onload = () => run({ image: reader.result });
    reader.readAsDataURL(file);
  };

  if (draft) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3 border bg-card px-3 py-2 text-xs">
          <span className="text-add">✓ imported</span>
          {method && (
            <span className="text-muted-foreground">
              via <code className="text-foreground">{method}</code>
            </span>
          )}
          <span className="text-muted-foreground">
            review, fix anything off, then commit to <span className="text-foreground">{username}/…</span>
          </span>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setDraft(null)}>
            start over
          </Button>
        </div>
        <RecipeEditor mode="create" initial={draft} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">
        <span className="text-brand">$</span> fork init
      </h1>
      <p className="mt-1 mb-6 text-xs text-muted-foreground">Bring a recipe in from anywhere. It gets cleaned up into a structured, forkable, table-ready format.</p>

      {loading ? (
        <div className="flex flex-col items-center gap-4 border bg-card py-16">
          <ThinkingOrb state="weaving" size={64} />
          <div className="space-y-1 text-xs">
            {STAGES.map((s, i) => (
              <p key={s} className={i < stage ? "text-muted-foreground" : i === stage ? "shimmer" : "text-faint"}>
                {i < stage ? "✓" : i === stage ? "›" : "·"} {s}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <Tabs defaultValue={initialTab}>
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">
              <LinkIcon /> link
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1">
              <FileTextIcon /> paste text
            </TabsTrigger>
            <TabsTrigger value="photo" className="flex-1">
              <CameraIcon /> photo
            </TabsTrigger>
            <TabsTrigger value="blank" className="flex-1">
              <PencilLineIcon /> blank
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-4 space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (url) run({ url });
              }}
            >
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://some-food-blog.com/the-best-banana-bread-with-a-12-page-life-story" type="url" required className="h-9" data-cuelume-type />
              <Button type="submit" className="h-9 bg-brand text-brand-foreground hover:bg-brand/85" data-cuelume-tap>
                import <ArrowRightIcon />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">
              Most recipe sites embed schema.org data, which we parse directly (no AI needed).{" "}
              {ai ? (
                <span className="text-add">AI is on: it also cleans up the step graph and handles sites without structured data.</span>
              ) : (
                <span>Sites without it need an AI key.</span>
              )}
            </p>
          </TabsContent>

          <TabsContent value="text" className="mt-4 space-y-3">
            <Textarea
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Grandma's Pancakes\nServes 4\n\nIngredients\n1 1/2 cups flour\n2 tbsp sugar\n1 cup milk\n1 egg\n\nInstructions\n1. Whisk the flour and sugar.\n2. Add milk and egg; stir until just combined.\n3. Cook on a hot griddle 2 minutes per side."}
              className="font-mono text-xs"
              data-cuelume-type
            />
            <div className="flex items-center gap-3">
              <Button onClick={() => run({ text })} disabled={!text.trim()} className="bg-brand text-brand-foreground hover:bg-brand/85">
                {ai ? <SparkleIcon weight="fill" /> : null} convert
              </Button>
              {ai && (
                <Button variant="ghost" size="sm" onClick={() => run({ text, useAi: false })} disabled={!text.trim()}>
                  use offline parser
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">{ai ? "AI structures messy text, including the step graph." : "Offline heuristic parser (add an AI key for messier text)."}</span>
            </div>
          </TabsContent>

          <TabsContent value="photo" className="mt-4">
            <label className="bg-grid flex cursor-pointer flex-col items-center gap-2 border border-dashed py-14 text-center text-xs hover:border-brand">
              <CameraIcon className="size-8 text-brand" />
              <span>drop or pick a photo of a cookbook page / handwritten card</span>
              <span className="text-muted-foreground">{ai ? "read with AI vision" : "requires an AI key"}</span>
              <input type="file" accept="image/*" className="hidden" disabled={!ai} onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
            </label>
          </TabsContent>

          <TabsContent value="blank" className="mt-4">
            <div className="border bg-card p-6 text-center text-xs">
              <p className="mb-3 text-muted-foreground">Start from an empty recipe and write it yourself.</p>
              <Button onClick={() => setDraft({ ...emptyRecipe(), title: "" })}>open editor</Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
