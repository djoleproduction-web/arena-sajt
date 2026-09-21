"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarPlus,
  Clock3,
  FileEdit,
  Flame,
  Inbox,
  Link2,
  Play,
  Rocket,
  SendHorizonal,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp, type Post } from "@/context/app-context";
import { PostDetailModal } from "@/components/post-detail-modal";
import { PlatformChip } from "@/components/platform-icons";
import { VideoThumb } from "@/components/video-thumb";
import { AcidButton, GhostButton, PageHeader, StatusChip } from "@/components/ui";
import { durationFor } from "@/lib/thumbs";
import { cn, fmtFull, PLATFORM_META, PLATFORMS, relTime, type Platform } from "@/lib/utils";

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

export default function DashboardPage() {
  const {
    ready,
    activeArtist,
    postsFor,
    connectionsFor,
    activeArtistId,
    openScheduler,
    updatePost,
    toast,
  } = useApp();
  const [selected, setSelected] = useState<Post | null>(null);

  const posts = useMemo(() => postsFor(activeArtistId), [postsFor, activeArtistId]);
  const connections = useMemo(
    () => connectionsFor(activeArtistId),
    [connectionsFor, activeArtistId]
  );

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = posts
      .filter((p) => p.status === "scheduled" && p.scheduledTime && new Date(p.scheduledTime).getTime() > now - 21600000)
      .sort((a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime());
    const published = posts
      .filter((p) => p.status === "published")
      .sort((a, b) => new Date(b.scheduledTime ?? 0).getTime() - new Date(a.scheduledTime ?? 0).getTime());
    const drafts = posts.filter((p) => p.status === "draft");
    const live = connections.filter((c) => c.status === "connected").length;
    const platformMix = PLATFORMS.map((p) => ({
      p,
      n: posts.reduce((acc, post) => acc + (post.platforms.includes(p) ? 1 : 0), 0),
    }));
    // next 7 days density
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const n = posts.filter((p) => {
        if (!p.scheduledTime || p.status !== "scheduled") return false;
        const t = new Date(p.scheduledTime).getTime();
        return t >= day.getTime() && t < next.getTime();
      }).length;
      return { day, n };
    });
    return { upcoming, published, drafts, live, platformMix, week };
  }, [posts, connections]);

  const nextPost = stats.upcoming[0] ?? null;
  const countdown = useCountdown(nextPost?.scheduledTime ? new Date(nextPost.scheduledTime) : null);

  const publishNow = async (p: Post) => {
    await updatePost(p.id, { status: "published", scheduledTime: new Date().toISOString() });
    toast("Published — it's live now");
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Late night session";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  if (!ready) return <DashboardSkeleton />;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${activeArtist?.name ?? "artist"}`}
        subtitle="Your release pipeline across TikTok, Reels and Shorts — everything queued from this desk."
        actions={
          <>
            <Link href="/settings">
              <GhostButton className="h-10">
                <Link2 className="h-4 w-4 text-mint" /> Connections
              </GhostButton>
            </Link>
            <AcidButton className="h-10" onClick={() => openScheduler()}>
              <CalendarPlus className="h-4 w-4" /> New post
            </AcidButton>
          </>
        }
      />

      {/* ---------- stat rail ---------- */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Scheduled next"
          value={stats.upcoming.length}
          icon={<Clock3 className="h-4 w-4" />}
          accent="#cdf04d"
          foot={nextPost ? `next drop ${relTime(new Date(nextPost.scheduledTime!))}` : "queue is empty"}
        />
        <StatCard
          index={1}
          label="Published all-time"
          value={stats.published.length}
          icon={<Rocket className="h-4 w-4" />}
          accent="#38e08c"
          foot="across all platforms"
        />
        <StatCard
          index={2}
          label="Drafts waiting"
          value={stats.drafts.length}
          icon={<FileEdit className="h-4 w-4" />}
          accent="#8b7cff"
          foot={stats.drafts.length ? "finish & schedule them" : "nothing pending"}
        />
        <StatCard
          index={3}
          label="Live connections"
          value={stats.live}
          suffix="/ 3"
          icon={<Zap className="h-4 w-4" />}
          accent="#2df5e2"
          foot={stats.live === 3 ? "fully wired" : "link more in settings"}
        />
      </div>

      {/* ---------- week strip ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="panel mb-6 px-5 py-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Next 7 days — queue density
          </p>
          <Flame className="h-3.5 w-3.5 text-acid" />
        </div>
        <div className="mt-3.5 flex items-end gap-2">
          {stats.week.map(({ day, n }, i) => {
            const max = Math.max(1, ...stats.week.map((w) => w.n));
            const pct = n === 0 ? 8 : Math.max(14, (n / max) * 100);
            return (
              <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular-nums text-faint opacity-0 transition group-hover:opacity-100">
                  {n} post{n === 1 ? "" : "s"}
                </span>
                <div className="flex h-14 w-full items-end rounded-lg bg-white/[0.03] p-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ delay: 0.2 + i * 0.06, type: "spring", stiffness: 200, damping: 22 }}
                    className={cn(
                      "w-full rounded-md",
                      n > 0 ? "bg-gradient-to-t from-acid/50 to-acid shadow-[0_0_18px_-4px_rgba(205,240,77,0.6)]" : "bg-white/[0.04]"
                    )}
                  />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ---------- main grid ---------- */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* upcoming queue */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="panel overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-acid/10 text-acid">
                <SendHorizonal className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-display text-[15px] font-bold tracking-tight">Upcoming queue</h2>
            </div>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-[11px] font-medium text-muted transition hover:text-text"
            >
              Open calendar <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {stats.upcoming.length === 0 ? (
            <EmptyQueue onSchedule={() => openScheduler()} />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {stats.upcoming.slice(0, 6).map((p, i) => (
                  <motion.li
                    key={p.id}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: 0.05 * i, duration: 0.35 }}
                  >
                    <button
                      onClick={() => setSelected(p)}
                      className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-white/[0.025]"
                    >
                      {/* thumb */}
                      <span className="relative h-[62px] w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-ink">
                        <VideoThumb src={p.videoUrl} className="h-full w-full" />
                        <span className="absolute inset-0 flex items-center justify-center bg-ink/20 opacity-0 transition group-hover:opacity-100">
                          <Play className="h-3.5 w-3.5 fill-white text-white" />
                        </span>
                        {p.videoUrl && !p.videoUrl.startsWith("blob:") && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-ink/80 px-1 text-[8px] font-bold">
                            {durationFor(p.id)}
                          </span>
                        )}
                      </span>
                      {/* meta */}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold leading-snug">
                          {p.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                          <span className="flex items-center gap-1 text-amber">
                            <Clock3 className="h-3 w-3" />
                            {p.scheduledTime ? relTime(new Date(p.scheduledTime)) : "—"}
                          </span>
                          <span className="hidden sm:inline">
                            · {p.scheduledTime ? fmtFull(new Date(p.scheduledTime)) : ""}
                          </span>
                          <span className="hidden md:inline text-violet">
                            · {p.executionType === "send_to_draft" ? "to drafts" : "direct publish"}
                          </span>
                        </span>
                      </span>
                      {/* platforms */}
                      <span className="hidden items-center gap-1.5 sm:flex">
                        {p.platforms.map((pl) => (
                          <PlatformChip key={pl} platform={pl as Platform} />
                        ))}
                      </span>
                      {/* quick publish */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          publishNow(p);
                        }}
                        title="Publish now"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-faint opacity-0 transition hover:border-mint/40 hover:bg-mint/10 hover:text-mint group-hover:opacity-100"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </motion.section>

        {/* right column */}
        <div className="space-y-6">
          {/* countdown */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative overflow-hidden p-5"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(circle, #cdf04d, transparent 70%)" }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Next drop
            </p>
            {nextPost ? (
              <>
                <p className="mt-2 line-clamp-2 text-display text-[15px] font-bold leading-snug">
                  {nextPost.title}
                </p>
                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {(
                    [
                      [countdown?.d ?? 0, "days"],
                      [countdown?.h ?? 0, "hrs"],
                      [countdown?.m ?? 0, "min"],
                      [countdown?.s ?? 0, "sec"],
                    ] as const
                  ).map(([v, label]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-line bg-ink-2 py-2.5 text-center"
                    >
                      <span className="text-display block text-lg font-bold tabular-nums text-acid">
                        {String(v).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-faint">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                  <Inbox className="h-3 w-3 text-violet" />
                  {nextPost.executionType === "send_to_draft"
                    ? "Will land in connected app drafts"
                    : "Will publish instantly, no review step"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-muted">
                Nothing queued. <Link href="/calendar" className="text-acid underline underline-offset-2">Open the calendar</Link> and stake out a slot.
              </p>
            )}
          </motion.section>

          {/* platform mix */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Platform coverage
            </p>
            <div className="mt-4 space-y-3.5">
              {stats.platformMix.map(({ p, n }, i) => {
                const max = Math.max(1, ...stats.platformMix.map((x) => x.n));
                return (
                  <div key={p}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 font-medium">
                        <PlatformChip platform={p} size="sm" />
                        {PLATFORM_META[p].label}
                      </span>
                      <span className="tabular-nums text-faint">{n} targets</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(4, (n / max) * 100)}%` }}
                        transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${PLATFORM_META[p].accent}55, ${PLATFORM_META[p].accent})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* recent published */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="panel overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-display text-[15px] font-bold tracking-tight">Recently live</h2>
              <StatusChip status="published" />
            </div>
            {stats.published.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">No videos shipped yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.published.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.025]"
                    >
                      <span className="relative h-9 w-7 shrink-0 overflow-hidden rounded-md border border-line bg-ink">
                        <VideoThumb src={p.videoUrl} className="h-full w-full" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium">{p.title}</span>
                        <span className="text-[10.5px] text-faint">
                          live {p.scheduledTime ? relTime(new Date(p.scheduledTime)) : ""} · {p.platforms.length} platform{p.platforms.length > 1 ? "s" : ""}
                        </span>
                      </span>
                      <Rocket className="h-3.5 w-3.5 shrink-0 text-mint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </div>
      </div>

      <PostDetailModal post={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ---------------- sub-components ---------------- */

function StatCard({
  index,
  label,
  value,
  suffix,
  icon,
  accent,
  foot,
}: {
  index: number;
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: string;
  foot: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="panel panel-hover group relative overflow-hidden p-4.5 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{label}</p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border"
          style={{ color: accent, background: `${accent}14`, borderColor: `${accent}35` }}
        >
          {icon}
        </span>
      </div>
      <p className="text-display mt-3 text-[32px] font-bold leading-none tabular-nums">
        {value}
        {suffix && <span className="text-base font-medium text-faint">{suffix}</span>}
      </p>
      <p className="mt-2 text-[11px] text-faint">{foot}</p>
    </motion.div>
  );
}

function EmptyQueue({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="float-slow flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/[0.02]">
        <CalendarPlus className="h-6 w-6 text-acid" />
      </span>
      <div>
        <p className="text-display text-[15px] font-bold">The queue is silent</p>
        <p className="mt-1 max-w-[280px] text-[12px] leading-relaxed text-faint">
          Load the next visual into the timeline — your fans are already refreshing their feeds.
        </p>
      </div>
      <AcidButton onClick={onSchedule}>
        <CalendarPlus className="h-4 w-4" /> Schedule a video
      </AcidButton>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-9 w-72 rounded-xl bg-panel-3" />
        <div className="h-4 w-96 max-w-full rounded bg-panel-3/70" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-32 p-5">
            <div className="h-3 w-24 rounded bg-panel-3" />
            <div className="mt-4 h-8 w-16 rounded bg-panel-3" />
          </div>
        ))}
      </div>
      <div className="panel h-40" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="panel h-[420px]" />
        <div className="panel h-[420px]" />
      </div>
    </div>
  );
}
