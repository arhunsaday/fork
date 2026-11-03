import "server-only";
import * as schema from "./schema";

/**
 * Database client.
 *  - DATABASE_URL set → postgres-js against any Postgres (Supabase, Neon, RDS…)
 *  - otherwise       → embedded PGlite (zero-config), migrated + seeded on first use:
 *                       · local dev: persisted in ./.data
 *                       · serverless (Vercel) / read-only FS: in memory — a preview
 *                         demo that resets on every cold start.
 */

type DB = import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __forkDb?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    // prepare:false keeps it compatible with transaction poolers (Supabase :6543, PgBouncer).
    const { pgOptions } = await import("./connection");
    const client = postgres(url, pgOptions(url, { prepare: false, max: 5 }));
    return drizzle(client, { schema, casing: "snake_case" });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const path = await import("node:path");
  const fs = await import("node:fs");
  let dataDir: string | undefined;
  if (!process.env.VERCEL) {
    try {
      dataDir = path.join(process.cwd(), ".data", "pglite");
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      dataDir = undefined; // read-only filesystem → fall back to memory
    }
  }
  if (!dataDir) console.warn("[db] DATABASE_URL not set — using an in-memory preview database (data resets on cold start).");
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db as unknown as DB);
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__forkDb) {
    g.__forkDb = create().catch((e) => {
      g.__forkDb = undefined; // don't cache a failed init
      throw e;
    });
  }
  return g.__forkDb;
}

export { schema };
