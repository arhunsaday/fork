import { createHash } from "node:crypto";
import { count, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { RecipeData } from "@/lib/recipe/schema";
import { slugify } from "@/lib/recipe/schema";
import {
  SEED_USERS,
  bananaBread,
  bananaBreadForkCommits,
  choux,
  chili,
  cookieCommits,
  pancakes,
  sourdough,
  vinaigrette,
} from "./seed-data";

type DB = PostgresJsDatabase<typeof schema>;

/**
 * Deterministic ids: in preview mode every serverless instance seeds its own
 * in-memory DB, so ids (and therefore commit URLs) must match across instances.
 */
let seq = 0;
const nanoid = (len: number) =>
  createHash("sha256").update(`fork-seed-${seq++}`).digest("base64url").replace(/[-_]/g, "x").slice(0, len);

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000);

async function createRecipe(
  db: DB,
  ownerId: string,
  history: { message: string; data: RecipeData; at?: Date }[],
  opts: { forkedFromId?: string; forkedFromCommitId?: string; createdAt?: Date } = {},
) {
  const id = nanoid(10);
  const last = history[history.length - 1].data;
  await db.insert(schema.recipes).values({
    id,
    ownerId,
    slug: slugify(last.title),
    title: last.title,
    description: last.description,
    category: last.category,
    tags: last.tags,
    forkedFromId: opts.forkedFromId ?? null,
    forkedFromCommitId: opts.forkedFromCommitId ?? null,
    createdAt: opts.createdAt ?? history[0].at ?? new Date(),
    updatedAt: history[history.length - 1].at ?? new Date(),
  });
  let parentId: string | null = opts.forkedFromCommitId ?? null;
  for (const c of history) {
    const cid = nanoid(12);
    await db.insert(schema.commits).values({
      id: cid,
      recipeId: id,
      parentId,
      authorId: ownerId,
      message: c.message,
      data: c.data,
      createdAt: c.at ?? new Date(),
    });
    parentId = cid;
  }
  await db.update(schema.recipes).set({ headCommitId: parentId }).where(eqId(id));
  return { id, headCommitId: parentId! };
}

const eqId = (id: string) => eq(schema.recipes.id, id);

export async function seedIfEmpty(db: DB) {
  const [{ value }] = await db.select({ value: count() }).from(schema.users);
  if (value > 0) return;
  await seed(db);
}

export async function seed(db: DB) {
  seq = 0;
  await db.insert(schema.users).values(SEED_USERS.map((u) => ({ ...u, createdAt: daysAgo(120) })));

  const banana = await createRecipe(db, "seed_ada", [{ message: "initial commit", data: bananaBread, at: daysAgo(40) }]);
  const forkCommits = bananaBreadForkCommits();
  // The fork's first commit is the parent's head; we only add the subsequent commits.
  const bbb = await createRecipe(
    db,
    "seed_kernel",
    forkCommits.slice(1).map((c, i) => ({ ...c, at: daysAgo(20 - i * 6) })),
    { forkedFromId: banana.id, forkedFromCommitId: banana.headCommitId, createdAt: daysAgo(21) },
  );
  void bbb;
  await createRecipe(db, "seed_sam", [{ message: "initial commit", data: sourdough, at: daysAgo(60) }]);
  await createRecipe(db, "seed_fork", [{ message: "initial commit", data: choux, at: daysAgo(30) }]);
  await createRecipe(db, "seed_kernel", [{ message: "initial commit", data: chili, at: daysAgo(15) }]);
  await createRecipe(db, "seed_ada", cookieCommits().map((c, i) => ({ ...c, at: daysAgo(12 - i * 4) })));
  await createRecipe(db, "seed_fork", [{ message: "initial commit", data: pancakes, at: daysAgo(9) }]);
  await createRecipe(db, "seed_sam", [{ message: "initial commit", data: vinaigrette, at: daysAgo(4) }]);

  // Social proof: stars, cooks, comments.
  const all = await db.select().from(schema.recipes);
  const by = (slug: string) => all.find((r) => r.slug === slug)!;
  const starPairs: [string, string][] = [
    ["seed_kernel", "banana-nut-bread"], ["seed_sam", "banana-nut-bread"], ["seed_fork", "banana-nut-bread"],
    ["seed_ada", "country-sourdough"], ["seed_kernel", "country-sourdough"], ["seed_fork", "country-sourdough"],
    ["seed_ada", "brown-butter-banana-bread"], ["seed_sam", "chocolate-chip-cookies"], ["seed_kernel", "chocolate-chip-cookies"],
    ["seed_ada", "pate-a-choux"], ["seed_sam", "weeknight-chili"],
  ];
  for (const [u, s] of starPairs) await db.insert(schema.stars).values({ userId: u, recipeId: by(s).id });

  const cookRows: [string, string, string, number, string | null, number][] = [
    ["seed_kernel", "banana-nut-bread", "success", 5, "Reference loaf. Builds clean every time.", 25],
    ["seed_sam", "banana-nut-bread", "success", 4, "Swapped walnuts for pecans, no regressions.", 18],
    ["seed_ada", "country-sourdough", "partial", 3, "Underproofed: bulk ran 3h at 21°C. Needs 5h+ in a cold kitchen.", 33],
    ["seed_ada", "country-sourdough", "success", 5, "Bulk to +60%, great ear.", 26],
    ["seed_kernel", "country-sourdough", "failed", 2, "Levain wasn't at peak → dense. User error.", 10],
    ["seed_ada", "pate-a-choux", "success", 5, "Used 230 g egg. Perfectly hollow.", 8],
    ["seed_sam", "weeknight-chili", "success", 4, null, 6],
    ["seed_kernel", "chocolate-chip-cookies", "success", 5, "The 24h rest is not optional.", 3],
    ["seed_ada", "brown-butter-banana-bread", "success", 5, "Merged into my weekly rotation.", 2],
    ["seed_fork", "sunday-buttermilk-pancakes", "success", 4, null, 1],
  ];
  for (const [u, s, outcome, rating, notes, d] of cookRows) {
    const r = by(s);
    await db.insert(schema.cooks).values({ id: nanoid(10), recipeId: r.id, commitId: r.headCommitId, userId: u, outcome, rating, notes, createdAt: daysAgo(d) });
  }
  // denormalised counters
  for (const r of all) {
    const stars = starPairs.filter(([, s]) => s === r.slug).length;
    const cooks = cookRows.filter(([, s]) => s === r.slug).length;
    const forks = all.filter((x) => x.forkedFromId === r.id).length;
    await db.update(schema.recipes).set({ starsCount: stars, cooksCount: cooks, forksCount: forks }).where(eqId(r.id));
  }

  await db.insert(schema.comments).values([
    { id: nanoid(10), recipeId: by("country-sourdough").id, userId: "seed_kernel", kind: "issue", title: "Bulk time assumes a warm kitchen", body: "At 20°C my bulk took closer to 7h. Could we add a temperature → time table?", status: "open", createdAt: daysAgo(9) },
    { id: nanoid(10), recipeId: by("country-sourdough").id, userId: "seed_sam", kind: "comment", body: "Good call, will add a note. Rule of thumb: every −2°C ≈ +1h bulk.", createdAt: daysAgo(8) },
    { id: nanoid(10), recipeId: by("banana-nut-bread").id, userId: "seed_sam", kind: "comment", body: "Toasting the walnuts is the underrated step here.", createdAt: daysAgo(17) },
    { id: nanoid(10), recipeId: by("pate-a-choux").id, userId: "seed_ada", kind: "issue", title: "Specify fan vs conventional oven", body: "Fan ovens collapse my choux at 200°C. Worth calling out.", status: "closed", createdAt: daysAgo(20) },
  ]);
}
