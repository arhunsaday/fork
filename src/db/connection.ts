import type { Options } from "postgres";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * postgres.js defaults to no TLS, but hosted Postgres (Neon, Supabase, RDS…)
 * rejects unencrypted connections. If the URL sets `sslmode`, respect it;
 * otherwise require TLS for any non-local host, so a connection string pasted
 * without `?sslmode=require` still works.
 */
export function sslFor(url: string): Options<Record<string, never>>["ssl"] | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined; // let postgres.js report the malformed URL
  }
  if (parsed.searchParams.has("sslmode")) return undefined; // postgres.js reads it from the URL
  return LOCAL_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".local") ? false : "require";
}

export function pgOptions(url: string, extra: Options<Record<string, never>> = {}): Options<Record<string, never>> {
  const ssl = sslFor(url);
  return { ...(ssl === undefined ? {} : { ssl }), ...extra };
}
