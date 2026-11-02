"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addCommentAction, toggleIssueAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function CommentForm({ recipeId, signedIn }: { recipeId: string; signedIn: boolean }) {
  const [kind, setKind] = React.useState<"comment" | "issue">("comment");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const clerk = useClerk();

  if (!signedIn)
    return (
      <div className="border border-dashed p-4 text-xs text-muted-foreground">
        <button className="text-brand hover:underline" onClick={() => clerk.openSignIn()}>
          Sign in
        </button>{" "}
        to comment or open an issue.
      </div>
    );

  return (
    <form
      className="sticky top-16 space-y-2 border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addCommentAction({ recipeId, body, kind, title });
          if (res.ok) {
            setBody("");
            setTitle("");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as "comment" | "issue")} variant="outline" size="sm" className="w-full">
        <ToggleGroupItem value="comment" className="flex-1">
          comment
        </ToggleGroupItem>
        <ToggleGroupItem value="issue" className="flex-1">
          open issue
        </ToggleGroupItem>
      </ToggleGroup>
      {kind === "issue" && <Input placeholder="title: e.g. bulk time assumes warm kitchen" value={title} onChange={(e) => setTitle(e.target.value)} />}
      <Textarea
        placeholder={kind === "issue" ? "Describe the problem, expected vs actual result…" : "Leave a comment (markdown supported)"}
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-cuelume-type
      />
      <Button type="submit" size="sm" disabled={pending || !body.trim()} className="w-full bg-brand text-brand-foreground hover:bg-brand/85">
        {kind === "issue" ? "submit issue" : "comment"}
      </Button>
    </form>
  );
}

export function IssueToggle({ id, open, className }: { id: string; open: boolean; className?: string }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      className={cn("border px-1.5 hover:border-brand hover:text-brand", className)}
      onClick={() =>
        start(async () => {
          const res = await toggleIssueAction(id);
          if (res.ok) router.refresh();
          else toast.error(res.error);
        })
      }
    >
      {open ? "close issue" : "reopen"}
    </button>
  );
}
