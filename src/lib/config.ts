/**
 * Runtime feature flags derived from env vars. NEXT_PUBLIC_* values are inlined
 * at build time, so this module is safe to import from client components.
 *
 * Preview mode = the app deployed without Clerk keys and/or without a database:
 * everything is browsable, auth-only features are disabled, and data comes from
 * an in-memory seeded database.
 */
export const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
