import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { listRecipes } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/recipe/schema";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Empty } from "@/components/common";
import { cn } from "@/lib/utils";

export const metadata = { title: "explore" };

const SORTS = ["trending", "new", "stars", "cooked", "forks"] as const;

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" && (CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : null;
  const sort = (SORTS as readonly string[]).includes(String(sp.sort)) ? (sp.sort as (typeof SORTS)[number]) : "trending";
  const rows = await listRecipes({ q: q || null, category, sort, limit: 60 });
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { q: q || null, category, sort: sort === "trending" ? null : sort, ...patch };
    Object.entries(next).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/explore${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 pt-6 sm:px-5">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-bold">
          <span className="text-brand">~/</span>explore
        </h1>
        <form className="ml-auto flex w-full max-w-md items-center border bg-card focus-within:border-brand sm:w-auto sm:flex-1" action="/explore">
          <MagnifyingGlassIcon className="ml-2.5 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="search titles, tags, users…" className="h-9 flex-1 bg-transparent px-2 text-xs outline-none" />
          {category && <input type="hidden" name="category" value={category} />}
        </form>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3 text-xs">
        <div className="flex flex-wrap gap-1">
          <Link href={href({ category: null })} className={cn("border px-2 py-0.5", !category ? "border-foreground bg-foreground text-background" : "hover:border-brand")}>
            all
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={href({ category: c })} className={cn("border px-2 py-0.5", category === c ? "border-foreground bg-foreground text-background" : "hover:border-brand")}>
              {CATEGORY_LABEL[c].toLowerCase()}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 text-muted-foreground">
          sort:
          {SORTS.map((s) => (
            <Link key={s} href={href({ sort: s === "trending" ? null : s })} className={cn("px-1.5", sort === s ? "text-brand underline underline-offset-4" : "hover:text-foreground")}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      <p className="my-3 text-[11px] text-muted-foreground tabular">
        {rows.length} result{rows.length === 1 ? "" : "s"}
        {q && (
          <>
            {" "}
            for “<span className="text-foreground">{q}</span>”
          </>
        )}
      </p>
      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <RecipeCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <Empty title="No recipes match">
          Try another search, or{" "}
          <Link href="/new" className="text-brand hover:underline">
            import one
          </Link>
          .
        </Empty>
      )}
    </div>
  );
}
