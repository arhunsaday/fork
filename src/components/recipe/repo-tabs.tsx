"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenTextIcon, ChatsCircleIcon, ClockCounterClockwiseIcon, CookingPotIcon, GitForkIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function RepoTabs({ base, openIssues, cooks, forks }: { base: string; openIssues: number; cooks: number; forks: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: base, label: "recipe", icon: BookOpenTextIcon, exact: true },
    { href: `${base}/history`, label: "history", icon: ClockCounterClockwiseIcon, also: [`${base}/commit`, `${base}/compare`] },
    { href: `${base}/forks`, label: "forks", icon: GitForkIcon, count: forks },
    { href: `${base}/discussions`, label: "discussions", icon: ChatsCircleIcon, count: openIssues },
    { href: `${base}/builds`, label: "builds", icon: CookingPotIcon, count: cooks },
  ];
  return (
    <nav className="scrollbar-none -mx-3 mt-4 flex overflow-x-auto border-b px-3 sm:mx-0 sm:px-0" data-noprint>
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href) || t.also?.some((a) => pathname.startsWith(a));
        return (
          <Link
            key={t.href}
            href={t.href}
            data-cuelume-select
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
            {!!t.count && <span className="bg-muted px-1.5 text-[10px] tabular">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
