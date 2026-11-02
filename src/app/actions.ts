"use server";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewer } from "@/lib/auth";
import { recipeDataSchema, slugify, type RecipeData } from "@/lib/recipe/schema";
import { aisleFor } from "@/lib/aisles";
import { toGrams, normalizeUnit, unitKind, toMl } from "@/lib/recipe/units";

const { recipes, commits, stars, cooks, comments, pantryItems, shoppingItems, users } = schema;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function uniqueSlug(ownerId: string, title: string, exceptId?: string) {
  const db = await getDb();
  const base = slugify(title);
  let slug = base;
  for (let i = 2; ; i++) {
    const [clash] = await db.select({ id: recipes.id }).from(recipes).where(and(eq(recipes.ownerId, ownerId), eq(recipes.slug, slug)));
    if (!clash || clash.id === exceptId) return slug;
    slug = `${base}-${i}`;
  }
}

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

export async function createRecipeAction(input: RecipeData, message?: string): Promise<Result<{ path: string }>> {
  try {
    const viewer = await requireViewer();
    const data = recipeDataSchema.parse(input);
    const db = await getDb();
    const id = nanoid(10);
    const slug = await uniqueSlug(viewer.id, data.title);
    const commitId = nanoid(12);
    await db.insert(recipes).values({
      id, ownerId: viewer.id, slug, title: data.title, description: data.description, category: data.category, tags: data.tags,
    });
    await db.insert(commits).values({ id: commitId, recipeId: id, parentId: null, authorId: viewer.id, message: message?.trim() || "initial commit", data });
    await db.update(recipes).set({ headCommitId: commitId }).where(eq(recipes.id, id));
    revalidatePath("/");
    return { ok: true, path: `/${viewer.username}/${slug}` };
  } catch (e) {
    return fail(e);
  }
}

export async function commitRecipeAction(recipeId: string, input: RecipeData, message: string): Promise<Result<{ path: string }>> {
  try {
    const viewer = await requireViewer();
    const data = recipeDataSchema.parse(input);
    const db = await getDb();
    const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!r) throw new Error("Recipe not found");
    if (r.ownerId !== viewer.id) throw new Error("Only the owner can commit. Fork it instead!");
    const commitId = nanoid(12);
    const slug = r.title !== data.title ? await uniqueSlug(viewer.id, data.title, r.id) : r.slug;
    await db.insert(commits).values({
      id: commitId, recipeId, parentId: r.headCommitId, authorId: viewer.id, message: message.trim() || "update recipe", data,
    });
    await db
      .update(recipes)
      .set({ headCommitId: commitId, title: data.title, slug, description: data.description, category: data.category, tags: data.tags, updatedAt: new Date() })
      .where(eq(recipes.id, recipeId));
    revalidatePath(`/${viewer.username}/${slug}`);
    return { ok: true, path: `/${viewer.username}/${slug}` };
  } catch (e) {
    return fail(e);
  }
}

/** Fork = new recipe whose head points at the upstream head commit (shared history, like git). */
export async function forkRecipeAction(recipeId: string, opts?: { data?: RecipeData; message?: string }): Promise<Result<{ path: string }>> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!r || !r.headCommitId) throw new Error("Recipe not found");
    if (r.ownerId === viewer.id && !opts?.data) throw new Error("You can't fork your own recipe — just commit to it.");
    const [head] = await db.select().from(commits).where(eq(commits.id, r.headCommitId));
    const title = opts?.data?.title ?? r.title;
    const slug = await uniqueSlug(viewer.id, title);
    const id = nanoid(10);
    await db.insert(recipes).values({
      id, ownerId: viewer.id, slug, title, description: opts?.data?.description ?? r.description, category: opts?.data?.category ?? r.category,
      tags: opts?.data?.tags ?? r.tags, forkedFromId: r.id, forkedFromCommitId: r.headCommitId, headCommitId: r.headCommitId, license: r.license,
    });
    if (opts?.data) {
      // Fork with changes (e.g. accepted AI suggestion): add a commit on top.
      const cid = nanoid(12);
      await db.insert(commits).values({
        id: cid, recipeId: id, parentId: head.id, authorId: viewer.id, message: opts.message?.trim() || "fork with changes", data: recipeDataSchema.parse(opts.data),
      });
      await db.update(recipes).set({ headCommitId: cid }).where(eq(recipes.id, id));
    }
    await db.update(recipes).set({ forksCount: sql`${recipes.forksCount} + 1` }).where(eq(recipes.id, r.id));
    revalidatePath("/");
    return { ok: true, path: `/${viewer.username}/${slug}` };
  } catch (e) {
    return fail(e);
  }
}

/** Merge upstream: fast-forward-ish — take upstream head data as a new commit on the fork. */
export async function syncUpstreamAction(recipeId: string): Promise<Result<{ path: string }>> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!r?.forkedFromId || r.ownerId !== viewer.id) throw new Error("Not your fork");
    const [up] = await db.select().from(recipes).where(eq(recipes.id, r.forkedFromId));
    if (!up?.headCommitId) throw new Error("Upstream not found");
    const [upHead] = await db.select().from(commits).where(eq(commits.id, up.headCommitId));
    const cid = nanoid(12);
    await db.insert(commits).values({ id: cid, recipeId, parentId: r.headCommitId, authorId: viewer.id, message: `merge upstream (${up.slug}@${upHead.id.slice(0, 7)})`, data: upHead.data });
    await db.update(recipes).set({ headCommitId: cid, forkedFromCommitId: up.headCommitId, updatedAt: new Date() }).where(eq(recipes.id, recipeId));
    revalidatePath(`/${viewer.username}/${r.slug}`);
    return { ok: true, path: `/${viewer.username}/${r.slug}` };
  } catch (e) {
    return fail(e);
  }
}

export async function revertToCommitAction(recipeId: string, commitId: string): Promise<Result<{ path: string }>> {
  try {
    const db = await getDb();
    const [c] = await db.select().from(commits).where(eq(commits.id, commitId));
    if (!c) throw new Error("Commit not found");
    return commitRecipeAction(recipeId, c.data, `revert to ${commitId.slice(0, 7)}`);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecipeAction(recipeId: string): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const [r] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!r || r.ownerId !== viewer.id) throw new Error("Not allowed");
    // Keep commits reachable for forks: only delete if no forks reference it.
    const [fork] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.forkedFromId, recipeId));
    if (fork) throw new Error("This recipe has forks — it can't be deleted (their history depends on it).");
    await db.delete(recipes).where(eq(recipes.id, recipeId));
    if (r.forkedFromId) await db.update(recipes).set({ forksCount: sql`greatest(${recipes.forksCount} - 1, 0)` }).where(eq(recipes.id, r.forkedFromId));
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleStarAction(recipeId: string): Promise<Result<{ starred: boolean; count: number }>> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const where = and(eq(stars.userId, viewer.id), eq(stars.recipeId, recipeId));
    const [existing] = await db.select().from(stars).where(where);
    if (existing) {
      await db.delete(stars).where(where);
      await db.update(recipes).set({ starsCount: sql`greatest(${recipes.starsCount} - 1, 0)` }).where(eq(recipes.id, recipeId));
    } else {
      await db.insert(stars).values({ userId: viewer.id, recipeId });
      await db.update(recipes).set({ starsCount: sql`${recipes.starsCount} + 1` }).where(eq(recipes.id, recipeId));
    }
    const [r] = await db.select({ c: recipes.starsCount }).from(recipes).where(eq(recipes.id, recipeId));
    return { ok: true, starred: !existing, count: r?.c ?? 0 };
  } catch (e) {
    return fail(e);
  }
}

const cookSchema = z.object({
  recipeId: z.string(),
  commitId: z.string().nullable(),
  outcome: z.enum(["success", "partial", "failed"]),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(2000).nullable(),
});

export async function logCookAction(input: z.infer<typeof cookSchema>): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const data = cookSchema.parse(input);
    const db = await getDb();
    await db.insert(cooks).values({ id: nanoid(10), userId: viewer.id, ...data });
    await db.update(recipes).set({ cooksCount: sql`${recipes.cooksCount} + 1` }).where(eq(recipes.id, data.recipeId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addCommentAction(input: { recipeId: string; body: string; kind: "comment" | "issue"; title?: string }): Promise<Result> {
  try {
    const viewer = await requireViewer();
    if (!input.body.trim()) throw new Error("Write something first");
    const db = await getDb();
    await db.insert(comments).values({
      id: nanoid(10), recipeId: input.recipeId, userId: viewer.id, kind: input.kind, title: input.title?.trim() || null, body: input.body.trim(),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleIssueAction(commentId: string): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const [c] = await db.select({ c: comments, owner: recipes.ownerId }).from(comments).innerJoin(recipes, eq(recipes.id, comments.recipeId)).where(eq(comments.id, commentId));
    if (!c) throw new Error("Not found");
    if (c.owner !== viewer.id && c.c.userId !== viewer.id) throw new Error("Only the recipe owner or the author can close issues");
    await db.update(comments).set({ status: c.c.status === "open" ? "closed" : "open" }).where(eq(comments.id, commentId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateProfileAction(input: { bio: string; displayName: string }): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    await db.update(users).set({ bio: input.bio.slice(0, 280), displayName: input.displayName.slice(0, 60) || viewer.displayName }).where(eq(users.id, viewer.id));
    revalidatePath(`/${viewer.username}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────────── Pantry ───────────────────────────── */

export async function addPantryItemsAction(items: { name: string; kind: "ingredient" | "equipment"; qty?: number | null; unit?: string | null }[]): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const clean = items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name);
    if (!clean.length) return { ok: true };
    await db.insert(pantryItems).values(
      clean.map((i) => ({ id: nanoid(10), userId: viewer.id, kind: i.kind, name: i.name, qty: i.qty ?? null, unit: normalizeUnit(i.unit) })),
    );
    revalidatePath("/pantry");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removePantryItemAction(id: string): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    await db.delete(pantryItems).where(and(eq(pantryItems.id, id), eq(pantryItems.userId, viewer.id)));
    revalidatePath("/pantry");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────────────────────── Shopping ───────────────────────────── */

type ShopInput = { name: string; qty: number | null; unit: string | null; recipeId?: string | null; recipeTitle?: string | null };

/** Adds items, merging with unchecked rows of the same ingredient when units are compatible. */
export async function addToShoppingAction(items: ShopInput[]): Promise<Result<{ added: number; merged: number }>> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const existing = await db.select().from(shoppingItems).where(and(eq(shoppingItems.userId, viewer.id), eq(shoppingItems.checked, false)));
    let added = 0;
    let merged = 0;
    const key = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, " ").trim().replace(/s$/, "");
    for (const it of items) {
      const unit = normalizeUnit(it.unit);
      const match = existing.find((e) => key(e.name) === key(it.name));
      if (match && it.qty != null && match.qty != null) {
        let sum: { qty: number; unit: string | null } | null = null;
        if (normalizeUnit(match.unit) === unit) sum = { qty: match.qty + it.qty, unit };
        else if (unitKind(match.unit) === "mass" || unitKind(unit) === "mass") {
          const a = toGrams(match.qty, match.unit, match.name);
          const b = toGrams(it.qty, unit, it.name);
          if (a != null && b != null) sum = { qty: a + b, unit: "g" };
        } else if (unitKind(match.unit) === "volume" && unitKind(unit) === "volume") {
          const a = toMl(match.qty, match.unit);
          const b = toMl(it.qty, unit);
          if (a != null && b != null) sum = { qty: a + b, unit: "ml" };
        }
        if (sum) {
          const recipeTitle = [match.recipeTitle, it.recipeTitle].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
          await db.update(shoppingItems).set({ qty: sum.qty, unit: sum.unit, recipeTitle }).where(eq(shoppingItems.id, match.id));
          match.qty = sum.qty;
          match.unit = sum.unit;
          merged++;
          continue;
        }
      }
      const row = {
        id: nanoid(10), userId: viewer.id, name: it.name, qty: it.qty, unit, aisle: aisleFor(it.name), recipeId: it.recipeId ?? null, recipeTitle: it.recipeTitle ?? null,
        checked: false, createdAt: new Date(),
      };
      await db.insert(shoppingItems).values(row);
      existing.push(row);
      added++;
    }
    revalidatePath("/shopping");
    return { ok: true, added, merged };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleShoppingItemAction(id: string, checked: boolean): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    await db.update(shoppingItems).set({ checked }).where(and(eq(shoppingItems.id, id), eq(shoppingItems.userId, viewer.id)));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeShoppingItemAction(id: string): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    await db.delete(shoppingItems).where(and(eq(shoppingItems.id, id), eq(shoppingItems.userId, viewer.id)));
    revalidatePath("/shopping");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearShoppingAction(onlyChecked: boolean): Promise<Result> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    await db
      .delete(shoppingItems)
      .where(onlyChecked ? and(eq(shoppingItems.userId, viewer.id), eq(shoppingItems.checked, true)) : eq(shoppingItems.userId, viewer.id));
    revalidatePath("/shopping");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Move checked shopping items into the pantry ("git push to pantry"). */
export async function checkedToPantryAction(): Promise<Result<{ moved: number }>> {
  try {
    const viewer = await requireViewer();
    const db = await getDb();
    const rows = await db.select().from(shoppingItems).where(and(eq(shoppingItems.userId, viewer.id), eq(shoppingItems.checked, true)));
    if (rows.length) {
      await db.insert(pantryItems).values(rows.map((r) => ({ id: nanoid(10), userId: viewer.id, kind: "ingredient", name: r.name, qty: r.qty, unit: r.unit })));
      await db.delete(shoppingItems).where(and(eq(shoppingItems.userId, viewer.id), eq(shoppingItems.checked, true)));
    }
    revalidatePath("/shopping");
    revalidatePath("/pantry");
    return { ok: true, moved: rows.length };
  } catch (e) {
    return fail(e);
  }
}
