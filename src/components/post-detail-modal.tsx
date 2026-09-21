"use client";

import { Inbox, Pencil, Play, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp, type Post } from "@/context/app-context";
import { PlatformChip } from "@/components/platform-icons";
import { VideoThumb } from "@/components/video-thumb";
import { AcidButton, ArtistAvatar, GhostButton, Modal, StatusChip } from "@/components/ui";
import { durationFor } from "@/lib/thumbs";
import { cn, fmtFull, PLATFORM_META, type Platform } from "@/lib/utils";

export function PostDetailModal({
  post,
  onClose,
}: {
  post: Post | null;
  onClose: () => void;
}) {
  const { artists, openScheduler, updatePost, removePost, toast } = useApp();
  const [busy, setBusy] = useState(false);

  const artist = post ? artists.find((a) => a.id === post.artistId) : null;
  const scheduled = post?.scheduledTime ? new Date(post.scheduledTime) : null;

  const publishNow = async () => {
    if (!post) return;
    setBusy(true);
    await updatePost(post.id, {
      status: "published",
      scheduledTime: new Date().toISOString(),
    });
    toast("Published — it's live now");
    setBusy(false);
    onClose();
  };

  return (
    <Modal open={!!post} onClose={onClose}>
      {post && (
        <>
          <div className="overflow-y-auto">
            {/* media */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink">
              {post.videoUrl ? (
                <VideoThumb
                  src={post.videoUrl}
                  alt={post.title}
                  interactive
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-faint">
                  <Play className="h-8 w-8" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-panel-2 via-panel-2/10 to-transparent" />
              <div className="absolute right-4 top-4 rounded-md bg-ink/70 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm">
                {post.videoUrl?.startsWith("blob:") ? "local preview" : durationFor(post.id)}
              </div>
            </div>

            <div className="-mt-8 relative px-6 pb-2">
              <div className="mb-3 flex items-center gap-2">
                <StatusChip status={post.status} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet/10 px-2.5 py-1 text-[11px] font-medium text-violet">
                  {post.executionType === "send_to_draft" ? (
                    <Inbox className="h-3 w-3" />
                  ) : (
                    <Rocket className="h-3 w-3" />
                  )}
                  {post.executionType === "send_to_draft" ? "To drafts" : "Direct publish"}
                </span>
              </div>

              <h2 className="text-display text-xl font-bold leading-tight tracking-tight">
                {post.title}
              </h2>

              {post.caption && (
                <p className="mt-3 rounded-xl border border-line bg-ink-2/60 px-4 py-3 text-[13px] leading-relaxed text-muted">
                  {post.caption}
                </p>
              )}

              {post.hashtags && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.hashtags.split(/\s+/).filter(Boolean).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-acid/[0.08] px-2.5 py-1 text-[11px] font-medium text-acid"
                    >
                      {t.startsWith("#") ? t : `#${t}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="hairline my-5" />

              <div className="grid grid-cols-2 gap-4 pb-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Artist
                  </p>
                  <div className="flex items-center gap-2">
                    {artist && <ArtistAvatar name={artist.name} size="sm" />}
                    <span className="text-[13px] font-semibold">{artist?.name ?? `#${post.artistId}`}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Scheduled
                  </p>
                  <p className="text-[13px] font-semibold">
                    {scheduled ? fmtFull(scheduled) : "Not scheduled"}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Targets
                  </p>
                  <div className="flex gap-1.5">
                    {post.platforms.map((p) => (
                      <span key={p} className="flex items-center gap-2">
                        <PlatformChip platform={p as Platform} />
                        <span className="text-[11px] text-muted">{PLATFORM_META[p as Platform]?.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-ink-2/60 px-6 py-4">
            <button
              onClick={async () => {
                await removePost(post.id);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-hot/80 transition hover:bg-hot/10 hover:text-hot"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <div className="flex items-center gap-2.5">
              <GhostButton
                onClick={() => {
                  onClose();
                  openScheduler({ editing: post });
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </GhostButton>
              <AcidButton
                onClick={publishNow}
                disabled={busy || post.status === "published"}
                className={cn(post.status === "published" && "opacity-40")}
              >
                <Rocket className="h-4 w-4" />
                {post.status === "published" ? "Live already" : "Publish now"}
              </AcidButton>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
