import { handleFor, PLATFORMS, type Platform } from "@/lib/utils";

/**
 * Real OAuth plumbing for TikTok / Instagram / YouTube.
 *
 * Credentials come from environment variables:
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 *   INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 *
 * Redirect URIs are derived from NEXT_PUBLIC_APP_URL, falling back to the
 * incoming request origin. Register e.g.:
 *   <NEXT_PUBLIC_APP_URL>/api/platforms/tiktok/callback
 * in each developer console.
 */

export const OAUTH_COOKIE = "setlist_oauth";
export const OAUTH_COOKIE_TTL = 60 * 10; // 10 minutes

export interface OAuthIntent {
  platform: Platform;
  artistId: number;
  state: string;
  iat: number;
}

export function isPlatform(p: string): p is Platform {
  return (PLATFORMS as string[]).includes(p);
}

export function appBase(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

export function callbackUri(req: Request, platform: Platform): string {
  return `${appBase(req)}/api/platforms/${platform}/callback`;
}

/* ---------------- state cookie encoding ---------------- */

export function encodeIntent(intent: OAuthIntent): string {
  return Buffer.from(JSON.stringify(intent)).toString("base64url");
}

export function decodeIntent(raw: string | undefined | null): OAuthIntent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      !parsed ||
      !isPlatform(String(parsed.platform)) ||
      !Number.isInteger(parsed.artistId) ||
      typeof parsed.state !== "string" ||
      typeof parsed.iat !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.iat > OAUTH_COOKIE_TTL * 1000) return null; // stale
    return parsed as OAuthIntent;
  } catch {
    return null;
  }
}

/* ---------------- provider clients ---------------- */

interface Provider {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: (args: { redirectUri: string; state: string }) => string;
  exchangeCode: (code: string, redirectUri: string) => Promise<{ accessToken: string }>;
  fetchHandle: (accessToken: string) => Promise<string | null>;
}

async function postForm(url: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data as Record<string, unknown>;
}

const providers: Record<Platform, Provider> = {
  /* ---------------- TikTok ---------------- */
  tiktok: {
    clientId: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    authorizeUrl: ({ redirectUri, state }) =>
      `https://www.tiktok.com/v2/auth/authorize/?` +
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        scope: "user.info.basic,video.upload,video.publish",
        response_type: "code",
        redirect_uri: redirectUri,
        state,
      }),
    exchangeCode: async (code, redirectUri) => {
      const data = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      if (typeof data.access_token !== "string") throw new Error("No access_token in TikTok response");
      return { accessToken: data.access_token };
    },
    fetchHandle: async (accessToken) => {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=username,display_name",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json().catch(() => ({}));
      const username = data?.data?.user?.username;
      return typeof username === "string" && username ? `@${username}` : null;
    },
  },

  /* ---------------- Instagram ---------------- */
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    authorizeUrl: ({ redirectUri, state }) =>
      `https://api.instagram.com/oauth/authorize?` +
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        redirect_uri: redirectUri,
        scope: "user_profile,user_media",
        response_type: "code",
        state,
      }),
    exchangeCode: async (code, redirectUri) => {
      const data = await postForm("https://api.instagram.com/oauth/access_token", {
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      if (typeof data.access_token !== "string") throw new Error("No access_token in Instagram response");
      return { accessToken: data.access_token };
    },
    fetchHandle: async (accessToken) => {
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await res.json().catch(() => ({}));
      const username = data?.username;
      return typeof username === "string" && username ? `@${username}` : null;
    },
  },

  /* ---------------- YouTube ---------------- */
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    authorizeUrl: ({ redirectUri, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope:
          "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        access_type: "offline",
        include_granted_scopes: "true",
        state,
      }),
    exchangeCode: async (code, redirectUri) => {
      const data = await postForm("https://oauth2.googleapis.com/token", {
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      if (typeof data.access_token !== "string") throw new Error("No access_token in Google response");
      return { accessToken: data.access_token };
    },
    fetchHandle: async (accessToken) => {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json().catch(() => ({}));
      const snippet = data?.items?.[0]?.snippet;
      const customUrl: string | undefined = snippet?.customUrl;
      if (customUrl) return customUrl.startsWith("@") ? customUrl : `@${customUrl}`;
      const title: string | undefined = snippet?.title;
      return typeof title === "string" && title ? `@${title.replace(/\s+/g, "")}` : null;
    },
  },
};

export function getProvider(platform: Platform): Provider {
  return providers[platform];
}

/** Fallback handle when a provider doesn't expose one for the account. */
export function fallbackHandle(artistName: string, platform: Platform): string {
  return handleFor(artistName, platform);
}
