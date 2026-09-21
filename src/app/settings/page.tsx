"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Database,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/context/app-context";
import { PlatformIcon } from "@/components/platform-icons";
import { ArtistAvatar, PageHeader } from "@/components/ui";
import { cn, PLATFORMS, PLATFORM_META, type Platform } from "@/lib/utils";

const BLURBS: Record<Platform, string> = {
  tiktok: "Short-form vertical video via TikTok Content Posting API (Login Kit v2).",
  instagram: "Reels reach engine via the Instagram Basic Display OAuth flow.",
  youtube: "YouTube Shorts via Google OAuth + YouTube Data API v3 upload scope.",
};

const OAUTH_ERRORS: Record<string, string> = {
  missing_env: "OAuth credentials are not configured — add the platform keys to .env",
  state_mismatch: "Security check failed (state mismatch) — try connecting again",
  no_code: "The platform didn't return an authorization code",
  denied: "Authorization was denied on the platform side",
  invalid_artist: "That artist no longer exists — connection aborted",
  exchange_failed: "Token exchange failed — check client secret and redirect URI",
  bad_platform: "Unknown platform",
};

interface PlatformStatus {
  platform: Platform;
  label: string;
  ready: boolean;
}

function SettingsContent() {
  const {
    ready,
    artists,
    activeArtist,
    activeArtistId,
    setActiveArtist,
    connectionFor,
    connections: allConnections,
    disconnect,
    refresh,
    toast,
  } = useApp();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [dropOpen, setDropOpen] = useState(false);
  const [envStatus, setEnvStatus] = useState<PlatformStatus[]>([]);
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);

  // When the OAuth flow completes in the other tab and the user returns,
  // pull the fresh connection rows so badges update automatically.
  useEffect(() => {
    let last = 0;
    const onFocus = () => {
      if (Date.now() - last < 1500) return;
      last = Date.now();
      setPendingPlatform(null);
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // fetch which platforms have OAuth credentials configured (server-reported)
  useEffect(() => {
    fetch("/api/platforms/status")
      .then((r) => r.json())
      .then((d) => setEnvStatus(d.platforms ?? []))
      .catch(() => {});
  }, []);

  // surface OAuth redirect outcomes, then clean the URL
  useEffect(() => {
    const connected = searchParams.get("connected");
    const handle = searchParams.get("handle");
    const errCode = searchParams.get("oauth_error");
    const platform = searchParams.get("platform") as Platform | null;
    if (connected) {
      const label = PLATFORM_META[connected as Platform]?.label ?? connected;
      toast(`${label} connected${handle ? ` — ${handle}` : ""}`);
      router.replace("/settings");
    } else if (errCode) {
      const base = OAUTH_ERRORS[errCode] ?? `Connection failed (${errCode})`;
      toast(platform ? `${PLATFORM_META[platform]?.label ?? platform}: ${base}` : base, "err");
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /**
   * Real OAuth: the authorize route → official consent screen.
   * Platforms (TikTok/Google/Meta) refuse to load inside iframes via
   * X-Frame-Options, so the link MUST open in a new browser tab.
   */
  const authorizeHref = (platform: Platform) =>
    `/api/platforms/${platform}/authorize?artistId=${activeArtistId ?? ""}`;

  const beginOAuth = (platform: Platform) => {
    if (!activeArtistId) return;
    // The anchor (target="_blank") performs the actual tab navigation;
    // this handler just arms the "waiting" state on this window.
    setPendingPlatform(platform);
    toast(`Opening ${PLATFORM_META[platform].label} in a new tab — finish the secure login there`);
  };

  const envReady = (p: Platform) => envStatus.find((s) => s.platform === p)?.ready ?? null;

  if (!ready) {
    return (
      <div className="animate-pulse">
        <div className="mb-8 h-9 w-56 rounded-xl bg-panel-3" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel h-60" />
          <div className="panel h-60" />
          <div className="panel h-60" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Connections & settings"
        subtitle="Wire each artist into the platforms with real OAuth. Authorization opens in a secure new tab — come back and the dashboard picks up the connection automatically."
        actions={
          <span className="flex items-center gap-2 rounded-xl border border-mint/25 bg-mint/[0.06] px-3.5 py-2 text-[12px] font-medium text-mint">
            <ShieldCheck className="h-4 w-4" />
            Live OAuth flow
          </span>
        }
      />

      {/* ---------- artist selector ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel relative z-20 mb-8 p-5"
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Connecting accounts for
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setDropOpen((v) => !v)}
              className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-ink-2 pl-2 pr-4 transition hover:border-line-strong"
            >
              {activeArtist ? (
                <>
                  <ArtistAvatar name={activeArtist.name} />
                  <span className="text-[14px] font-semibold">{activeArtist.name}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 text-faint transition-transform", dropOpen && "rotate-180")}
                  />
                </>
              ) : (
                <span className="px-2 text-[13px] text-faint">No artist — add one on the Artists page</span>
              )}
            </button>
            <AnimatePresence>
              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-20 mt-2 w-[260px] overflow-hidden rounded-2xl border border-line bg-panel-3 p-1.5 shadow-2xl"
                  >
                    {artists.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setActiveArtist(a.id);
                          setDropOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-white/[0.05]"
                      >
                        <ArtistAvatar name={a.name} size="sm" />
                        <span className="flex-1 truncate font-medium">{a.name}</span>
                        {a.id === activeArtistId && <Check className="h-3.5 w-3.5 text-acid" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <p className="text-[12px] text-faint">
            Connections are scoped per artist — the artistId rides the OAuth state cookie into the callback.
          </p>
        </div>
      </motion.div>

      {/* ---------- platform cards ---------- */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((platform, i) => {
          const meta = PLATFORM_META[platform];
          const conn = activeArtistId ? connectionFor(activeArtistId, platform) : undefined;
          const live = conn?.status === "connected";
          const env = envReady(platform);
          return (
            <motion.div
              key={platform}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "panel panel-hover relative overflow-hidden p-5",
                live && "border-mint/30"
              )}
            >
              <div
                className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity"
                style={{ background: `radial-gradient(circle, ${live ? "#38e08c" : meta.accent}, transparent 70%)` }}
              />

              <div className="flex items-start justify-between">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                  style={{
                    color: meta.accent,
                    background: `${meta.accent}14`,
                    borderColor: `${meta.accent}40`,
                  }}
                >
                  <PlatformIcon platform={platform} className="h-6 w-6" />
                </span>
                {live ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mint">
                    <span className="pulse-mint h-1.5 w-1.5 rounded-full bg-mint" />
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
                    Disconnected
                  </span>
                )}
              </div>

              <h3 className="text-display mt-4 text-[17px] font-bold">
                {platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram Reels" : "YouTube Shorts"}
              </h3>
              <p className="mt-1.5 min-h-[36px] text-[11.5px] leading-relaxed text-faint">
                {BLURBS[platform]}
              </p>

              {/* env readiness */}
              <p
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  env === true ? "text-mint/70" : env === false ? "text-amber" : "text-faint"
                )}
              >
                {env === true ? (
                  <>
                    <ShieldCheck className="h-3 w-3" /> OAuth app configured
                  </>
                ) : env === false ? (
                  <>
                    <ShieldAlert className="h-3 w-3" /> Missing env credentials
                  </>
                ) : (
                  "Checking credentials…"
                )}
              </p>

              {live && conn ? (
                <div className="mt-3 rounded-xl border border-mint/20 bg-mint/[0.04] px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-mint/80">
                    <BadgeCheck className="h-3 w-3" /> Linked handle
                  </p>
                  <p className="mt-1 truncate font-mono text-[13px] font-medium text-mint">
                    {conn.accountHandle}
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-3">
                  <p className="text-[11px] text-faint">
                    {activeArtistId
                      ? `No ${meta.label} account linked for ${activeArtist?.name}.`
                      : "Select an artist first."}
                  </p>
                </div>
              )}

              {live ? (
                <button
                  onClick={() => activeArtistId && disconnect(activeArtistId, platform)}
                  disabled={!activeArtistId}
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-transparent text-[13px] font-bold text-muted transition hover:border-hot/40 hover:bg-hot/[0.06] hover:text-hot active:scale-[0.98] disabled:opacity-40"
                >
                  <Unplug className="h-4 w-4" /> Disconnect
                </button>
              ) : activeArtistId ? (
                <>
                  {/* target="_blank" is essential: platforms refuse iframe loads */}
                  <a
                    href={authorizeHref(platform)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => beginOAuth(platform)}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-acid text-[13px] font-bold text-ink transition hover:shadow-[0_0_26px_-6px_rgba(205,240,77,0.9)] active:scale-[0.98]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {pendingPlatform === platform
                      ? "Reopen authorization tab"
                      : `Authorize on ${meta.label}`}
                  </a>
                  {pendingPlatform === platform && (
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted">
                      <Loader2 className="h-3 w-3 animate-spin text-acid" />
                      Waiting in the new tab — this page refreshes when you return
                    </p>
                  )}
                </>
              ) : (
                <button
                  disabled
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-acid text-[13px] font-bold text-ink opacity-40"
                >
                  Select an artist first
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ---------- raw connection table ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="panel mt-8 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <Database className="h-4 w-4 text-acid" />
          <h2 className="text-display text-[15px] font-bold tracking-tight">
            platform_connections — live rows
          </h2>
          <span className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] text-faint">
              {process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}
            </span>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] text-faint">
              {allConnections.length} rows
            </span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.16em] text-faint">
                <th className="px-5 py-3 font-semibold">id</th>
                <th className="px-5 py-3 font-semibold">artist</th>
                <th className="px-5 py-3 font-semibold">platform</th>
                <th className="px-5 py-3 font-semibold">account_handle</th>
                <th className="px-5 py-3 font-semibold">status</th>
                <th className="px-5 py-3 font-semibold">created_at</th>
              </tr>
            </thead>
            <tbody>
              {allConnections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-faint">
                    No rows yet — authorize a platform above.
                  </td>
                </tr>
              )}
              {allConnections.map((c) => {
                const artist = artists.find((a) => a.id === c.artistId);
                const live = c.status === "connected";
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-line/60 transition hover:bg-white/[0.02]",
                      c.artistId === activeArtistId && "bg-acid/[0.03]"
                    )}
                  >
                    <td className="px-5 py-3 font-mono text-faint">#{c.id}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        {artist && <ArtistAvatar name={artist.name} size="xs" />}
                        {artist?.name ?? `#${c.artistId}`}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 capitalize">
                        <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 text-muted" />
                        {c.platform}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-muted">{c.accountHandle}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                          live
                            ? "border-mint/35 bg-mint/[0.08] text-mint"
                            : "border-line bg-white/[0.03] text-faint"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-mint" : "bg-faint")} />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-faint">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse">
          <div className="mb-8 h-9 w-56 rounded-xl bg-panel-3" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="panel h-60" />
            <div className="panel h-60" />
            <div className="panel h-60" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
