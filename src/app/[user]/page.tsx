import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity, getStarredIds, getUserByUsername, getUserCookLog, listRecipes } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { Ago, Empty, Identicon } from "@/components/common";
import { ContributionGraph } from "@/components/profile/contribution-graph";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[user]">) {
  const { user } = await params;
  return { title: user };
}

export default async function ProfilePage({ params, searchParams }: PageProps<"/[user]">) {
  const { user } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "stars" ? "stars" : sp.tab === "builds" ? "builds" : "recipes";
  const u = await getUserByUsername(user);
  if (!u) notFound();
  const viewer = await getViewer().catch(() => null);
  const [recipes, starredIds, activity, cooks] = await Promise.all([listRecipes({ ownerId: u.id, sort: "new", limit: 100 }), getStarredIds(u.id), getActivity(u.id), getUserCookLog(u.id)]);
  const starred = tab === "stars" ? await listRecipes({ ids: starredIds, sort: "stars" }) : [];
  const totalStars = recipes.reduce((a, r) => a + r.starsCount, 0);
  const contributions = [...activity.values()].reduce((a, v) => a + v.commits + v.cooks, 0);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-3 pt-8 sm:px-5 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <Identicon name={u.username} src={u.imageUrl} size={200} className="hidden border lg:block" />
        <div className="flex items-center gap-3 lg:block">
          <Identicon name={u.username} src={u.imageUrl} size={56} className="border lg:hidden" />
          <div>
            <h1 className="text-xl font-bold">{u.displayName}</h1>
            <p className="text-muted-foreground">@{u.username}</p>
          </div>
        </div>
        {u.bio && <p className="text-xs">{u.bio}</p>}
        <dl className="grid grid-cols-3 gap-px border bg-border text-center">
          {[
            ["recipes", recipes.length],
            ["stars", totalStars],
            ["builds", cooks.length],
          ].map(([k, v]) => (
            <div key={k} className="bg-card py-2">
              <dd className="text-base font-bold tabular">{v}</dd>
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-muted-foreground">
          joined <Ago date={u.createdAt} />
          {viewer?.id === u.id && <span className="ml-2 text-brand">(you)</span>}
        </p>
      </aside>

      <div className="min-w-0 space-y-6">
        <section>
          <p className="mb-2 text-xs text-muted-foreground">
            <span className="text-foreground tabular">{contributions}</span> contributions in the last year (commits + builds)
          </p>
          <ContributionGraph data={Object.fromEntries(activity)} />
        </section>

        <nav className="flex border-b text-xs">
          {(["recipes", "stars", "builds"] as const).map((t) => (
            <Link
              key={t}
              href={t === "recipes" ? `/${user}` : `/${user}?tab=${t}`}
              className={cn("relative px-3 py-2 text-muted-foreground hover:text-foreground", tab === t && "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand")}
            >
              {t}
            </Link>
          ))}
        </nav>

        {tab === "recipes" &&
          (recipes.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recipes.map((r) => (
                <RecipeCard key={r.id} r={r} />
              ))}
            </div>
          ) : (
            <Empty title="No recipes yet">
              {viewer?.id === u.id ? (
                <Link href="/new" className="text-brand hover:underline">
                  Import or write your first recipe →
                </Link>
              ) : (
                "Nothing committed yet."
              )}
            </Empty>
          ))}
        {tab === "stars" &&
          (starred.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {starred.map((r) => (
                <RecipeCard key={r.id} r={r} />
              ))}
            </div>
          ) : (
            <Empty title="No stars yet" />
          ))}
        {tab === "builds" &&
          (cooks.length ? (
            <ul className="divide-y border bg-card text-xs">
              {cooks.map((c) => (
                <li key={c.cook.id} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn("w-16 px-1 text-center text-[10px] font-semibold uppercase", c.cook.outcome === "success" ? "bg-add text-background" : c.cook.outcome === "failed" ? "bg-del text-background" : "bg-chart-4 text-background")}>
                    {c.cook.outcome}
                  </span>
                  <Link href={`/${c.owner}/${c.slug}`} className="hover:text-brand">
                    {c.owner}/{c.slug}
                  </Link>
                  <span className="hidden truncate text-muted-foreground sm:block">{c.cook.notes}</span>
                  <Ago date={c.cook.createdAt} className="ml-auto shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No builds logged" />
          ))}
      </div>
    </div>
  );
}
