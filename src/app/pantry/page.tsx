import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { getDb, schema } from "@/db";
import { listRecipes } from "@/lib/queries";
import { coverage } from "@/lib/recipe/match";
import { PantryManager } from "@/components/pantry/pantry-manager";
import { SectionTitle } from "@/components/common";
import { cn } from "@/lib/utils";

export const metadata = { title: "pantry" };

export default async function PantryPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/pantry");
  const db = await getDb();
  const items = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.userId, viewer.id)).orderBy(desc(schema.pantryItems.createdAt));
  const ingredients = items.filter((i) => i.kind === "ingredient").map((i) => i.name);
  const equipment = items.filter((i) => i.kind === "equipment").map((i) => i.name);

  const all = await listRecipes({ sort: "stars", limit: 200 });
  const ranked = all
    .filter((r) => r.data)
    .map((r) => ({ r, c: coverage(r.data!, ingredients, equipment) }))
    .sort((a, b) => b.c.pct - a.c.pct || a.c.missing.length - b.c.missing.length)
    .slice(0, 12);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-3 pt-6 sm:px-5 lg:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="mb-1 text-2xl font-bold">
          <span className="text-brand">~/</span>pantry
        </h1>
        <p className="mb-5 text-xs text-muted-foreground">Ingredients and equipment you have. Recipes check their dependencies against this.</p>
        <PantryManager items={items.map((i) => ({ id: i.id, name: i.name, kind: i.kind as "ingredient" | "equipment" }))} />
      </div>
      <div>
        <SectionTitle>what can I make?</SectionTitle>
        {!items.length && <p className="mb-3 text-xs text-muted-foreground">Add a few items to see matches. Water is always assumed available.</p>}
        <ul className="divide-y border bg-card">
          {ranked.map(({ r, c }) => (
            <li key={r.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3 text-xs">
                <Link href={`/${r.owner}/${r.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand">
                  {r.title}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {r.owner}/{r.slug}
                  </span>
                </Link>
                <div className="h-1.5 w-24 shrink-0 bg-muted">
                  <div className={cn("h-full", c.pct === 1 ? "bg-add" : c.pct > 0.6 ? "bg-brand" : "bg-muted-foreground/50")} style={{ width: `${c.pct * 100}%` }} />
                </div>
                <span className={cn("w-10 text-right tabular", c.pct === 1 && "text-add")}>{Math.round(c.pct * 100)}%</span>
              </div>
              {c.missing.length > 0 && c.missing.length <= 6 && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  missing: <span className="text-del">{c.missing.map((m) => m.name).join(", ")}</span>
                </p>
              )}
              {c.missing.length === 0 && <p className="mt-1 text-[11px] text-add">all dependencies satisfied ✓{c.eqMissing.length ? ` · needs ${c.eqMissing.join(", ")}` : ""}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
