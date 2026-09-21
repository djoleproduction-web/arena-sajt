import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Production-ready Drizzle client.
 *
 * - The connection string is read dynamically from `DATABASE_URL` at first
 *   query — never at import time — so Vercel can build the app even before
 *   runtime env vars are attached (Neon, Supabase, RDS… all supported).
 * - SSL is enabled automatically for non-local hosts (Neon/Supabase require
 *   TLS). Override with DATABASE_SSL=require|disable.
 * - The pool is cached across module reloads in dev and capped for
 *   serverless/edge-of-network usage.
 */

type Database = NodePgDatabase<Record<string, never>>;

const globalForDb = globalThis as typeof globalThis & {
  __setlist_pool?: Pool;
  __setlist_db?: Database;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/** TLS for managed Postgres (Neon/Supabase), plain for local dev. */
function sslConfig(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  const override = process.env.DATABASE_SSL?.toLowerCase();
  if (override === "disable" || override === "false") return undefined;
  if (override === "require" || override === "true") return { rejectUnauthorized: false };
  try {
    const { hostname } = new URL(connectionString);
    if (LOCAL_HOSTS.has(hostname)) return undefined;
  } catch {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl: sslConfig(connectionString),
    // serverless-friendly limits; use a pooled provider URL in production
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** Creates (once) and returns the Drizzle instance bound to DATABASE_URL. */
export function getDb(): Database {
  if (!globalForDb.__setlist_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required. Set it to your production Postgres connection string (e.g. Neon or Supabase)."
      );
    }
    globalForDb.__setlist_pool = createPool(databaseUrl);
    globalForDb.__setlist_db = drizzle(globalForDb.__setlist_pool);
  }
  return globalForDb.__setlist_db;
}

/**
 * Lazy proxy: `import { db } from "@/db"` never touches the database or
 * environment until the first actual query — safe for build-time module
 * evaluation on Vercel.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});
