import { db } from "@/db";
import { platformConnections, scheduledPosts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { Platform } from "@/lib/utils";

interface PublishResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

async function getFreshGoogleToken(conn: typeof platformConnections.$inferSelect): Promise<string> {
  const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt).getTime() : 0;
  const isExpiring = !expiresAt || expiresAt < Date.now() + 60_000;

  if (!isExpiring) return conn.accessToken!;
  if (!conn.refreshToken) return conn.accessToken!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || typeof data.access_token !== "string") {
    throw new Error(`Failed to refresh Google token: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await db
    .update(platformConnections)
    .set({ accessToken: data.access_token, tokenExpiresAt: newExpiresAt })
    .where(eq(platformConnections.id, conn.id));

  return data.access_token;
}

async function publishYouTube(
  accessToken: string,
  videoUrl: string,
  title: string,
  caption: string
): Promise<PublishResult> {
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Could not fetch video from storage");
    const videoBlob = await videoRes.blob();

    const metadata = {
      snippet: { title: title.slice(0, 100), description: caption.slice(0, 5000) },
      status: { privacyStatus: "public" },
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`YouTube init failed: ${errText.slice(0, 300)}`);
    }
    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("No upload URL returned by YouTube");

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: videoBlob,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`YouTube upload failed: ${errText.slice(0, 300)}`);
    }
    const data = await uploadRes.json();
    return { success: true, externalId: data.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown YouTube error" };
  }
}

async function publishInstagram(
  accessToken: string,
  igBusinessId: string,
  videoUrl: string,
  caption: string
): Promise<PublishResult> {
  try {
    const GRAPH = "https://graph.instagram.com";

    const containerRes = await fetch(`${GRAPH}/${igBusinessId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption: caption.slice(0, 2200),
        access_token: accessToken,
      }),
    });
    const containerData = await containerRes.json();
    if (!containerRes.ok) throw new Error(JSON.stringify(containerData).slice(0, 300));
    const creationId = containerData.id;

    let status = "IN_PROGRESS";
    for (let i = 0; i < 30 && status !== "FINISHED"; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const checkRes = await fetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const checkData = await checkRes.json();
      status = checkData.status_code;
      if (status === "ERROR") throw new Error("Instagram failed to process the video");
    }
    if (status !== "FINISHED") throw new Error("Instagram processing timed out");

    const publishRes = await fetch(`${GRAPH}/${igBusinessId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok) throw new Error(JSON.stringify(publishData).slice(0, 300));

    return { success: true, externalId: publishData.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown Instagram error" };
  }
}

async function publishTikTok(
  accessToken: string,
  videoUrl: string,
  title: string,
  caption: string
): Promise<PublishResult> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
        post_info: { title: `${title} ${caption}`.trim().slice(0, 150) },
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error?.code !== "ok") {
      throw new Error(JSON.stringify(data).slice(0, 300));
    }
    return { success: true, externalId: data.data?.publish_id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown TikTok error" };
  }
}

export async function publishPost(postId: number): Promise<{ results: Record<string, PublishResult> }> {
  const [post] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, postId));
  if (!post || !post.videoUrl) {
    return { results: { error: { success: false, error: "Post or video not found" } } };
  }

  const results: Record<string, PublishResult> = {};

  for (const platform of post.platforms as Platform[]) {
    const [conn] = await db
      .select()
      .from(platformConnections)
      .where(
        and(eq(platformConnections.artistId, post.artistId), eq(platformConnections.platform, platform))
      );

    if (!conn || !conn.accessToken) {
      results[platform] = { success: false, error: "No connected account with a saved token" };
      continue;
    }

    if (platform === "youtube") {
      try {
        const freshToken = await getFreshGoogleToken(conn);
        results[platform] = await publishYouTube(freshToken, post.videoUrl, post.title, post.caption);
      } catch (e) {
        results[platform] = { success: false, error: e instanceof Error ? e.message : "Token refresh failed" };
      }
    } else if (platform === "instagram") {
      if (!conn.platformAccountId) {
        results[platform] = { success: false, error: "Missing Instagram business account id — reconnect the account" };
      } else {
        results[platform] = await publishInstagram(conn.accessToken, conn.platformAccountId, post.videoUrl, post.caption);
      }
    } else if (platform === "tiktok") {
      results[platform] = await publishTikTok(conn.accessToken, post.videoUrl, post.title, post.caption);
    } else {
      results[platform] = { success: false, error: `${platform} publishing not implemented yet` };
    }
  }

  const allOk = Object.values(results).every((r) => r.success);
  await db
    .update(scheduledPosts)
    .set({ status: allOk ? "published" : "draft" })
    .where(eq(scheduledPosts.id, postId));

  return { results };
}
