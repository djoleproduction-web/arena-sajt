import { db } from "@/db";
import { artists } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(artists).orderBy(asc(artists.id));
  return Response.json({ artists: rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 80) {
      return Response.json({ error: "Name is too long" }, { status: 400 });
    }
    const dup = await db
      .select({ id: artists.id })
      .from(artists)
      .where(eqName(name));
    if (dup.length > 0) {
      return Response.json({ error: "An artist with this name already exists" }, { status: 409 });
    }
    const [row] = await db.insert(artists).values({ name }).returning();
    return Response.json({ artist: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to create artist" }, { status: 500 });
  }
}

import { sql } from "drizzle-orm";
function eqName(name: string) {
  return sql`lower(${artists.name}) = lower(${name})`;
}
