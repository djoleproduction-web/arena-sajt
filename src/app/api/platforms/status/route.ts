import { PLATFORM_META, type Platform } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Reports which platforms have OAuth credentials configured via environment
 * variables — never leaks the secrets themselves.
 */
export async function GET() {
  const ready: Record<Platform, boolean> = {
    tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
    instagram: Boolean(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
    youtube: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET),
  };

  return Response.json({
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    platforms: (Object.keys(ready) as Platform[]).map((p) => ({
      platform: p,
      label: PLATFORM_META[p].label,
      ready: ready[p],
    })),
  });
}
