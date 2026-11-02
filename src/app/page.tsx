import Link from "next/link";
import { ArrowRightIcon, CookingPotIcon, GitCommitIcon, GitForkIcon } from "@phosphor-icons/react/dist/ssr";
import { getFeed, getRecipe, getStats, listRecipes } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/recipe/schema";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Ago, SectionTitle } from "@/components/common";
import { HeroDemo } from "@/components/home/hero-demo";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const [trending, feed, stats, demo] = await Promise.all([
    listRecipes({ sort: "trending", limit: 6 }),
    getFeed(10),
    getStats(),
    getRecipe("ada_bakes", "banana-nut-bread"),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-grid border-b">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-3 py-12 sm:px-5 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-4 w-fit border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              <span className="text-brand">v0.1</span> · recipes for people who read diffs
            </p>
            <h1 className="text-balance text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
              Recipes, <span className="text-brand">version&#8209;controlled</span>.
            </h1>
            <p className="mt-4 max-w-lg text-sm text-muted-foreground">
              Find a recipe, <b className="text-foreground">fork</b> it, tweak it, and <b className="text-foreground">commit</b> your changes. Every recipe becomes a
              Cooking-for-Engineers table you can scale, convert and diff, with an AI sous-chef that proposes changes as pull-request-style patches.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand/85" data-cuelume-tap>
                <Link href="/new">
                  import a recipe <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" data-cuelume-navigate>
                <Link href="/explore">explore</Link>
              </Button>
            </div>
            <pre className="mt-8 border bg-background/80 p-3 text-[11.5px] leading-6 text-muted-foreground">
              <span className="text-brand">$</span> fork clone <span className="text-foreground">ada_bakes/banana-nut-bread</span>
              {"\n"}
              <span className="text-brand">$</span> fork diff upstream <span className="text-add">+80g dark chocolate</span> <span className="text-del">−30g sugar</span>
              {"\n"}
              <span className="text-brand">$</span> fork cook --servings 20 <span className="text-faint"># scales every quantity ×2</span>
            </pre>
          </div>
          {demo && <HeroDemo recipe={demo.head.data} />}
        </div>
        <div className="border-t bg-background">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 sm:grid-cols-4">
            {[
              ["recipes", stats?.recipes],
              ["forks", stats?.forks],
              ["builds logged", stats?.cooks],
              ["members", stats?.users],
            ].map(([k, v]) => (
              <div key={k as string} className="border-r px-5 py-3 last:border-r-0">
                <div className="text-xl font-bold tabular">{v ?? 0}</div>
                <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-12 px-3 py-10 sm:px-5">
        {/* Categories */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.filter((c) => c !== "other").map((c) => (
            <Link key={c} href={`/explore?category=${c}`} className="border px-3 py-1 text-xs hover:border-brand hover:text-brand" data-cuelume-navigate>
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <section>
            <SectionTitle
              right={
                <Link href="/explore" className="text-[11px] text-muted-foreground hover:text-brand">
                  view all →
                </Link>
              }
            >
              trending
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {trending.map((r) => (
                <RecipeCard key={r.id} r={r} />
              ))}
            </div>
          </section>
          <section>
            <SectionTitle>git log --all</SectionTitle>
            <ol className="space-y-0 text-xs">
              {feed.map((f, i) => (
                <li key={i} className="flex gap-2.5 border-l py-1.5 pl-3">
                  <span className="mt-0.5 shrink-0 text-brand">
                    {f.kind === "commit" ? <GitCommitIcon /> : f.kind === "fork" ? <GitForkIcon /> : <CookingPotIcon />}
                  </span>
                  <span className="min-w-0">
                    <Link href={`/${f.actor}`} className="font-semibold hover:text-brand">
                      {f.actor}
                    </Link>{" "}
                    <span className="text-muted-foreground">{f.kind === "commit" ? "committed to" : f.kind === "fork" ? "forked" : `cooked (${f.detail})`}</span>{" "}
                    <Link href={`/${f.owner}/${f.slug}`} className="hover:text-brand hover:underline">
                      {f.kind === "fork" ? f.detail : `${f.owner}/${f.slug}`}
                    </Link>
                    {f.kind === "commit" && <span className="block truncate text-muted-foreground">“{f.detail}”</span>}
                    <Ago date={f.at} className="block text-[10.5px] text-faint" />
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section>
          <SectionTitle>how it works</SectionTitle>
          <div className="grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["fork", "Found a great base recipe? Fork it into your namespace. History is shared, like git — your fork tracks how far ahead/behind upstream it is."],
              ["commit & diff", "Every edit is a commit with a message. See ingredient-level diffs (+15 g butter) and word-level step diffs between any versions."],
              ["the table", "Steps are a dependency graph. Fork renders it as a Cooking-for-Engineers table, a numbered list, or a critical-path timeline."],
              ["scale & convert", "Scale by servings, switch metric/US with ingredient-aware densities (1 cup flour ≠ 1 cup sugar), and see baker's percentages."],
              ["pantry & shopping", "Track what you own. Recipes show missing deps; one click merges what you need into an aisle-sorted shopping list."],
              ["sous-chef", "Chat with an AI about any recipe. Ask for changes and get a reviewable diff you can accept hunk-by-hunk and fork."],
            ].map(([t, d]) => (
              <div key={t} className="bg-card p-4">
                <h3 className="mb-1 font-semibold">
                  <span className="text-brand">→</span> {t}
                </h3>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
