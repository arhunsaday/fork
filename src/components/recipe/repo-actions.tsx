"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useClerk } from "@clerk/nextjs";
import {
  CookingPotIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  GitForkIcon,
  PencilSimpleIcon,
  PlayIcon,
  SparkleIcon,
  StarIcon,
  TrashIcon,
  CopyIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteRecipeAction, forkRecipeAction, toggleStarAction } from "@/app/actions";
import { useSound } from "@/components/providers";
import { CookLogDialog } from "./cook-log-dialog";
import { SousChef } from "@/components/ai/sous-chef";
import type { RecipeData } from "@/lib/recipe/schema";
import { download, toCooklang, toMarkdown } from "@/lib/recipe/export";
import { cn } from "@/lib/utils";

type Props = {
  recipeId: string;
  commitId: string;
  owner: string;
  slug: string;
  isOwner: boolean;
  signedIn: boolean;
  starred: boolean;
  stars: number;
  forks: number;
  cooks: number;
  aiEnabled: boolean;
  recipe: RecipeData;
};

export function RepoActions(p: Props) {
  const router = useRouter();
  const clerk = useClerk();
  const { play } = useSound();
  const [starred, setStarred] = React.useState(p.starred);
  const [stars, setStars] = React.useState(p.stars);
  const [pending, start] = React.useTransition();
  const [chatOpen, setChatOpen] = React.useState(false);
  const base = `/${p.owner}/${p.slug}`;

  const needAuth = () => {
    if (p.signedIn) return false;
    clerk.openSignIn();
    return true;
  };

  const star = () => {
    if (needAuth()) return;
    setStarred(!starred);
    setStars((s) => s + (starred ? -1 : 1));
    start(async () => {
      const res = await toggleStarAction(p.recipeId);
      if (res.ok) {
        setStarred(res.starred);
        setStars(res.count);
      } else toast.error(res.error);
    });
  };

  const fork = () => {
    if (needAuth()) return;
    start(async () => {
      const res = await forkRecipeAction(p.recipeId);
      if (res.ok) {
        play("success");
        toast.success(`Forked → ${res.path.slice(1)}`);
        router.push(res.path);
      } else toast.error(res.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-noprint>
      <Button variant={chatOpen ? "default" : "outline"} size="sm" onClick={() => (needAuth() ? null : setChatOpen(true))} className="gap-1.5" data-cuelume-open>
        <SparkleIcon weight="fill" className="text-brand" /> sous-chef
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`${base}/cook`} data-cuelume-navigate>
          <PlayIcon weight="fill" /> cook mode
        </Link>
      </Button>
      <CookLogDialog recipeId={p.recipeId} commitId={p.commitId} signedIn={p.signedIn} count={p.cooks}>
        <Button variant="outline" size="sm" className="gap-0 p-0" data-cuelume-open>
          <span className="flex items-center gap-1.5 px-2.5">
            <CookingPotIcon /> cooked it
          </span>
          <span className="border-l px-2 tabular text-muted-foreground">{p.cooks}</span>
        </Button>
      </CookLogDialog>
      <Button variant="outline" size="sm" onClick={star} className="gap-0 p-0" data-cuelume-toggle disabled={pending && false}>
        <span className="flex items-center gap-1.5 px-2.5">
          <StarIcon weight={starred ? "fill" : "regular"} className={cn(starred && "text-brand")} /> {starred ? "starred" : "star"}
        </span>
        <span className="border-l px-2 tabular text-muted-foreground">{stars}</span>
      </Button>
      {!p.isOwner && (
        <Button size="sm" onClick={fork} disabled={pending} className="gap-0 bg-brand p-0 text-brand-foreground hover:bg-brand/85" data-cuelume-tap>
          <span className="flex items-center gap-1.5 px-2.5">
            <GitForkIcon weight="bold" /> fork
          </span>
          <span className="border-l border-brand-foreground/20 px-2 tabular">{p.forks}</span>
        </Button>
      )}
      {p.isOwner && (
        <Button size="sm" asChild className="bg-brand text-brand-foreground hover:bg-brand/85">
          <Link href={`${base}/edit`} data-cuelume-navigate>
            <PencilSimpleIcon /> edit
          </Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More actions" data-cuelume-open>
            <DotsThreeIcon weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">export</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => {
              navigator.clipboard.writeText(toMarkdown(p.recipe, `${p.owner}/${p.slug}`));
              play("success", { emphasis: "subtle" });
              toast.success("Markdown copied");
            }}
          >
            <CopyIcon /> copy as markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(`${p.slug}.md`, toMarkdown(p.recipe, `${p.owner}/${p.slug}`), "text/markdown")}>
            <DownloadSimpleIcon /> download .md
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(`${p.slug}.cook`, toCooklang(p.recipe))}>
            <DownloadSimpleIcon /> download .cook (Cooklang)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(`${p.slug}.json`, JSON.stringify(p.recipe, null, 2), "application/json")}>
            <DownloadSimpleIcon /> download .json
          </DropdownMenuItem>
          {p.isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  start(async () => {
                    if (!confirm(`Delete ${p.owner}/${p.slug}? This cannot be undone.`)) return;
                    const res = await deleteRecipeAction(p.recipeId);
                    if (res.ok) {
                      toast.success("Deleted");
                      router.push(`/${p.owner}`);
                    } else toast.error(res.error);
                  })
                }
              >
                <TrashIcon /> delete recipe
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SousChef
        open={chatOpen}
        onOpenChange={setChatOpen}
        recipe={p.recipe}
        recipeId={p.recipeId}
        path={`${p.owner}/${p.slug}`}
        isOwner={p.isOwner}
        aiEnabled={p.aiEnabled}
      />
    </div>
  );
}
