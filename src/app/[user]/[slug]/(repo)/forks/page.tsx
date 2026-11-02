import Link from "next/link";
import { notFound } from "next/navigation";
import { CookingPotIcon, GitForkIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";
import { getCommit, getForks, getRecipe } from "@/lib/queries";
import { diffRecipes } from "@/lib/recipe/diff";
import { Ago, Empty, Identicon } from "@/components/common";
import { DiffStat } from "@/components/recipe/diff-view";

/** Fork network: a tree of every variant, with how far each diverged. */
export default async function ForksPage({ params }: PageProps<"/[user]/[slug]/forks">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();

  type Node = Awaited<ReturnType<typeof getForks>>[number] & { children: Node[]; diff: ReturnType<typeof diffRecipes> | null; depth: number };
  const build = async (recipeId: string, depth: number): Promise<Node[]> => {
    if (depth > 4) return [];
    const forks = await getForks(recipeId);
    return Promise.all(
      forks.map(async (f) => {
        const head = f.headCommitId ? await getCommit(f.headCommitId) : null;
        return { ...f, depth, diff: head ? diffRecipes(r.head.data, head.commit.data) : null, children: await build(f.id, depth + 1) };
      }),
    );
  };
  const tree = await build(r.recipe.id, 1);

  if (!tree.length)
    return (
      <Empty title="No forks yet">
        Be the first to fork <span className="text-foreground">{user}/{slug}</span> and improve on it.
      </Empty>
    );

  const flat: Node[] = [];
  const walk = (ns: Node[]) => ns.forEach((n) => (flat.push(n), walk(n.children)));
  walk(tree);

  return (
    <div className="max-w-4xl">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Identicon name={user} size={16} />
        <span className="font-semibold">
          {user}/{slug}
        </span>
        <span className="text-muted-foreground">· root</span>
      </div>
      <ul className="font-mono text-xs">
        {flat.map((n) => (
          <li key={n.id} className="flex items-center gap-2 py-1" style={{ paddingLeft: `${(n.depth - 1) * 24}px` }}>
            <span className="text-faint">└──</span>
            <GitForkIcon className="size-3.5 text-brand" />
            <Link href={`/${n.owner}/${n.slug}`} className="hover:text-brand hover:underline">
              {n.owner}/{n.slug}
            </Link>
            {n.diff && <DiffStat diff={n.diff} className="hidden sm:inline-flex" />}
            <span className="ml-auto flex items-center gap-3 text-muted-foreground tabular">
              <span className="flex items-center gap-1">
                <StarIcon className="size-3" />
                {n.starsCount}
              </span>
              <span className="flex items-center gap-1">
                <CookingPotIcon className="size-3" />
                {n.cooksCount}
              </span>
              <Ago date={n.updatedAt} className="hidden w-24 text-right sm:inline" />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-faint">diff stats are relative to this recipe&apos;s current head.</p>
    </div>
  );
}
