import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const connId = Number(id);
  if (!Number.isInteger(connId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!["connected", "disconnected"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  const [row] = await db
    .update(platformConnections)
    .set({ status })
    .where(eq(platformConnections.id, connId))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ connection: row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const connId = Number(id);
  if (!Number.isInteger(connId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const [row] = await db
    .delete(platformConnections)
    .where(eq(platformConnections.id, connId))
    .returning({ id: platformConnections.id });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
