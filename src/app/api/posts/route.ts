import { db } from "@/db";
import { artists, scheduledPosts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { PLATFORMS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "scheduled", "published"] as const;
const EXECUTION = ["direct_publish", "send_to_draft"] as const;

function cleanPlatforms(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const p of input) {
    if (PLATFORMS.includes(p as never) && !seen.has(p)) seen.add(p);
  }
  return [...seen];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artistId");

  const rows = artistId
    ? await db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.artistId, Number(artistId)))
        .orderBy(asc(scheduledPosts.scheduledTime), asc(scheduledPosts.id))
    : await db
        .select()
        .from(scheduledPosts)
        .orderBy(asc(scheduledPosts.scheduledTime), asc(scheduledPosts.id));

  return Response.json({ posts: rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const artistId = Number(body.artistId);
    if (!Number.isInteger(artistId)) {
      return Response.json({ error: "artistId is required" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > 140) {
      return Response.json({ error: "Title is too long (max 140)" }, { status: 400 });
    }

    const platforms = cleanPlatforms(body.platforms);
    if (platforms.length === 0) {
      return Response.json({ error: "Select at least one platform" }, { status: 400 });
    }

    const executionType = EXECUTION.includes(body.executionType)
      ? body.executionType
      : "direct_publish";

    let scheduledTime: Date | null = null;
    if (body.scheduledTime) {
      const d = new Date(body.scheduledTime);
      if (isNaN(d.getTime())) {
        return Response.json({ error: "Invalid scheduledTime" }, { status: 400 });
      }
      scheduledTime = d;
    }

    const status =
      STATUSES.includes(body.status) ? body.status : scheduledTime ? "scheduled" : "draft";
    if (status === "scheduled" && !scheduledTime) {
      return Response.json({ error: "scheduled status requires a time" }, { status: 400 });
    }

    // FK safety: verify the artist exists before inserting the post.
    const [artist] = await db.select().from(artists).where(eq(artists.id, artistId));
    if (!artist) {
      return Response.json({ error: "Artist not found" }, { status: 404 });
    }

    const [row] = await db
      .insert(scheduledPosts)
      .values({
        artistId,
        title,
        caption: typeof body.caption === "string" ? body.caption.trim() : "",
        hashtags: typeof body.hashtags === "string" ? body.hashtags.trim() : "",
        platforms,
        status,
        executionType,
        scheduledTime,
        videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : null,
      })
      .returning();

    return Response.json({ post: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to create post" }, { status: 500 });
  }
}
