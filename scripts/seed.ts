/**
 * Seed demo users/recipes into the Postgres at DATABASE_URL (run after `pnpm db:migrate`).
 * Local dev without DATABASE_URL seeds itself automatically (embedded PGlite).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seedIfEmpty } from "../src/db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 1 });
  await seedIfEmpty(drizzle(client, { schema, casing: "snake_case" }));
  await client.end();
  console.log("seeded (skipped if users already existed)");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
