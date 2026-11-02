"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ username }: { username: string | null }) {
  const pathname = usePathname();
  const links = [
    { href: "/explore", label: "explore" },
    { href: "/pantry", label: "pantry" },
    { href: "/shopping", label: "shopping" },
    ...(username ? [{ href: `/${username}`, label: "profile" }] : []),
  ];
  return (
    <nav className="hidden items-center md:flex">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "relative px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-px after:bg-brand",
            )}
          >
            {active ? <span className="text-brand">./</span> : <span className="text-faint">./</span>}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
