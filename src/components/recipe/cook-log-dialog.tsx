"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useClerk } from "@clerk/nextjs";
import { StarIcon } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { logCookAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { cn } from "@/lib/utils";

const OUTCOMES = [
  { id: "success", label: "✓ success", hint: "built clean", cls: "data-[on=true]:bg-add data-[on=true]:text-background" },
  { id: "partial", label: "~ partial", hint: "works, with warnings", cls: "data-[on=true]:bg-chart-4 data-[on=true]:text-background" },
  { id: "failed", label: "✗ failed", hint: "build broken", cls: "data-[on=true]:bg-del data-[on=true]:text-background" },
] as const;

/** "Build log": record that you cooked this exact commit, with outcome + notes. */
export function CookLogDialog({ recipeId, commitId, signedIn, children }: { recipeId: string; commitId: string; signedIn: boolean; count: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState<"success" | "partial" | "failed">("success");
  const [rating, setRating] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState("");
  const [pending, start] = React.useTransition();
  const clerk = useClerk();
  const router = useRouter();
  const { play } = useSound();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o && !signedIn) return clerk.openSignIn();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>log a build</DialogTitle>
          <DialogDescription>
            You cooked <code className="text-brand">{commitId.slice(0, 7)}</code>. How did it go?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-px border bg-border">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              data-on={outcome === o.id}
              onClick={() => setOutcome(o.id)}
              className={cn("flex flex-col items-start bg-card p-2 text-left text-xs", o.cls)}
              data-cuelume-select
            >
              <span className="font-semibold">{o.label}</span>
              <span className="text-[10px] opacity-75">{o.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-muted-foreground">rating</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(rating === n ? null : n)} aria-label={`${n} stars`} data-cuelume-select>
              <StarIcon weight={rating && n <= rating ? "fill" : "regular"} className={cn("size-5", rating && n <= rating ? "text-brand" : "text-faint")} />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="notes: what you changed, what went wrong, oven quirks… (markdown ok)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          data-cuelume-type
        />
        <DialogFooter>
          <Button
            disabled={pending}
            className="bg-brand text-brand-foreground hover:bg-brand/85"
            onClick={() =>
              start(async () => {
                const res = await logCookAction({ recipeId, commitId, outcome, rating, notes: notes.trim() || null });
                if (res.ok) {
                  play(outcome === "failed" ? "error" : outcome === "partial" ? "warning" : "success");
                  toast.success("Build logged");
                  setOpen(false);
                  setNotes("");
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            log build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
