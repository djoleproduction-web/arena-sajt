import { db } from "@/db";
import { scheduledPosts } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await db
    .select()
    .from(scheduledPosts)
    .where(and(eq(scheduledPosts.status, "scheduled"), lte(scheduledPosts.scheduledTime, new Date())));

  const results: Array<{ id: number; ok: boolean }> = [];

  for (const post of due) {
    try {
      await publishPost(post.id);
      results.push({ id: post.id, ok: true });
    } catch (e) {
      console.error(`Failed to publish post ${post.id}`, e);
      results.push({ id: post.id, ok: false });
    }
  }

  return Response.json({ checked: due.length, results });
}
