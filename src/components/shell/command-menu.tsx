"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BasketIcon,
  CompassIcon,
  CookingPotIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  UserIcon,
} from "@phosphor-icons/react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSound } from "@/components/providers";

type Hit = { owner: string; slug: string; title: string; category: string; starsCount: number };

export function CommandMenu({ username }: { username: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { play } = useSound();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping(e))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setHits(d.results ?? []))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    play("navigate", { emphasis: "subtle" });
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden w-56 justify-start gap-2 text-muted-foreground lg:inline-flex"
        data-cuelume-open
      >
        <MagnifyingGlassIcon />
        <span>search recipes…</span>
        <Kbd className="ml-auto !rounded-none">⌘K</Kbd>
      </Button>
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <MagnifyingGlassIcon />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search recipes or run a command">
        <Command shouldFilter={false}>
        <CommandInput placeholder="type a recipe, user, tag… or a command" value={q} onValueChange={setQ} />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>no matches. try `explore` →</CommandEmpty>
          {hits.length > 0 && (
            <CommandGroup heading={q ? "recipes" : "trending"}>
              {hits.map((h) => (
                <CommandItem key={`${h.owner}/${h.slug}`} value={`${h.owner}/${h.slug}`} onSelect={() => go(`/${h.owner}/${h.slug}`)}>
                  <CookingPotIcon />
                  <span className="text-muted-foreground">{h.owner}/</span>
                  <span className="truncate">{h.slug}</span>
                  <CommandShortcut>★ {h.starsCount}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="commands">
            {match(q, "new recipe create") && (
              <CommandItem onSelect={() => go("/new")}>
                <PlusIcon /> new recipe <CommandShortcut>n</CommandShortcut>
              </CommandItem>
            )}
            {match(q, "import link url paste") && (
              <CommandItem onSelect={() => go("/new?tab=url")}>
                <LinkIcon /> import from link
              </CommandItem>
            )}
            {match(q, "explore browse") && (
              <CommandItem onSelect={() => go(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore")}>
                <CompassIcon /> explore{q ? ` “${q}”` : ""}
              </CommandItem>
            )}
            {match(q, "pantry inventory equipment") && (
              <CommandItem onSelect={() => go("/pantry")}>
                <PackageIcon /> pantry
              </CommandItem>
            )}
            {match(q, "shopping list groceries") && (
              <CommandItem onSelect={() => go("/shopping")}>
                <BasketIcon /> shopping list
              </CommandItem>
            )}
            {username && match(q, "profile me") && (
              <CommandItem onSelect={() => go(`/${username}`)}>
                <UserIcon /> my profile
              </CommandItem>
            )}
            {match(q, "theme dark light toggle") && (
              <CommandItem
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
              >
                <MoonIcon /> toggle theme
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function match(q: string, words: string) {
  if (!q) return true;
  return words.split(" ").some((w) => w.startsWith(q.toLowerCase()) || q.toLowerCase().startsWith(w));
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
