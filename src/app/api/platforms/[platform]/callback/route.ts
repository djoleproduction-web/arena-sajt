import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { artists, platformConnections } from "@/db/schema";
import {
  callbackUri,
  decodeIntent,
  fallbackHandle,
  getProvider,
  isPlatform,
  OAUTH_COOKIE,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

/**
 * GET /api/platforms/{platform}/callback?code=...&state=...
 *
 * Real OAuth completion: verifies the state cookie, exchanges the code for an
 * access token (server-side, secrets never leave the server), fetches the
 * account handle, and upserts the row into `platform_connections` scoped to
 * the artist that started the flow.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { platform: raw } = await ctx.params;
  const url = new URL(req.url);
  const fail = (error: string) =>
    Response.redirect(new URL(`/settings?oauth_error=${error}&platform=${raw}`, req.url));

  if (!isPlatform(raw)) return fail("bad_platform");
  const platform = raw;

  // provider-side denial / error
  const providerError = url.searchParams.get("error") ?? url.searchParams.get("error_type");
  if (providerError) return fail("denied");

  // verify state against the cookie set during authorize
  const jar = await cookies();
  const intent = decodeIntent(jar.get(OAUTH_COOKIE)?.value);
  jar.delete(OAUTH_COOKIE);

  const returnedState = url.searchParams.get("state");
  if (!intent || intent.platform !== platform || intent.state !== returnedState) {
    return fail("state_mismatch");
  }

  const code = url.searchParams.get("code") ?? url.searchParams.get("code#_"); // IG appends #_ on some clients
  if (!code) return fail("no_code");

  const provider = getProvider(platform);
  if (!provider.clientId || !provider.clientSecret) return fail("missing_env");

  try {
    // 1. exchange the authorization code for an access token
    const redirectUri = callbackUri(req, platform);
    const { accessToken } = await provider.exchangeCode(code, redirectUri);

    // 2. read the account handle from the platform profile API
    const liveHandle = await provider.fetchHandle(accessToken).catch(() => null);

    // 3. FK safety: the artist must still exist before we link anything
    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.id, intent.artistId));
    if (!artist) return fail("invalid_artist");

    const accountHandle = liveHandle ?? fallbackHandle(artist.name, platform);

    // 4. upsert scoped to (artist_id, platform)
    await db
      .insert(platformConnections)
      .values({
        artistId: intent.artistId,
        platform,
        accountHandle,
        status: "connected",
      })
      .onConflictDoUpdate({
        target: [platformConnections.artistId, platformConnections.platform],
        set: { accountHandle, status: "connected" },
      });

    return Response.redirect(
      new URL(`/settings?connected=${platform}&handle=${encodeURIComponent(accountHandle)}`, req.url)
    );
  } catch (e) {
    console.error(`[oauth:${platform}] exchange failed`, e);
    return fail("exchange_failed");
  }
}
