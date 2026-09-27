import { handleFor, PLATFORMS, type Platform } from "@/lib/utils";

export const OAUTH_COOKIE = "setlist_oauth";
export const OAUTH_COOKIE_TTL = 60 * 10;

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
    if (Date.now() - parsed.iat > OAUTH_COOKIE_TTL * 1000) return null;
    return parsed as OAuthIntent;
  } catch {
    return null;
  }
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface Provider {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: (args: { redirectUri: string; state: string }) => string;
  exchangeCode: (code: string, redirectUri: string) => Promise<TokenResult>;
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
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data as Record<string, unknown>;
}

const providers: Record<Platform, Provider> = {
  tiktok: {
    clientId: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    authorizeUrl: ({ redirectUri, state }) =>
      `https://www.tiktok.com/v2/auth/authorize/?` +
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        scope: "user.info.basic,video.upload",
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
      const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      };
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

  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    authorizeUrl: ({ redirectUri, state }) =>
      `https://www.instagram.com/oauth/authorize?` +
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        redirect_uri: redirectUri,
        scope: "instagram_business_basic,instagram_business_content_publish",
        response_type: "code",
        state,
      }),
    exchangeCode: async (code, redirectUri) => {
      // Step 1: short-lived token
      const shortLived = await postForm("https://api.instagram.com/oauth/access_token", {
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      if (typeof shortLived.access_token !== "string") {
        throw new Error("No access_token in Instagram response");
      }

      // Step 2: exchange for a long-lived token (valid 60 days)
      const longLivedUrl =
        `https://graph.instagram.com/access_token?` +
        new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
          access_token: shortLived.access_token,
        });
      const longLivedRes = await fetch(longLivedUrl);
      const longLived = await longLivedRes.json().catch(() => ({}));

      if (typeof longLived.access_token === "string") {
        const expiresIn = typeof longLived.expires_in === "number" ? longLived.expires_in : 60 * 24 * 3600;
        return { accessToken: longLived.access_token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
      }
      // Fallback: short-lived only (still works, just expires sooner)
      return { accessToken: shortLived.access_token };
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
        prompt: "consent",
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
      const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      };
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

export function fallbackHandle(artistName: string, platform: Platform): string {
  return handleFor(artistName, platform);
}
