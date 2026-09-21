import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLATFORMS } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = ["draft", "scheduled", "published"] as const;
const EXECUTION = ["direct_publish", "send_to_draft"] as const;

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const postId = Number(id);
    if (!Number.isInteger(postId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) return Response.json({ error: "Title cannot be empty" }, { status: 400 });
      patch.title = title;
    }
    if (typeof body.caption === "string") patch.caption = body.caption.trim();
    if (typeof body.hashtags === "string") patch.hashtags = body.hashtags.trim();
    if (typeof body.videoUrl === "string" || body.videoUrl === null) patch.videoUrl = body.videoUrl;

    if (Array.isArray(body.platforms)) {
      const platforms = body.platforms.filter(
        (p: unknown, i: number, arr: unknown[]) =>
          PLATFORMS.includes(p as never) && arr.indexOf(p) === i
      );
      if (platforms.length === 0) {
        return Response.json({ error: "Select at least one platform" }, { status: 400 });
      }
      patch.platforms = platforms;
    }
    if (EXECUTION.includes(body.executionType)) patch.executionType = body.executionType;
    if (STATUSES.includes(body.status)) patch.status = body.status;
    if (body.scheduledTime !== undefined) {
      if (body.scheduledTime === null) {
        patch.scheduledTime = null;
      } else {
        const d = new Date(body.scheduledTime);
        if (isNaN(d.getTime())) {
          return Response.json({ error: "Invalid scheduledTime" }, { status: 400 });
        }
        patch.scheduledTime = d;
      }
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    const [row] = await db
      .update(scheduledPosts)
      .set(patch)
      .where(eq(scheduledPosts.id, postId))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ post: row });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const [row] = await db
    .delete(scheduledPosts)
    .where(eq(scheduledPosts.id, postId))
    .returning({ id: scheduledPosts.id });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
