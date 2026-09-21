"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/context/app-context";
import { PlatformIcon } from "@/components/platform-icons";
import { ArtistAvatar, PageHeader, inputCls } from "@/components/ui";
import { cn, PLATFORMS, PLATFORM_META } from "@/lib/utils";

export default function ArtistsPage() {
  const {
    ready,
    artists,
    posts,
    connections,
    activeArtistId,
    setActiveArtist,
    addArtist,
    removeArtist,
    openScheduler,
    toast,
  } = useApp();

  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const perArtist = useMemo(() => {
    return artists.map((a) => {
      const aPosts = posts.filter((p) => p.artistId === a.id);
      const conns = connections.filter((c) => c.artistId === a.id);
      return {
        artist: a,
        total: aPosts.length,
        scheduled: aPosts.filter((p) => p.status === "scheduled").length,
        published: aPosts.filter((p) => p.status === "published").length,
        conns,
      };
    });
  }, [artists, posts, connections]);

  const submit = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    const ok = await addArtist(name.trim());
    if (ok) setName("");
    setAdding(false);
  };

  if (!ready) {
    return (
      <div className="animate-pulse">
        <div className="mb-8 h-9 w-56 rounded-xl bg-panel-3" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel h-72" />
          <div className="panel h-72" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Artist roster"
        subtitle="Every act signed to this workspace. Switch the active artist anytime — every post maps to their ID."
        actions={
          <span className="flex items-center gap-2 rounded-xl border border-line bg-ink-2 px-3.5 py-2 text-[12px] font-medium text-muted">
            <UsersRound className="h-4 w-4 text-acid" />
            {artists.length} on the roster
          </span>
        }
      />

      {/* add artist */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel mb-7 flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-acid/40 bg-acid/[0.06]">
            <Sparkles className="h-5 w-5 text-acid" />
          </span>
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Sign a new act — e.g. Velvet Breakfast"
              className={cn(inputCls, "border-transparent bg-transparent px-0 text-[15px] font-medium focus:ring-0", "focus:border-transparent")}
            />
            <div className="hairline mt-1" />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={!name.trim() || adding}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-acid px-5 text-[13px] font-bold text-ink transition hover:shadow-[0_0_28px_-8px_rgba(205,240,77,0.8)] disabled:opacity-40"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add artist
        </button>
      </motion.div>

      {/* artist cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {perArtist.map(({ artist, total, scheduled, published, conns }, i) => {
            const isActive = artist.id === activeArtistId;
            const liveConns = conns.filter((c) => c.status === "connected");
            return (
              <motion.article
                key={artist.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: 0.06 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "panel panel-hover group relative overflow-hidden p-5",
                  isActive && "border-acid/40 shadow-[0_0_40px_-18px_rgba(205,240,77,0.5)]"
                )}
              >
                {isActive && (
                  <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-acid/40 bg-acid/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-acid">
                    <span className="pulse-mint h-1.5 w-1.5 rounded-full bg-acid" />
                    Active
                  </span>
                )}

                <div className="flex items-center gap-4">
                  <ArtistAvatar name={artist.name} size="xl" />
                  <div className="min-w-0">
                    <h3 className="text-display truncate text-lg font-bold tracking-tight">
                      {artist.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-faint">
                      on roster since{" "}
                      {new Date(artist.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* stats */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["Posts", total],
                      ["Queued", scheduled],
                      ["Live", published],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="rounded-xl border border-line bg-ink-2 px-3 py-2.5">
                      <p className="text-display text-lg font-bold tabular-nums">{v}</p>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* platform handles */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => {
                    const conn = conns.find((c) => c.platform === p);
                    const live = conn?.status === "connected";
                    return (
                      <span
                        key={p}
                        title={live ? conn!.accountHandle : `No ${PLATFORM_META[p].label} account`}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition",
                          live ? PLATFORM_META[p].pillClass : "border-line bg-white/[0.02] text-faint"
                        )}
                      >
                        <PlatformIcon platform={p} className="h-3 w-3" />
                        {live ? conn!.accountHandle : "unlinked"}
                      </span>
                    );
                  })}
                </div>

                {/* actions */}
                <div className="mt-5 flex items-center gap-2">
                  {!isActive ? (
                    <button
                      onClick={() => {
                        setActiveArtist(artist.id);
                        toast(`${artist.name} is now the active artist`);
                      }}
                      className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] text-[12px] font-semibold transition hover:border-acid/50 hover:bg-acid/[0.07] hover:text-acid"
                    >
                      <UserRoundCheck className="h-3.5 w-3.5" /> Set active
                    </button>
                  ) : (
                    <button
                      className="flex h-9 flex-1 cursor-default items-center justify-center gap-2 rounded-xl bg-acid/[0.08] text-[12px] font-semibold text-acid"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Working desk
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveArtist(artist.id);
                      openScheduler();
                    }}
                    title={`Schedule for ${artist.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-line-strong hover:text-text"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </button>
                  {confirmDelete === artist.id ? (
                    <button
                      onClick={() => {
                        setConfirmDelete(null);
                        removeArtist(artist.id);
                      }}
                      className="h-9 rounded-xl border border-hot/40 bg-hot/10 px-3 text-[11px] font-bold text-hot transition hover:bg-hot/20"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmDelete(artist.id);
                        setTimeout(() => setConfirmDelete((v) => (v === artist.id ? null : v)), 3000);
                      }}
                      title="Delete artist (cascades posts & connections)"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-hot/40 hover:bg-hot/10 hover:text-hot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {liveConns.length === 0 && (
                  <p className="mt-3 text-[10.5px] italic text-faint">
                    Hint: link an account in Settings so this artist can publish.
                  </p>
                )}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
