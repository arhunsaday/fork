import Link from "next/link";
import { notFound } from "next/navigation";
import { GitForkIcon, ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { getRecipe, hasStarred, getDiscussion, aheadBehind } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { Identicon } from "@/components/common";
import { RepoActions } from "@/components/recipe/repo-actions";
import { RepoTabs } from "@/components/recipe/repo-tabs";
import { SyncUpstream } from "@/components/recipe/sync-upstream";

export async function generateMetadata({ params }: LayoutProps<"/[user]/[slug]">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  return r ? { title: `${r.recipe.title} — ${user}/${slug}`, description: r.recipe.description } : {};
}

export default async function RepoLayout({ children, params }: LayoutProps<"/[user]/[slug]">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const viewer = await getViewer().catch(() => null);
  const [starred, discussion, ab] = await Promise.all([
    hasStarred(viewer?.id, r.recipe.id),
    getDiscussion(r.recipe.id),
    r.upstream ? aheadBehind(r.recipe, r.upstream.headCommitId) : Promise.resolve(null),
  ]);
  const openIssues = discussion.filter((d) => d.comment.kind === "issue" && d.comment.status === "open").length;
  const isOwner = viewer?.id === r.recipe.ownerId;
  const base = `/${user}/${slug}`;

  return (
    <div className="mx-auto max-w-[1400px] px-3 pt-5 sm:px-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <Identicon name={r.owner.username} src={r.owner.imageUrl} size={18} />
            <Link href={`/${user}`} className="text-muted-foreground hover:text-brand hover:underline">
              {user}
            </Link>
            <span className="text-faint">/</span>
            <Link href={base} className="font-semibold hover:underline">
              {slug}
            </Link>
            <span className="border px-1.5 text-[10px] text-muted-foreground">{r.recipe.isPublic ? "public" : "private"}</span>
          </div>
          {r.upstream && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitForkIcon className="size-3" /> forked from{" "}
                <Link className="text-foreground hover:text-brand hover:underline" href={`/${r.upstream.username}/${r.upstream.slug}`}>
                  {r.upstream.username}/{r.upstream.slug}
                </Link>
              </span>
              {ab && (
                <span className="tabular">
                  <span className={ab.ahead ? "text-add" : ""}>{ab.ahead} ahead</span>, <span className={ab.behind ? "text-del" : ""}>{ab.behind} behind</span>
                </span>
              )}
              {ab && ab.behind > 0 && isOwner && <SyncUpstream recipeId={r.recipe.id} />}
              {ab && ab.ahead > 0 && (
                <Link href={`${base}/compare`} className="flex items-center gap-1 hover:text-brand">
                  <ArrowBendUpLeftIcon className="size-3" /> compare with upstream
                </Link>
              )}
            </div>
          )}
        </div>
        <RepoActions
          recipeId={r.recipe.id}
          commitId={r.head.id}
          owner={user}
          slug={slug}
          isOwner={isOwner}
          signedIn={!!viewer}
          starred={starred}
          stars={r.recipe.starsCount}
          forks={r.recipe.forksCount}
          cooks={r.recipe.cooksCount}
          aiEnabled={aiEnabled()}
          recipe={r.head.data}
        />
      </div>
      <RepoTabs base={base} openIssues={openIssues} cooks={r.recipe.cooksCount} forks={r.recipe.forksCount} />
      <div className="pt-5">{children}</div>
    </div>
  );
}
