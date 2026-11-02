"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { GitBranchIcon } from "@phosphor-icons/react";
import { Kbd } from "@/components/ui/kbd";

/** IDE-style status bar pinned to the bottom of the viewport. */
export function StatusBar({ ai, preview }: { ai: string | null; preview?: boolean }) {
  const pathname = usePathname();
  const [time, setTime] = React.useState<string>("");
  React.useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  const segments = pathname.split("/").filter(Boolean);
  return (
    <footer data-noprint className="fixed inset-x-0 bottom-0 z-40 flex h-7 items-center gap-3 border-t bg-background/95 px-3 text-[11px] text-muted-foreground backdrop-blur">
      <span className="flex items-center gap-1 text-brand">
        <GitBranchIcon className="size-3.5" weight="bold" />
        main
      </span>
      <span className="hidden truncate sm:inline">~/{segments.join("/")}</span>
      {preview && (
        <span className="bg-brand-tint px-1.5 text-brand" title="Read-only demo: sign-in is disabled and data resets on cold starts until Clerk and a database are configured.">
          preview mode · read-only demo
        </span>
      )}
      <span className="ml-auto hidden items-center gap-1.5 sm:flex">
        <span className={ai ? "size-1.5 bg-add" : "size-1.5 bg-faint"} />
        ai: {ai ?? "offline"}
      </span>
      <span className="hidden items-center gap-1 md:flex">
        <Kbd className="!rounded-none">⌘K</Kbd> commands
      </span>
      <span className="tabular">{time}</span>
    </footer>
  );
}
