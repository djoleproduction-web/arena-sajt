"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  Grip,
  LayoutGrid,
  Play,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, type Post } from "@/context/app-context";
import { PostDetailModal } from "@/components/post-detail-modal";
import { PlatformChip, PlatformIcon } from "@/components/platform-icons";
import { VideoThumb } from "@/components/video-thumb";
import { AcidButton, ArtistAvatar, PageHeader, StatusChip } from "@/components/ui";
import { durationFor } from "@/lib/thumbs";
import {
  addDays,
  cn,
  fmtFull,
  fmtTime,
  isSameDay,
  PLATFORMS,
  STATUS_META,
  type Platform,
  type PostStatus,
} from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ViewMode = "month" | "week";
type StatusFilter = "all" | PostStatus;

export default function CalendarPage() {
  const { ready, artists, activeArtistId, posts, openScheduler } = useApp();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [artistFilter, setArtistFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Post | null>(null);
  const [daySheet, setDaySheet] = useState<{ day: Date; posts: Post[] } | null>(null);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (artistFilter !== "all" && p.artistId !== artistFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [posts, artistFilter, statusFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of filtered) {
      if (!p.scheduledTime) continue;
      const d = new Date(p.scheduledTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime());
    }
    return map;
  }, [filtered]);

  const postsOn = (d: Date) => byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];

  /* ---------- month grid math (Monday start) ---------- */
  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: cells }, (_, i) => addDays(first, i - lead));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const monday = addDays(cursor, -((cursor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [cursor]);

  const navigate = (dir: -1 | 1) => {
    setCursor((c) => {
      const d = new Date(c);
      if (view === "month") d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };

  const title = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (!ready) {
    return (
      <div className="animate-pulse">
        <div className="mb-8 h-9 w-64 rounded-xl bg-panel-3" />
        <div className="panel h-[560px]" />
      </div>
    );
  }

  const openDay = (d: Date) => setDaySheet({ day: d, posts: postsOn(d) });

  const createFor = (d: Date) => {
    const t = new Date(d);
    t.setHours(18, 0, 0, 0);
    openScheduler({ presetDate: t });
  };

  return (
    <>
      <PageHeader
        title="Content calendar"
        subtitle={`${filtered.filter((p) => p.status === "scheduled").length} videos queued across the roster — click any slot to stake a new drop.`}
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-ink-2 p-1">
              {(
                [
                  ["month", "Month", LayoutGrid],
                  ["week", "Week", Columns3],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition",
                    view === mode ? "bg-acid text-ink" : "text-muted hover:text-text"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <AcidButton className="h-10" onClick={() => openScheduler()}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New post</span>
            </AcidButton>
          </>
        }
      />

      {/* ---------- control bar ---------- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink-2 text-muted transition hover:border-line-strong hover:text-text"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="h-9 rounded-xl border border-line bg-ink-2 px-3.5 text-[12px] font-medium text-muted transition hover:border-line-strong hover:text-text"
          >
            Today
          </button>
          <button
            onClick={() => navigate(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink-2 text-muted transition hover:border-line-strong hover:text-text"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <AnimatePresence mode="wait">
            <motion.h2
              key={`${view}-${title}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="text-display ml-2 text-xl font-bold tracking-tight"
            >
              {view === "month" ? title : `Week of ${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </motion.h2>
          </AnimatePresence>
        </div>

        <span className="hidden flex-1 md:block" />

        {/* artist filter */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-ink-2 p-1">
          <button
            onClick={() => setArtistFilter("all")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition",
              artistFilter === "all" ? "bg-white/[0.08] text-text" : "text-muted hover:text-text"
            )}
          >
            <Grip className="h-3 w-3" /> Roster
          </button>
          {artists.map((a) => (
            <button
              key={a.id}
              onClick={() => setArtistFilter(a.id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition",
                artistFilter === a.id ? "bg-white/[0.08] text-text" : "text-muted hover:text-text"
              )}
            >
              <ArtistAvatar name={a.name} size="xs" />
              <span className="max-w-[76px] truncate">{a.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* status filter */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-ink-2 p-1">
          {(["all", "scheduled", "draft", "published"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "h-7 rounded-lg px-2.5 text-[11px] font-medium capitalize transition",
                statusFilter === s ? "bg-white/[0.08] text-text" : "text-muted hover:text-text"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- legend ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[10.5px] text-faint">
        {(Object.keys(STATUS_META) as PostStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_META[s].dot }} />
            {STATUS_META[s].label}
          </span>
        ))}
        <span className="hidden items-center gap-1.5 sm:flex">
          <CalendarDays className="h-3 w-3" /> empty cell → create · card → details
        </span>
      </div>

      {/* ---------- month view ---------- */}
      {view === "month" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="panel overflow-x-auto"
        >
          <div className="min-w-[880px]">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const today = isSameDay(day, new Date());
                const dayPosts = postsOn(day);
                const visible = dayPosts.slice(0, 2);
                return (
                  <div
                    key={i}
                    onClick={() => createFor(day)}
                    className={cn(
                      "group relative min-h-[118px] cursor-pointer border-b border-r border-line p-1.5 transition-colors last:border-b-0 hover:bg-white/[0.025]",
                      "[&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-ink-2/30"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between px-1 pt-0.5">
                      <span
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-[11px] font-semibold",
                          today
                            ? "bg-acid text-ink shadow-[0_0_16px_-2px_rgba(205,240,77,0.8)]"
                            : inMonth
                              ? "text-muted"
                              : "text-faint/60"
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <span className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        {dayPosts.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDay(day);
                            }}
                            className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-muted hover:text-text"
                          >
                            all
                          </button>
                        )}
                        <Plus className="h-3.5 w-3.5 text-faint" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      {visible.map((p) => (
                        <MiniEvent key={p.id} post={p} onOpen={() => setSelected(p)} />
                      ))}
                      {dayPosts.length > 2 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDay(day);
                          }}
                          className="w-full rounded-md bg-white/[0.04] px-2 py-1 text-left text-[10px] font-medium text-muted transition hover:bg-white/[0.08] hover:text-text"
                        >
                          +{dayPosts.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ---------- week view ---------- */}
      {view === "week" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="panel overflow-x-auto"
        >
          <div className="grid min-w-[980px] grid-cols-7">
            {weekDays.map((day) => {
              const today = isSameDay(day, new Date());
              const dayPosts = postsOn(day);
              return (
                <div key={day.toISOString()} className="border-r border-line last:border-r-0">
                  <div className={cn("border-b border-line px-3 py-3", today && "bg-acid/[0.05]")}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p
                      className={cn(
                        "text-display mt-0.5 text-lg font-bold",
                        today ? "text-acid" : "text-text"
                      )}
                    >
                      {day.getDate()}
                      {today && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-widest text-acid/80">today</span>}
                    </p>
                  </div>
                  <div
                    onClick={() => createFor(day)}
                    className="group min-h-[380px] cursor-pointer space-y-2 p-2 transition-colors hover:bg-white/[0.02]"
                  >
                    {dayPosts.map((p) => (
                      <WeekEvent key={p.id} post={p} onOpen={() => setSelected(p)} />
                    ))}
                    {dayPosts.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line opacity-0 transition group-hover:opacity-100">
                        <Plus className="h-4 w-4 text-faint" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ---------- day sheet ---------- */}
      <AnimatePresence>
        {daySheet && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDaySheet(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border border-line bg-panel-2 p-5 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-display text-lg font-bold">
                    {daySheet.day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <p className="text-[11px] text-faint">
                    {daySheet.posts.length} video{daySheet.posts.length === 1 ? "" : "s"} on this day
                  </p>
                </div>
                <button
                  onClick={() => setDaySheet(null)}
                  className="rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {daySheet.posts.length === 0 && (
                  <p className="py-8 text-center text-[13px] text-faint">Nothing scheduled here yet.</p>
                )}
                {daySheet.posts.map((p) => {
                  const st = STATUS_META[p.status as PostStatus];
                  const artist = artists.find((a) => a.id === p.artistId);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDaySheet(null);
                        setSelected(p);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-2 p-2.5 text-left transition hover:border-line-strong"
                    >
                      <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded-md border border-line">
                        <VideoThumb src={p.videoUrl} className="h-full w-full" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold">{p.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-faint">
                          <span style={{ color: st.dot }}>{p.scheduledTime ? fmtTime(new Date(p.scheduledTime)) : ""}</span>
                          {artist && <span>· {artist.name}</span>}
                        </span>
                      </span>
                      <span className="flex -space-x-1">
                        {p.platforms.map((pl) => (
                          <PlatformChip key={pl} platform={pl as Platform} size="sm" className="ring-2 ring-ink-2" />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <AcidButton
                className="mt-4 w-full"
                onClick={() => {
                  const d = daySheet.day;
                  setDaySheet(null);
                  createFor(d);
                }}
              >
                <Plus className="h-4 w-4" /> Add video to this day
              </AcidButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PostDetailModal post={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ---------------- event cards ---------------- */

function MiniEvent({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const st = STATUS_META[post.status as PostStatus];
  return (
    <motion.button
      layout
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      whileHover={{ scale: 1.02 }}
      className="flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-line bg-panel-3/80 p-1 text-left transition hover:border-line-strong"
      style={{ borderLeft: `2px solid ${st.dot}` }}
    >
      <span className="relative h-8 w-6 shrink-0 overflow-hidden rounded bg-ink">
        <VideoThumb src={post.videoUrl} className="h-full w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold leading-tight">{post.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[9px] text-faint">
          <Clock3 className="h-2.5 w-2.5" />
          {post.scheduledTime ? fmtTime(new Date(post.scheduledTime)) : "—"}
        </span>
      </span>
      <span className="mr-0.5 flex -space-x-1">
        {post.platforms.slice(0, 2).map((pl) => (
          <span
            key={pl}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-line bg-ink text-[8px] ring-1 ring-panel-3"
          >
            <PlatformIcon platform={pl} className="h-2 w-2 text-muted" />
          </span>
        ))}
      </span>
    </motion.button>
  );
}

function WeekEvent({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const st = STATUS_META[post.status as PostStatus];
  return (
    <motion.button
      layout
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      whileHover={{ y: -2 }}
      className="block w-full overflow-hidden rounded-xl border border-line bg-panel-3/80 text-left transition hover:border-line-strong"
    >
      <span className="relative block aspect-[4/3] w-full bg-ink">
        <VideoThumb src={post.videoUrl} className="absolute inset-0 h-full w-full" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition hover:opacity-100">
          <Play className="h-5 w-5 fill-white text-white" />
        </span>
        {post.videoUrl && !post.videoUrl.startsWith("blob:") && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[9px] font-bold">
            {durationFor(post.id)}
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 flex -space-x-1">
          {post.platforms.map((pl) => (
            <PlatformChip key={pl} platform={pl as Platform} size="sm" className="ring-2 ring-ink/60" />
          ))}
        </span>
      </span>
      <span className="block p-2.5" style={{ borderLeft: `2px solid ${st.dot}` }}>
        <span className="block truncate text-[11px] font-semibold leading-snug">{post.title}</span>
        <span className="mt-1 flex items-center gap-1 text-[9.5px]" style={{ color: st.dot }}>
          <Clock3 className="h-2.5 w-2.5" />
          {post.scheduledTime ? fmtTime(new Date(post.scheduledTime)) : "unscheduled"}
        </span>
      </span>
    </motion.button>
  );
}
