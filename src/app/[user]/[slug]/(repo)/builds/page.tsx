import Link from "next/link";
import { notFound } from "next/navigation";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { getCooks, getRecipe } from "@/lib/queries";
import { Ago, Empty, Identicon, shortSha } from "@/components/common";
import { cn } from "@/lib/utils";

const BADGE: Record<string, string> = {
  success: "bg-add text-background",
  partial: "bg-chart-4 text-background",
  failed: "bg-del text-background",
};

/** CI-style build log: every time someone cooked this recipe. */
export default async function BuildsPage({ params }: PageProps<"/[user]/[slug]/builds">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const cooks = await getCooks(r.recipe.id);
  if (!cooks.length) return <Empty title="No builds yet">Cook it and hit “cooked it” to log the first build.</Empty>;
  const ok = cooks.filter((c) => c.cook.outcome === "success").length;
  const rated = cooks.filter((c) => c.cook.rating);
  const avg = rated.length ? rated.reduce((a, c) => a + c.cook.rating!, 0) / rated.length : null;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap gap-px border bg-border text-xs">
        <Stat label="builds" value={cooks.length} />
        <Stat label="success rate" value={`${Math.round((ok / cooks.length) * 100)}%`} tone={ok / cooks.length > 0.7 ? "add" : "del"} />
        <Stat label="avg rating" value={avg ? `${avg.toFixed(1)} / 5` : "–"} />
        <div className="flex flex-1 items-end gap-0.5 bg-card px-3 py-2" title="last builds, oldest → newest">
          {[...cooks].reverse().map((c) => (
            <span key={c.cook.id} className={cn("w-2", BADGE[c.cook.outcome].split(" ")[0])} style={{ height: `${8 + (c.cook.rating ?? 3) * 4}px` }} />
          ))}
        </div>
      </div>
      <ul className="divide-y border bg-card">
        {cooks.map(({ cook: c, username, imageUrl }) => (
          <li key={c.id} className="flex gap-3 px-3 py-2.5 text-xs">
            <span className={cn("h-5 shrink-0 px-1.5 text-[10.5px] font-semibold uppercase leading-5", BADGE[c.outcome])}>{c.outcome}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <Identicon name={username} src={imageUrl} size={14} />
                <Link href={`/${username}`} className="text-foreground hover:text-brand">
                  {username}
                </Link>
                <span>cooked</span>
                {c.commitId && (
                  <Link href={`/${user}/${slug}/commit/${c.commitId}`} className="text-brand hover:underline">
                    {shortSha(c.commitId)}
                  </Link>
                )}
                <Ago date={c.createdAt} />
                {c.rating && (
                  <span className="ml-auto flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarIcon key={i} weight={i < c.rating! ? "fill" : "regular"} className={cn("size-3", i < c.rating! ? "text-brand" : "text-faint")} />
                    ))}
                  </span>
                )}
              </div>
              {c.notes && <p className="mt-1 text-[13px]">{c.notes}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "add" | "del" }) {
  return (
    <div className="bg-card px-4 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold tabular", tone === "add" && "text-add", tone === "del" && "text-del")}>{value}</div>
    </div>
  );
}
