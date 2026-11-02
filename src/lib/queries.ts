import "server-only";
import { cache } from "react";
import { and, desc, eq, ilike, inArray, or, sql, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Commit } from "@/db/schema";

const { recipes, users, commits, stars, cooks, comments } = schema;

export type RecipeCard = Awaited<ReturnType<typeof listRecipes>>[number];

export async function listRecipes(opts: {
  category?: string | null;
  q?: string | null;
  sort?: "trending" | "new" | "stars" | "cooked" | "forks";
  ownerId?: string;
  ids?: string[];
  limit?: number;
} = {}) {
  const db = await getDb();
  const where = [eq(recipes.isPublic, true)];
  if (opts.category) where.push(eq(recipes.category, opts.category));
  if (opts.ownerId) where.push(eq(recipes.ownerId, opts.ownerId));
  if (opts.ids) {
    if (!opts.ids.length) return [];
    where.push(inArray(recipes.id, opts.ids));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    where.push(or(ilike(recipes.title, like), ilike(recipes.description, like), sql`array_to_string(${recipes.tags}, ' ') ilike ${like}`, ilike(users.username, like))!);
  }
  const order =
    opts.sort === "new"
      ? [desc(recipes.createdAt)]
      : opts.sort === "stars"
        ? [desc(recipes.starsCount), desc(recipes.updatedAt)]
        : opts.sort === "cooked"
          ? [desc(recipes.cooksCount), desc(recipes.updatedAt)]
          : opts.sort === "forks"
            ? [desc(recipes.forksCount), desc(recipes.updatedAt)]
            : // trending: weighted engagement decayed by age
              [desc(sql`(${recipes.starsCount} * 2 + ${recipes.cooksCount} * 3 + ${recipes.forksCount} * 4 + 1) / power(extract(epoch from (now() - ${recipes.updatedAt})) / 86400 + 2, 0.8)`)];

  const parent = sql<string | null>`(select u.username || '/' || r2.slug from recipes r2 join users u on u.id = r2.owner_id where r2.id = ${recipes.forkedFromId})`;
  return db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      description: recipes.description,
      category: recipes.category,
      tags: recipes.tags,
      starsCount: recipes.starsCount,
      forksCount: recipes.forksCount,
      cooksCount: recipes.cooksCount,
      updatedAt: recipes.updatedAt,
      createdAt: recipes.createdAt,
      owner: users.username,
      ownerImage: users.imageUrl,
      forkedFrom: parent,
      data: commits.data,
    })
    .from(recipes)
    .innerJoin(users, eq(users.id, recipes.ownerId))
    .leftJoin(commits, eq(commits.id, recipes.headCommitId))
    .where(and(...where))
    .orderBy(...order)
    .limit(opts.limit ?? 48);
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.username, username));
  return u ?? null;
}

export const getRecipe = cache(async function getRecipe(username: string, slug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ recipe: recipes, owner: users, head: commits })
    .from(recipes)
    .innerJoin(users, eq(users.id, recipes.ownerId))
    .leftJoin(commits, eq(commits.id, recipes.headCommitId))
    .where(and(eq(users.username, username), eq(recipes.slug, slug)));
  if (!row || !row.head) return null;
  let upstream: { username: string; slug: string; title: string; headCommitId: string | null } | null = null;
  if (row.recipe.forkedFromId) {
    const [u] = await db
      .select({ username: users.username, slug: recipes.slug, title: recipes.title, headCommitId: recipes.headCommitId })
      .from(recipes)
      .innerJoin(users, eq(users.id, recipes.ownerId))
      .where(eq(recipes.id, row.recipe.forkedFromId));
    upstream = u ?? null;
  }
  return { ...row, head: row.head, upstream };
});

export type FullRecipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>;

function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

export type HistoryEntry = Commit & { authorUsername: string; recipeOwner: string; recipeSlug: string };

/** Walk the parent chain from a commit (crosses fork boundaries, like git). */
export async function getHistory(headCommitId: string, limit = 100): Promise<HistoryEntry[]> {
  const db = await getDb();
  const res = await db.execute(sql`
    with recursive chain as (
      select c.*, 0 as depth from commits c where c.id = ${headCommitId}
      union all
      select p.*, chain.depth + 1 from commits p join chain on p.id = chain.parent_id where chain.depth < ${limit}
    )
    select chain.id, chain.recipe_id as "recipeId", chain.parent_id as "parentId", chain.author_id as "authorId",
           chain.message, chain.data, chain.created_at as "createdAt",
           au.username as "authorUsername", ou.username as "recipeOwner", r.slug as "recipeSlug"
    from chain
    join users au on au.id = chain.author_id
    join recipes r on r.id = chain.recipe_id
    join users ou on ou.id = r.owner_id
    order by chain.depth asc`);
  return rowsOf<HistoryEntry>(res).map((r) => ({
    ...r,
    data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    createdAt: new Date(r.createdAt),
  }));
}

export async function getCommit(id: string) {
  const db = await getDb();
  const [c] = await db
    .select({ commit: commits, author: users.username })
    .from(commits)
    .innerJoin(users, eq(users.id, commits.authorId))
    .where(eq(commits.id, id));
  return c ?? null;
}

export async function getForks(recipeId: string) {
  const db = await getDb();
  return db
      .select({
        id: recipes.id,
        slug: recipes.slug,
        title: recipes.title,
        owner: users.username,
        starsCount: recipes.starsCount,
        cooksCount: recipes.cooksCount,
        forksCount: recipes.forksCount,
        updatedAt: recipes.updatedAt,
        headCommitId: recipes.headCommitId,
        forkedFromCommitId: recipes.forkedFromCommitId,
      })
      .from(recipes)
      .innerJoin(users, eq(users.id, recipes.ownerId))
      .where(eq(recipes.forkedFromId, recipeId))
      .orderBy(desc(recipes.starsCount));
}

export async function getDiscussion(recipeId: string) {
  const db = await getDb();
  return db
    .select({ comment: comments, username: users.username, imageUrl: users.imageUrl })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.recipeId, recipeId))
    .orderBy(comments.createdAt);
}

export async function getCooks(recipeId: string) {
  const db = await getDb();
  return db
    .select({ cook: cooks, username: users.username, imageUrl: users.imageUrl })
    .from(cooks)
    .innerJoin(users, eq(users.id, cooks.userId))
    .where(eq(cooks.recipeId, recipeId))
    .orderBy(desc(cooks.createdAt));
}

export async function hasStarred(userId: string | undefined, recipeId: string) {
  if (!userId) return false;
  const db = await getDb();
  const [s] = await db.select().from(stars).where(and(eq(stars.userId, userId), eq(stars.recipeId, recipeId)));
  return !!s;
}

/** Commits ahead of / behind upstream since the fork point. */
export async function aheadBehind(recipe: { id: string; forkedFromId: string | null; forkedFromCommitId: string | null; headCommitId: string | null }, upstreamHead: string | null) {
  if (!recipe.forkedFromId || !recipe.forkedFromCommitId) return null;
  const mine = recipe.headCommitId ? await getHistory(recipe.headCommitId) : [];
  const theirs = upstreamHead ? await getHistory(upstreamHead) : [];
  const idx = (h: HistoryEntry[]) => {
    const i = h.findIndex((c) => c.id === recipe.forkedFromCommitId);
    return i < 0 ? h.length : i;
  };
  return { ahead: idx(mine), behind: idx(theirs) };
}

/** Activity per day for the contribution heatmap (commits + cooks). */
export async function getActivity(userId: string) {
  const db = await getDb();
  const since = new Date(Date.now() - 365 * 86400000);
  const c = await db.select({ at: commits.createdAt }).from(commits).where(and(eq(commits.authorId, userId), gte(commits.createdAt, since)));
  const k = await db.select({ at: cooks.createdAt }).from(cooks).where(and(eq(cooks.userId, userId), gte(cooks.createdAt, since)));
  const map = new Map<string, { commits: number; cooks: number }>();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  for (const r of c) {
    const e = map.get(key(r.at)) ?? { commits: 0, cooks: 0 };
    e.commits++;
    map.set(key(r.at), e);
  }
  for (const r of k) {
    const e = map.get(key(r.at)) ?? { commits: 0, cooks: 0 };
    e.cooks++;
    map.set(key(r.at), e);
  }
  return map;
}

export async function getStarredIds(userId: string) {
  const db = await getDb();
  const rows = await db.select({ id: stars.recipeId }).from(stars).where(eq(stars.userId, userId)).orderBy(desc(stars.createdAt));
  return rows.map((r) => r.id);
}

export async function getUserCookLog(userId: string, limit = 20) {
  const db = await getDb();
  return db
    .select({ cook: cooks, title: recipes.title, slug: recipes.slug, owner: users.username })
    .from(cooks)
    .innerJoin(recipes, eq(recipes.id, cooks.recipeId))
    .innerJoin(users, eq(users.id, recipes.ownerId))
    .where(eq(cooks.userId, userId))
    .orderBy(desc(cooks.createdAt))
    .limit(limit);
}

/** Global activity feed: recent commits + cooks + forks. */
export async function getFeed(limit = 12) {
  const db = await getDb();
  const res = await db.execute(sql`
    (select 'commit' as kind, c.created_at as at, au.username as actor, ou.username as owner, r.slug, r.title, c.message as detail
       from commits c join recipes r on r.id = c.recipe_id join users au on au.id = c.author_id join users ou on ou.id = r.owner_id
       order by c.created_at desc limit ${limit})
    union all
    (select 'cook', k.created_at, u.username, ou.username, r.slug, r.title, k.outcome
       from cooks k join recipes r on r.id = k.recipe_id join users u on u.id = k.user_id join users ou on ou.id = r.owner_id
       order by k.created_at desc limit ${limit})
    union all
    (select 'fork', r.created_at, u.username, u.username, r.slug, r.title, pu.username || '/' || p.slug
       from recipes r join users u on u.id = r.owner_id join recipes p on p.id = r.forked_from_id join users pu on pu.id = p.owner_id
       order by r.created_at desc limit ${limit})
    order by at desc limit ${limit}`);
  return rowsOf<{ kind: "commit" | "cook" | "fork"; at: string | Date; actor: string; owner: string; slug: string; title: string; detail: string }>(res).map(
    (r) => ({ ...r, at: new Date(r.at) }),
  );
}

export async function getStats() {
  const db = await getDb();
  const res = await db.execute(sql`select
    (select count(*) from recipes)::int as recipes,
    (select count(*) from recipes where forked_from_id is not null)::int as forks,
    (select count(*) from cooks)::int as cooks,
    (select count(*) from users)::int as users`);
  return rowsOf<{ recipes: number; forks: number; cooks: number; users: number }>(res)[0];
}
