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

export async function GET(req: Request, ctx: Ctx) {
  const { platform: raw } = await ctx.params;
  const url = new URL(req.url);
  const fail = (error: string) =>
    Response.redirect(new URL(`/settings?oauth_error=${error}&platform=${raw}`, req.url));

  if (!isPlatform(raw)) return fail("bad_platform");
  const platform = raw;

  const providerError = url.searchParams.get("error") ?? url.searchParams.get("error_type");
  if (providerError) return fail("denied");

  const jar = await cookies();
  const intent = decodeIntent(jar.get(OAUTH_COOKIE)?.value);
  jar.delete(OAUTH_COOKIE);

  const returnedState = url.searchParams.get("state");
  if (!intent || intent.platform !== platform || intent.state !== returnedState) {
    return fail("state_mismatch");
  }

  const code = url.searchParams.get("code") ?? url.searchParams.get("code#_");
  if (!code) return fail("no_code");

  const provider = getProvider(platform);
  if (!provider.clientId || !provider.clientSecret) return fail("missing_env");

  try {
    const redirectUri = callbackUri(req, platform);
    const { accessToken, refreshToken, expiresAt } = await provider.exchangeCode(code, redirectUri);

    const info = await provider.fetchAccountInfo(accessToken).catch(() => ({ handle: null, accountId: undefined }));

    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.id, intent.artistId));
    if (!artist) return fail("invalid_artist");

    const accountHandle = info.handle ?? fallbackHandle(artist.name, platform);

    await db
      .insert(platformConnections)
      .values({
        artistId: intent.artistId,
        platform,
        accountHandle,
        status: "connected",
        accessToken,
        refreshToken: refreshToken ?? null,
        tokenExpiresAt: expiresAt ?? null,
        platformAccountId: info.accountId ?? null,
      })
      .onConflictDoUpdate({
        target: [platformConnections.artistId, platformConnections.platform],
        set: {
          accountHandle,
          status: "connected",
          accessToken,
          refreshToken: refreshToken ?? null,
          tokenExpiresAt: expiresAt ?? null,
          platformAccountId: info.accountId ?? null,
        },
      });

    return Response.redirect(
      new URL(`/settings?connected=${platform}&handle=${encodeURIComponent(accountHandle)}`, req.url)
    );
  } catch (e) {
    console.error(`[oauth:${platform}] exchange failed`, e);
    return fail("exchange_failed");
  }
}
