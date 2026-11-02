import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { slugify } from "@/lib/recipe/schema";

export const RESERVED = new Set([
  "new", "explore", "pantry", "shopping", "sign-in", "sign-up", "api", "settings", "about", "cook",
  "search", "admin", "fork", "_next", "favicon.ico",
]);

/** Current Clerk user mirrored into our DB (created on first sight). Null when signed out. */
export const getViewer = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;
  const db = await getDb();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;
  const base =
    slugify(cu.username ?? cu.firstName ?? cu.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "cook").replace(/-/g, "_") ||
    "cook";
  let username = RESERVED.has(base) ? `${base}_` : base;
  for (let i = 2; ; i++) {
    const [clash] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username));
    if (!clash) break;
    username = `${base}${i}`;
  }
  const displayName = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || cu.username || username;
  const [created] = await db
    .insert(schema.users)
    .values({ id: userId, username, displayName, imageUrl: cu.imageUrl })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(schema.users).where(eq(schema.users.id, userId)))[0];
});

export async function requireViewer() {
  const v = await getViewer();
  if (!v) throw new Error("You need to sign in to do that.");
  return v;
}
