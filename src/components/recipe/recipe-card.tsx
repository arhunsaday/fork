import Link from "next/link";
import { GitForkIcon, StarIcon, CookingPotIcon } from "@phosphor-icons/react/dist/ssr";
import type { RecipeCard as Card } from "@/lib/queries";
import { CATEGORY_LABEL, type Category } from "@/lib/recipe/schema";
import { formatMinutes } from "@/lib/recipe/units";
import { Identicon, Ago } from "@/components/common";
import { MiniGraph } from "./mini-graph";

export function RecipeCard({ r }: { r: Card }) {
  const total = (r.data?.prepMinutes ?? 0) + (r.data?.cookMinutes ?? 0);
  return (
    <Link
      href={`/${r.owner}/${r.slug}`}
      className="group relative flex flex-col border bg-card transition-colors hover:border-foreground/40"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px] text-muted-foreground">
        <Identicon name={r.owner} src={r.ownerImage} size={14} />
        <span className="truncate">
          {r.owner}/<span className="text-foreground">{r.slug}</span>
        </span>
        <span className="ml-auto shrink-0 uppercase tracking-wider text-faint">{CATEGORY_LABEL[r.category as Category] ?? r.category}</span>
      </div>
      <div className="flex flex-1 gap-3 p-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug group-hover:text-brand">{r.title}</h3>
          {r.forkedFrom && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <GitForkIcon className="size-3" /> forked from {r.forkedFrom}
            </p>
          )}
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
        </div>
        {r.data && <MiniGraph data={r.data} className="hidden h-16 w-20 shrink-0 sm:block" />}
      </div>
      <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground tabular">
        <span className="flex items-center gap-1" title="stars">
          <StarIcon className="size-3" /> {r.starsCount}
        </span>
        <span className="flex items-center gap-1" title="forks">
          <GitForkIcon className="size-3" /> {r.forksCount}
        </span>
        <span className="flex items-center gap-1" title="times cooked">
          <CookingPotIcon className="size-3" /> {r.cooksCount}
        </span>
        <span>{r.data?.ingredients.length ?? 0} ingr</span>
        {total > 0 && <span>{formatMinutes(total)}</span>}
        <Ago date={r.updatedAt} className="ml-auto text-faint" />
      </div>
    </Link>
  );
}
