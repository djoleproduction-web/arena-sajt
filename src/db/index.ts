import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Koristimo fallback samo da Next.js ne pukne tokom bildovanja stranica
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/db";

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);
