import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommit, getRecipe } from "@/lib/queries";
import { diffRecipes, isEmptyDiff } from "@/lib/recipe/diff";
import { DiffStat, DiffView } from "@/components/recipe/diff-view";
import { Empty } from "@/components/common";

/** Fork vs upstream comparison: what this fork changed relative to its parent's current head. */
export default async function ComparePage({ params }: PageProps<"/[user]/[slug]/compare">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  if (!r.upstream?.headCommitId) {
    return <Empty title="Nothing to compare">This recipe isn&apos;t a fork. Fork someone else&apos;s recipe to compare against it.</Empty>;
  }
  const up = await getCommit(r.upstream.headCommitId);
  if (!up) notFound();
  const diff = diffRecipes(up.commit.data, r.head.data);
  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 border bg-card px-3 py-2 text-xs">
        <span className="text-muted-foreground">base:</span>
        <Link href={`/${r.upstream.username}/${r.upstream.slug}`} className="hover:text-brand">
          {r.upstream.username}/{r.upstream.slug}
        </Link>
        <span className="text-brand">←</span>
        <span className="text-muted-foreground">compare:</span>
        <span>
          {user}/{slug}
        </span>
        <DiffStat diff={diff} className="ml-auto" />
      </div>
      {isEmptyDiff(diff) ? <Empty title="Identical">This fork matches upstream exactly.</Empty> : <DiffView diff={diff} />}
    </div>
  );
}
