import { db } from "@/db";
import { artists } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const artistId = Number(id);
  if (!Number.isInteger(artistId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const [row] = await db
    .update(artists)
    .set({ name })
    .where(eq(artists.id, artistId))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ artist: row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const artistId = Number(id);
  if (!Number.isInteger(artistId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  // FK cascade removes platform_connections and scheduled_posts rows.
  const [row] = await db
    .delete(artists)
    .where(eq(artists.id, artistId))
    .returning({ id: artists.id });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
