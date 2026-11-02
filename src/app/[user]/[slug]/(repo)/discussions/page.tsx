import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react/dist/ssr";
import { getDiscussion, getRecipe } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { Ago, Identicon } from "@/components/common";
import { Markdown } from "@/components/ai/markdown";
import { CommentForm, IssueToggle } from "@/components/recipe/comment-form";
import { cn } from "@/lib/utils";

export default async function DiscussionsPage({ params }: PageProps<"/[user]/[slug]/discussions">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const viewer = await getViewer().catch(() => null);
  const items = await getDiscussion(r.recipe.id);
  const open = items.filter((i) => i.comment.kind === "issue" && i.comment.status === "open").length;
  const closed = items.filter((i) => i.comment.kind === "issue" && i.comment.status === "closed").length;

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          <span className="text-add">{open} open</span> · {closed} closed issues · {items.length - open - closed} comments
        </p>
        {items.length === 0 && <p className="border border-dashed p-6 text-center text-xs text-muted-foreground">No discussion yet. Cooked it? Spotted a bug in step 4? Say so.</p>}
        {items.map(({ comment: c, username, imageUrl }) => (
          <article key={c.id} className={cn("border bg-card", c.kind === "issue" && c.status === "open" && "border-l-2 border-l-add")}>
            <header className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
              <Identicon name={username} src={imageUrl} size={16} />
              <Link href={`/${username}`} className="font-semibold text-foreground hover:text-brand">
                {username}
              </Link>
              {c.kind === "issue" ? (
                <span className={cn("flex items-center gap-1", c.status === "open" ? "text-add" : "text-muted-foreground")}>
                  {c.status === "open" ? <CircleIcon className="size-3" weight="bold" /> : <CheckCircleIcon className="size-3" weight="fill" />}
                  issue · {c.status}
                </span>
              ) : (
                <span>commented</span>
              )}
              <Ago date={c.createdAt} />
              {c.kind === "issue" && viewer && (viewer.id === c.userId || viewer.id === r.recipe.ownerId) && (
                <IssueToggle id={c.id} open={c.status === "open"} className="ml-auto" />
              )}
            </header>
            <div className="px-3 py-2">
              {c.title && <h3 className="mb-1 font-semibold">{c.title}</h3>}
              <Markdown>{c.body}</Markdown>
            </div>
          </article>
        ))}
      </div>
      <aside>
        <CommentForm recipeId={r.recipe.id} signedIn={!!viewer} />
      </aside>
    </div>
  );
}
