import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/db";

const client = postgres(connectionString, { 
  prepare: false,
  ssl: { rejectUnauthorized: false } 
});

export const db = drizzle(client);
