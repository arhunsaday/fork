import Link from "next/link";
import { notFound } from "next/navigation";
import { getHistory, getRecipe } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { diffRecipes } from "@/lib/recipe/diff";
import { Ago, Identicon, shortSha } from "@/components/common";
import { DiffStat } from "@/components/recipe/diff-view";
import { RevertButton } from "@/components/recipe/revert-button";

export default async function HistoryPage({ params }: PageProps<"/[user]/[slug]/history">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const viewer = await getViewer().catch(() => null);
  const history = await getHistory(r.head.id);
  const base = `/${user}/${slug}`;

  return (
    <div className="max-w-4xl">
      <p className="mb-4 text-xs text-muted-foreground">
        <span className="text-foreground tabular">{history.length}</span> commits on <span className="text-brand">main</span>. Commits inherited from an upstream recipe are marked.
      </p>
      <ol className="relative border-l border-border pl-6">
        {history.map((c, i) => {
          const parent = history[i + 1];
          const diff = parent ? diffRecipes(parent.data, c.data) : null;
          const inherited = c.recipeId !== r.recipe.id;
          return (
            <li key={c.id} className="relative pb-5">
              <span className={`absolute top-2 -left-[29px] size-2.5 border-2 ${i === 0 ? "border-brand bg-brand" : inherited ? "border-muted-foreground bg-background" : "border-brand bg-background"}`} />
              <div className="border bg-card">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <Link href={`${base}/commit/${c.id}`} className="min-w-0 flex-1 font-semibold hover:text-brand hover:underline">
                    {c.message}
                  </Link>
                  {diff && <DiffStat diff={diff} />}
                  {!parent && <span className="text-[11px] text-add">root</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                  <Identicon name={c.authorUsername} size={14} />
                  <Link href={`/${c.authorUsername}`} className="hover:text-foreground">
                    {c.authorUsername}
                  </Link>
                  <span>committed</span>
                  <Ago date={c.createdAt} />
                  {inherited && (
                    <Link href={`/${c.recipeOwner}/${c.recipeSlug}`} className="border px-1.5 hover:text-brand">
                      from {c.recipeOwner}/{c.recipeSlug}
                    </Link>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    {i > 0 && viewer?.id === r.recipe.ownerId && <RevertButton recipeId={r.recipe.id} commitId={c.id} />}
                    <Link href={`${base}/commit/${c.id}`} className="font-mono text-brand hover:underline">
                      {shortSha(c.id)}
                    </Link>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
