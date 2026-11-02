"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthUI } from "@/components/auth-bridge";

/** Shown instead of the sign-in button when Clerk isn't configured. */
export function PreviewBadge() {
  const { openSignIn } = useAuthUI();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={openSignIn} className="ml-1 h-7 border border-dashed border-brand px-2 text-[11px] text-brand">
          preview
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">Read-only demo. Sign-in, forking and editing are disabled until auth is configured.</TooltipContent>
    </Tooltip>
  );
}
