"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { revertToCommitAction } from "@/app/actions";

export function RevertButton({ recipeId, commitId }: { recipeId: string; commitId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      title="Restore this version as a new commit"
      className="flex items-center gap-1 hover:text-brand disabled:opacity-50"
      onClick={() =>
        start(async () => {
          if (!confirm(`Restore ${commitId.slice(0, 7)} as a new commit on top of main?`)) return;
          const res = await revertToCommitAction(recipeId, commitId);
          if (res.ok) {
            toast.success("Reverted");
            router.push(res.path);
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <ArrowCounterClockwiseIcon className="size-3" /> revert to
    </button>
  );
}
