import "server-only";
import * as schema from "./schema";

/**
 * Database client.
 *  - DATABASE_URL set → postgres-js against any Postgres (Supabase, Neon, RDS…)
 *  - otherwise       → embedded PGlite in ./.data (zero-config local dev),
 *                       migrated + seeded automatically on first use.
 */

type DB = import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __forkDb?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    // prepare:false keeps it compatible with transaction poolers (Supabase :6543, PgBouncer).
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzle(client, { schema, casing: "snake_case" });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const path = await import("node:path");
  const fs = await import("node:fs");
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
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
