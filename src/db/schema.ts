import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { RecipeData } from "@/lib/recipe/schema";

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** Mirrors Clerk users (id = Clerk user id) plus seeded demo users. */
export const users = pgTable("users", {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  displayName: text().notNull(),
  imageUrl: text(),
  bio: text(),
  createdAt: now(),
});

/** A recipe is a "repository": owner/slug, with a head commit. */
export const recipes = pgTable(
  "recipes",
  {
    id: text().primaryKey(),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    category: text().notNull().default("meal"),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    headCommitId: text(),
    forkedFromId: text(),
    forkedFromCommitId: text(),
    license: text().notNull().default("CC-BY-SA-4.0"),
    isPublic: boolean().notNull().default(true),
    starsCount: integer().notNull().default(0),
    forksCount: integer().notNull().default(0),
    cooksCount: integer().notNull().default(0),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    uniqueIndex("recipes_owner_slug").on(t.ownerId, t.slug),
    index("recipes_forked_from").on(t.forkedFromId),
    index("recipes_category").on(t.category),
  ],
);

/** Immutable snapshots. parentId forms the history chain. */
export const commits = pgTable(
  "commits",
  {
    id: text().primaryKey(),
    recipeId: text()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    parentId: text(),
    authorId: text()
      .notNull()
      .references(() => users.id),
    message: text().notNull(),
    data: jsonb().$type<RecipeData>().notNull(),
    createdAt: now(),
  },
  (t) => [index("commits_recipe").on(t.recipeId, t.createdAt)],
);

export const stars = pgTable(
  "stars",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: text()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.recipeId] })],
);

/** "Build logs": someone cooked a specific commit of a recipe. */
export const cooks = pgTable(
  "cooks",
  {
    id: text().primaryKey(),
    recipeId: text()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    commitId: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outcome: text().notNull().default("success"), // success | partial | failed
    rating: integer(),
    notes: text(),
    createdAt: now(),
  },
  (t) => [index("cooks_recipe").on(t.recipeId), index("cooks_user").on(t.userId, t.createdAt)],
);

/** Comments and issues ("too salty", "step 4 unclear"). */
export const comments = pgTable(
  "comments",
  {
    id: text().primaryKey(),
    recipeId: text()
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull().default("comment"), // comment | issue
    title: text(),
    body: text().notNull(),
    status: text().notNull().default("open"), // open | closed
    createdAt: now(),
  },
  (t) => [index("comments_recipe").on(t.recipeId, t.createdAt)],
);

/** What you own: ingredients and equipment. */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull().default("ingredient"), // ingredient | equipment
    name: text().notNull(),
    qty: real(),
    unit: text(),
    createdAt: now(),
  },
  (t) => [index("pantry_user").on(t.userId)],
);

export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    qty: real(),
    unit: text(),
    aisle: text().notNull().default("other"),
    checked: boolean().notNull().default(false),
    recipeId: text(),
    recipeTitle: text(),
    createdAt: now(),
  },
  (t) => [index("shopping_user").on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({ recipes: many(recipes) }));
export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  commits: many(commits),
}));
export const commitsRelations = relations(commits, ({ one }) => ({
  recipe: one(recipes, { fields: [commits.recipeId], references: [recipes.id] }),
  author: one(users, { fields: [commits.authorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Commit = typeof commits.$inferSelect;
