import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * The connection string is read from DATABASE_URL (works for local dev,
 * Neon, Supabase, RDS…). The localhost fallback is only a convenience for
 * first-run local development — production always injects its own
 * DATABASE_URL, e.g.:
 *
 *   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" npx drizzle-kit push
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
