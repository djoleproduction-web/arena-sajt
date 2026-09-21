import { db } from "@/db";
import { artists, platformConnections } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { handleFor, PLATFORMS, type Platform } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const artistId = searchParams.get("artistId");

  const rows = artistId
    ? await db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.artistId, Number(artistId)))
        .orderBy(asc(platformConnections.id))
    : await db.select().from(platformConnections).orderBy(asc(platformConnections.id));

  return Response.json({ connections: rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const artistId = Number(body.artistId);
    const platform = String(body.platform || "");
    const status = body.status === "disconnected" ? "disconnected" : "connected";

    if (!Number.isInteger(artistId)) {
      return Response.json({ error: "artistId is required" }, { status: 400 });
    }
    if (!PLATFORMS.includes(platform as Platform)) {
      return Response.json({ error: "Invalid platform" }, { status: 400 });
    }

    // FK safety: verify the artist exists before writing (also enforced by constraint).
    const [artist] = await db.select().from(artists).where(eq(artists.id, artistId));
    if (!artist) {
      return Response.json({ error: "Artist not found" }, { status: 404 });
    }

    const accountHandle =
      typeof body.accountHandle === "string" && body.accountHandle.trim().startsWith("@")
        ? body.accountHandle.trim()
        : handleFor(artist.name, platform as Platform);

    const [row] = await db
      .insert(platformConnections)
      .values({ artistId, platform, accountHandle, status })
      .onConflictDoUpdate({
        target: [platformConnections.artistId, platformConnections.platform],
        set: { accountHandle, status },
      })
      .returning();

    return Response.json({ connection: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to save connection" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const artistId = Number(searchParams.get("artistId"));
  const platform = String(searchParams.get("platform") || "");
  if (!Number.isInteger(artistId) || !platform) {
    return Response.json({ error: "artistId and platform are required" }, { status: 400 });
  }
  await db
    .delete(platformConnections)
    .where(
      and(
        eq(platformConnections.artistId, artistId),
        eq(platformConnections.platform, platform)
      )
    );
  return Response.json({ ok: true });
}
