import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { artists } from "@/db/schema";
import {
  callbackUri,
  encodeIntent,
  getProvider,
  isPlatform,
  OAUTH_COOKIE,
  OAUTH_COOKIE_TTL,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

/**
 * GET /api/platforms/{platform}/authorize?artistId=N
 *
 * Redirects the browser to the platform's official authorization URL for the
 * given artist. The (artistId, state) pair rides in a short-lived httpOnly
 * cookie so the callback can bind the account to the right artist safely.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { platform: raw } = await ctx.params;
  const url = new URL(req.url);
  const fail = (error: string) =>
    Response.redirect(new URL(`/settings?oauth_error=${error}&platform=${raw}`, req.url));

  if (!isPlatform(raw)) return fail("bad_platform");
  const platform = raw;

  const artistId = Number(url.searchParams.get("artistId"));
  if (!Number.isInteger(artistId)) return fail("invalid_artist");

  // FK safety: only build an OAuth flow for an artist that actually exists.
  const [artist] = await db.select({ id: artists.id }).from(artists).where(eq(artists.id, artistId));
  if (!artist) return fail("invalid_artist");

  const provider = getProvider(platform);
  if (!provider.clientId || !provider.clientSecret) return fail("missing_env");

  const intent = {
    platform,
    artistId,
    state: crypto.randomUUID(),
    iat: Date.now(),
  };

  const jar = await cookies();
  jar.set(OAUTH_COOKIE, encodeIntent(intent), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_COOKIE_TTL,
    path: "/",
  });

  const redirectUri = callbackUri(req, platform);
  return Response.redirect(provider.authorizeUrl({ redirectUri, state: intent.state }), 302);
}
