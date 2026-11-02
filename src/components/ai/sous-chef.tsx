"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ThinkingOrb } from "thinking-orbs";
import { toast } from "sonner";
import { ArrowUpIcon, GitCommitIcon, GitForkIcon, SparkleIcon, StopIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { recipeDataSchema, type RecipeData } from "@/lib/recipe/schema";
import { applySelected, diffKeys, diffRecipes } from "@/lib/recipe/diff";
import { DiffView, DiffStat } from "@/components/recipe/diff-view";
import { Markdown } from "./markdown";
import { commitRecipeAction, forkRecipeAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { label: "make it vegan", prompt: "Make this recipe vegan with the best possible substitutions. Keep texture as close as possible." },
  { label: "−30% sugar", prompt: "Reduce the sugar by about 30% and adjust anything else that depends on it (moisture, browning)." },
  { label: "gluten-free", prompt: "Adapt this recipe to be gluten-free. Use a realistic flour blend and adjust hydration/binders." },
  { label: "why does it work?", prompt: "Explain the food science behind the key steps of this recipe, like a code review: what each step does and what breaks if you skip it." },
  { label: "debug a failed bake", prompt: "My last attempt failed. Ask me 2-3 targeted questions to diagnose it, then list the most likely causes ranked by probability." },
  { label: "high-altitude", prompt: "Adjust this recipe for baking at 2000 m altitude." },
];

export const ASK_EVENT = "fork:ask";
export function askSousChef(prompt: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: prompt }));
}

export function SousChef({
  open,
  onOpenChange,
  recipe,
  recipeId,
  path,
  isOwner,
  aiEnabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipe: RecipeData;
  recipeId: string;
  path: string;
  isOwner: boolean;
  aiEnabled: boolean;
}) {
  const [input, setInput] = React.useState("");
  const { play } = useSound();

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: `sous-${recipeId}`,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => play("ready", { emphasis: "subtle" }),
    onError: () => play("error", { emphasis: "subtle" }),
  });

  const send = React.useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage({ text }, { body: { recipe, context: `recipe ${path}; viewer ${isOwner ? "owns" : "does not own"} it` } });
      setInput("");
    },
    [sendMessage, recipe, path, isOwner],
  );

  React.useEffect(() => {
    const onAsk = (e: Event) => {
      onOpenChange(true);
      if (aiEnabled) send((e as CustomEvent<string>).detail);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [send, onOpenChange, aiEnabled]);

  const scroller = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <SparkleIcon weight="fill" className="text-brand" /> sous-chef
            <span className="font-normal text-muted-foreground">· {path}</span>
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            Ask anything about this recipe. Requested changes come back as a reviewable diff you can {isOwner ? "commit" : "fork"}.
          </SheetDescription>
        </SheetHeader>

        {!aiEnabled ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-xs">
            <WarningIcon className="size-6 text-brand" />
            <p className="text-sm">AI is offline on this server</p>
            <p className="text-muted-foreground">
              Add <code className="bg-muted px-1">ANTHROPIC_API_KEY</code> (or <code className="bg-muted px-1">OPENAI_API_KEY</code>) to <code className="bg-muted px-1">.env.local</code> and restart to enable the sous-chef, AI imports and AI forks.
            </p>
          </div>
        ) : (
          <>
            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-4 pt-8 text-center">
                  <ThinkingOrb state="breathing" size={64} />
                  <p className="max-w-xs text-xs text-muted-foreground">I&apos;ve read the recipe and its step graph. Try one of these, or ask your own question.</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s.label} onClick={() => send(s.prompt)} className="border px-2 py-1 text-[11px] hover:border-brand hover:text-brand" data-cuelume-tap>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <Message key={m.id} m={m} recipe={recipe} recipeId={recipeId} isOwner={isOwner} onDone={() => onOpenChange(false)} />
              ))}
              {waiting && (
                <div className="flex items-center gap-2 text-xs">
                  <ThinkingOrb state="composing" size={20} />
                  <span className="shimmer">thinking…</span>
                </div>
              )}
              {error && <p className="border border-del bg-del-tint px-2 py-1 text-xs text-del">{error.message || "Something went wrong."}</p>}
            </div>

            <form
              className="border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="flex items-end gap-2 border bg-background p-1.5 focus-within:border-brand">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={2}
                  placeholder="e.g. swap the butter for olive oil · why rest the dough? · scale for a 23 cm pan"
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 text-xs outline-none placeholder:text-faint"
                  data-cuelume-type
                />
                <div className="flex flex-col gap-1">
                  {messages.length > 0 && !busy && (
                    <Button type="button" size="icon-xs" variant="ghost" onClick={() => setMessages([])} aria-label="Clear chat">
                      <TrashIcon />
                    </Button>
                  )}
                  {busy ? (
                    <Button type="button" size="icon-sm" variant="outline" onClick={() => stop()} aria-label="Stop">
                      <StopIcon weight="fill" />
                    </Button>
                  ) : (
                    <Button type="submit" size="icon-sm" className="bg-brand text-brand-foreground hover:bg-brand/85" disabled={!input.trim()} aria-label="Send" data-cuelume-tap>
                      <ArrowUpIcon weight="bold" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[10px] text-faint">enter to send · shift+enter for newline · AI can be wrong about food safety, use judgment</p>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Message({ m, recipe, recipeId, isOwner, onDone }: { m: UIMessage; recipe: RecipeData; recipeId: string; isOwner: boolean; onDone: () => void }) {
  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="ml-10 border-l-2 border-brand bg-muted/60 px-3 py-2 text-xs">
        <span className="text-brand">$ </span>
        {text}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {m.parts.map((p, i) => {
        if (p.type === "text") return p.text ? <Markdown key={i}>{p.text}</Markdown> : null;
        if (p.type === "tool-proposeChanges") {
          const part = p as { state: string; input?: { commitMessage?: string; summary?: string; recipe?: unknown } };
          if (part.state === "input-streaming")
            return (
              <div key={i} className="flex items-center gap-2 border border-dashed px-3 py-2 text-xs">
                <ThinkingOrb state="shaping" size={20} />
                <span className="shimmer">drafting changes…</span>
              </div>
            );
          if (!part.input?.recipe) return null;
          return <Proposal key={i} input={part.input as Required<NonNullable<typeof part.input>>} recipe={recipe} recipeId={recipeId} isOwner={isOwner} onDone={onDone} />;
        }
        return null;
      })}
    </div>
  );
}

function Proposal({
  input,
  recipe,
  recipeId,
  isOwner,
  onDone,
}: {
  input: { commitMessage: string; summary: string; recipe: unknown };
  recipe: RecipeData;
  recipeId: string;
  isOwner: boolean;
  onDone: () => void;
}) {
  const proposed = React.useMemo(() => recipeDataSchema.safeParse(input.recipe), [input.recipe]);
  const diff = React.useMemo(() => (proposed.success ? diffRecipes(recipe, proposed.data) : null), [proposed, recipe]);
  const [accepted, setAccepted] = React.useState<Set<string>>(() => new Set(diff ? diffKeys(diff) : []));
  const [message, setMessage] = React.useState(input.commitMessage);
  const [pending, start] = React.useTransition();
  const [applied, setApplied] = React.useState(false);
  const router = useRouter();
  const { play } = useSound();

  if (!proposed.success || !diff) return <p className="text-xs text-del">The proposal was malformed. Ask again?</p>;

  const total = diffKeys(diff).length;
  const apply = () =>
    start(async () => {
      const data = applySelected(recipe, proposed.data, diff, accepted);
      const res = isOwner ? await commitRecipeAction(recipeId, data, message) : await forkRecipeAction(recipeId, { data, message });
      if (res.ok) {
        play("success", { emphasis: "strong" });
        setApplied(true);
        toast.success(isOwner ? "Committed" : "Forked with changes");
        onDone();
        router.push(res.path);
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  return (
    <div className="border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
        <GitCommitIcon className="text-brand" />
        <span className="font-semibold">proposed changes</span>
        <DiffStat diff={diff} className="ml-auto" />
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">{input.summary}</p>
      <div className="max-h-[360px] overflow-y-auto p-3">
        <DiffView
          diff={diff}
          selectable={!applied}
          accepted={accepted}
          showUnchanged={false}
          animate
          onToggle={(k) =>
            setAccepted((s) => {
              const n = new Set(s);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            })
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-7 min-w-0 flex-1 border bg-background px-2 text-xs outline-none focus:border-brand"
          aria-label="Commit message"
        />
        <span className="text-[10.5px] text-muted-foreground tabular">
          {accepted.size}/{total}
        </span>
        <Button
          size="sm"
          disabled={pending || applied || accepted.size === 0}
          onClick={apply}
          className={cn("bg-brand text-brand-foreground hover:bg-brand/85")}
          data-cuelume-tap
        >
          {isOwner ? <GitCommitIcon /> : <GitForkIcon />}
          {applied ? "applied" : isOwner ? "commit" : "fork with changes"}
        </Button>
      </div>
    </div>
  );
}
