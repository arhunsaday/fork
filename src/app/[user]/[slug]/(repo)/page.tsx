import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { GitCommitIcon, LinkSimpleIcon, ScalesIcon } from "@phosphor-icons/react/dist/ssr";
import { getRecipe } from "@/lib/queries";
import { getViewer } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { getDb, schema } from "@/db";
import { CATEGORY_LABEL } from "@/lib/recipe/schema";
import { formatMinutes } from "@/lib/recipe/units";
import { RecipeView } from "@/components/recipe/recipe-view";
import { SelectionActions } from "@/components/ai/selection-actions";
import { Ago, Shield, shortSha } from "@/components/common";
import { Markdown } from "@/components/ai/markdown";

export default async function RecipePage({ params }: PageProps<"/[user]/[slug]">) {
  const { user, slug } = await params;
  const r = await getRecipe(user, slug);
  if (!r) notFound();
  const viewer = await getViewer().catch(() => null);
  let pantry: { ingredients: string[]; equipment: string[] } | null = null;
  if (viewer) {
    const db = await getDb();
    const items = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.userId, viewer.id));
    pantry = {
      ingredients: items.filter((i) => i.kind === "ingredient").map((i) => i.name),
      equipment: items.filter((i) => i.kind === "equipment").map((i) => i.name),
    };
  }
  const d = r.head.data;
  const total = (d.prepMinutes ?? 0) + (d.cookMinutes ?? 0);
  const base = `/${user}/${slug}`;

  return (
    <SelectionActions enabled={!!viewer && aiEnabled()}>
      <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {/* latest commit bar */}
          <Link href={`${base}/history`} className="flex items-center gap-2 border bg-card px-3 py-1.5 text-[11px] text-muted-foreground hover:border-foreground/30" data-noprint>
            <GitCommitIcon className="size-3.5 text-brand" />
            <span className="text-foreground">{r.head.message}</span>
            <code className="ml-auto text-faint">{shortSha(r.head.id)}</code>
            <Ago date={r.head.createdAt} />
          </Link>

          <div>
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{d.title}</h1>
            {d.description && <p className="mt-2 max-w-3xl text-[13px] text-muted-foreground">{d.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Shield k="serves" v={d.servings} />
              {d.yieldLabel && <Shield k="yield" v={d.yieldLabel} />}
              <Shield k="prep" v={formatMinutes(d.prepMinutes)} />
              <Shield k="cook" v={formatMinutes(d.cookMinutes)} />
              {total > 0 && <Shield k="total" v={formatMinutes(total)} tone="brand" />}
              <Shield k="steps" v={d.steps.length} />
              <Shield k="category" v={CATEGORY_LABEL[d.category]} />
            </div>
          </div>

          <RecipeView recipe={d} recipeId={r.recipe.id} signedIn={!!viewer} pantry={pantry} />
        </div>

        <aside className="space-y-5 text-xs">
          <Panel title="about">
            <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1.5">
              <dt className="text-muted-foreground">owner</dt>
              <dd>
                <Link href={`/${user}`} className="hover:text-brand hover:underline">
                  {user}
                </Link>
              </dd>
              <dt className="text-muted-foreground">license</dt>
              <dd className="flex items-center gap-1">
                <ScalesIcon className="size-3" />
                {r.recipe.license}
              </dd>
              <dt className="text-muted-foreground">created</dt>
              <dd>
                <Ago date={r.recipe.createdAt} />
              </dd>
              <dt className="text-muted-foreground">head</dt>
              <dd>
                <code className="text-brand">{shortSha(r.head.id)}</code>
              </dd>
              {d.source?.url && (
                <>
                  <dt className="text-muted-foreground">source</dt>
                  <dd className="min-w-0">
                    <a href={d.source.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 truncate hover:text-brand">
                      <LinkSimpleIcon className="size-3 shrink-0" />
                      <span className="truncate">{d.source.name || new URL(d.source.url).hostname}</span>
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </Panel>
          {d.equipment.length > 0 && (
            <Panel title="requires">
              <ul className="space-y-1">
                {d.equipment.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span className="text-brand">▪</span>
                    {e}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {d.tags.length > 0 && (
            <Panel title="tags">
              <div className="flex flex-wrap gap-1">
                {d.tags.map((t) => (
                  <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="bg-brand-tint px-1.5 py-0.5 text-[11px] text-brand hover:bg-brand hover:text-brand-foreground">
                    #{t}
                  </Link>
                ))}
              </div>
            </Panel>
          )}
          {d.notes && (
            <Panel title="notes">
              <Markdown>{d.notes}</Markdown>
            </Panel>
          )}
          <p className="text-[10.5px] text-faint" data-noprint>
            tip: highlight any text in the recipe to ask the sous-chef about it.
          </p>
        </aside>
      </div>
    </SelectionActions>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b pb-1 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-brand">#</span> {title}
      </h3>
      {children}
    </section>
  );
}
