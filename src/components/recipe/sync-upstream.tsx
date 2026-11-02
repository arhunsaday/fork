"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { syncUpstreamAction } from "@/app/actions";

export function SyncUpstream({ recipeId }: { recipeId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      className="flex items-center gap-1 text-brand hover:underline disabled:opacity-50"
      onClick={() =>
        start(async () => {
          if (!confirm("Merge upstream? This replaces your fork's content with the latest upstream version as a new commit (your history is kept).")) return;
          const res = await syncUpstreamAction(recipeId);
          if (res.ok) {
            toast.success("Merged upstream");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      <ArrowsClockwiseIcon className={pending ? "size-3 animate-spin" : "size-3"} /> sync fork
    </button>
  );
}
