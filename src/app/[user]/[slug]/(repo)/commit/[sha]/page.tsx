import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommit, getRecipe } from "@/lib/queries";
import { diffRecipes } from "@/lib/recipe/diff";
import { Ago, Identicon, shortSha } from "@/components/common";
import { DiffStat, DiffView } from "@/components/recipe/diff-view";
import { RecipeTable } from "@/components/recipe/recipe-table";

export default async function CommitPage({ params }: PageProps<"/[user]/[slug]/commit/[sha]">) {
  const { user, slug, sha } = await params;
  const r = await getRecipe(user, slug);
  const c = await getCommit(sha);
  if (!r || !c) notFound();
  const parent = c.commit.parentId ? await getCommit(c.commit.parentId) : null;
  const diff = parent ? diffRecipes(parent.commit.data, c.commit.data) : null;
  const base = `/${user}/${slug}`;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="border bg-card">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">{c.commit.message}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Identicon name={c.author} size={14} />
            <Link href={`/${c.author}`} className="hover:text-foreground">
              {c.author}
            </Link>
            committed <Ago date={c.commit.createdAt} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            commit <code className="text-brand">{c.commit.id}</code>
          </span>
          {parent && (
            <span>
              parent{" "}
              <Link href={`${base}/commit/${parent.commit.id}`} className="text-foreground hover:text-brand">
                {shortSha(parent.commit.id)}
              </Link>
            </span>
          )}
          {diff && <DiffStat diff={diff} className="ml-auto" />}
        </div>
      </div>

      {diff ? (
        <DiffView diff={diff} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Root commit: the recipe as first written.</p>
          <RecipeTable recipe={c.commit.data} />
        </div>
      )}
    </div>
  );
}
