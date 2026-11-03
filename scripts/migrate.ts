/**
 * Deploy-time database setup, run by `pnpm vercel-build` before `next build`.
 *
 *  - No database URL      → skip (the app runs in preview mode with an in-memory DB).
 *  - Database URL present → apply pending drizzle migrations from ./drizzle.
 *  - SEED_DEMO=true       → also insert the demo users/recipes, only if the DB is empty.
 *
 * Uses the direct (unpooled) connection when available: migrations need a real
 * session, which transaction poolers (Neon "-pooler", Supabase :6543) don't give.
 */
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../src/db/schema";
import { seedIfEmpty } from "../src/db/seed";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] no DATABASE_URL — skipping (preview mode)");
    return;
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[migrate] migrations applied");
    if (process.env.SEED_DEMO === "true") {
      await seedIfEmpty(db);
      console.log("[migrate] demo seed done (skipped if users already existed)");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
