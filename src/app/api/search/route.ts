import { listRecipes } from "@/lib/queries";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() || null;
  const rows = await listRecipes({ q, sort: q ? "stars" : "trending", limit: 8 });
  return Response.json({
    results: rows.map((r) => ({ owner: r.owner, slug: r.slug, title: r.title, category: r.category, starsCount: r.starsCount })),
  });
}
