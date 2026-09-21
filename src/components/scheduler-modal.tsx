"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  Clock3,
  FileVideo2,
  Inbox,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/app-context";
import { PlatformIcon } from "@/components/platform-icons";
import { VideoThumb } from "@/components/video-thumb";
import {
  AcidButton,
  Field,
  GhostButton,
  inputCls,
  Modal,
  ModalHeader,
} from "@/components/ui";
import { durationFor } from "@/lib/thumbs";
import {
  cn,
  fmtBytes,
  fmtDuration,
  fmtFull,
  PLATFORMS,
  PLATFORM_META,
  toLocalInputValue,
  type Platform,
} from "@/lib/utils";

const ACCEPTED_VIDEO = "video/mp4,video/quicktime";
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB client-side guard

const PROCESS_STEPS = [
  "Reading file from disk…",
  "Probing video metadata…",
  "Generating local preview…",
  "Stream ready",
];

interface VideoMeta {
  name: string;
  size: number;
  duration: number | null;
  width: number;
  height: number;
}

/** Reads real metadata (duration, resolution) from a blob URL. */
function probeVideo(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    v.onerror = () => reject(new Error("Could not decode this video file"));
    v.src = url;
  });
}

function quickPreset(kind: "1h" | "evening" | "friday"): Date {
  const d = new Date();
  if (kind === "1h") {
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  }
  if (kind === "evening") {
    const x = new Date(d);
    x.setDate(x.getDate() + 1);
    x.setHours(18, 0, 0, 0);
    return x;
  }
  const x = new Date(d);
  let add = (5 - x.getDay() + 7) % 7;
  if (add === 0) add = 7;
  x.setDate(x.getDate() + add);
  x.setHours(20, 0, 0, 0);
  return x;
}

export function SchedulerModal() {
  const {
    scheduler,
    closeScheduler,
    activeArtist,
    connectionFor,
    addPost,
    updatePost,
    removePost,
    toast,
  } = useApp();

  const editing = scheduler.editing ?? null;

  /* -------- video state (real file upload) -------- */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** blob URL created this session — revoked on cancel/replace */
  const pendingBlobRef = useRef<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  /* -------- form state -------- */
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [execution, setExecution] = useState<"direct_publish" | "send_to_draft">("direct_publish");
  const [dtValue, setDtValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "schedule" | "draft">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervals = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    intervals.current.forEach(clearInterval);
    timers.current = [];
    intervals.current = [];
  }, []);

  /* hydrate form when opened */
  useEffect(() => {
    if (!scheduler.open) return;
    setError(null);
    setUploadError(null);
    setSaving("idle");
    setUploading(false);
    setDragOver(false);
    pendingBlobRef.current = null;
    if (editing) {
      setVideoUrl(editing.videoUrl);
      setVideoMeta(null); // legacy/remote media: no local metadata
      setTitle(editing.title);
      setCaption(editing.caption);
      setHashtags(editing.hashtags);
      setPlatforms((editing.platforms as Platform[]) ?? []);
      setExecution(editing.executionType === "send_to_draft" ? "send_to_draft" : "direct_publish");
      setDtValue(editing.scheduledTime ? toLocalInputValue(new Date(editing.scheduledTime)) : "");
    } else {
      const base = scheduler.presetDate ? new Date(scheduler.presetDate) : quickPreset("evening");
      if (!scheduler.presetDate) base.setHours(18, 0, 0, 0);
      setVideoUrl(null);
      setVideoMeta(null);
      setTitle("");
      setCaption("");
      setHashtags("");
      setPlatforms([]);
      setExecution("direct_publish");
      setDtValue(toLocalInputValue(base));
    }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduler.open]);

  /* revoke a blob the user never saved */
  const discardPendingBlob = useCallback(() => {
    if (pendingBlobRef.current) {
      URL.revokeObjectURL(pendingBlobRef.current);
      pendingBlobRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    discardPendingBlob();
    closeScheduler();
  }, [discardPendingBlob, closeScheduler]);

  /* ------------ real upload handler ------------ */
  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || uploading) return;
      setUploadError(null);

      const okType =
        file.type === "video/mp4" ||
        file.type === "video/quicktime" ||
        /\.(mp4|mov)$/i.test(file.name);
      if (!okType) {
        setUploadError("Only MP4 or QuickTime (.mov) files are supported.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadError(`File is ${fmtBytes(file.size)} — the limit is 500 MB.`);
        return;
      }

      setUploading(true);
      setProgress(0);
      setUploadStep(0);

      // real object URL wrapping the user's local file
      const blobUrl = URL.createObjectURL(file);

      // animate progress while metadata is probed (real work happens in parallel)
      const iv = setInterval(() => {
        setProgress((p) => Math.min(92, p + Math.max(1, Math.round((92 - p) / 8))));
        setUploadStep((s) => Math.min(PROCESS_STEPS.length - 2, s + (Math.random() > 0.75 ? 1 : 0)));
      }, 110);
      intervals.current.push(iv);

      try {
        const meta = await probeVideo(blobUrl);
        clearInterval(iv);
        setProgress(100);
        setUploadStep(PROCESS_STEPS.length - 1);
        await new Promise((r) => timers.current.push(setTimeout(r, 350)));

        // hand off: revoke previous unsaved blob, keep this one
        discardPendingBlob();
        pendingBlobRef.current = blobUrl;
        setVideoUrl(blobUrl);
        setVideoMeta({
          name: file.name,
          size: file.size,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
        });
      } catch {
        clearInterval(iv);
        URL.revokeObjectURL(blobUrl);
        setUploadError("Couldn't decode that file — try a different export (H.264 MP4 works best).");
      } finally {
        setUploading(false);
      }
    },
    [uploading, discardPendingBlob]
  );

  const removeVideo = useCallback(() => {
    if (pendingBlobRef.current && videoUrl === pendingBlobRef.current) {
      discardPendingBlob();
    }
    setVideoUrl(null);
    setVideoMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [videoUrl, discardPendingBlob]);

  const openPicker = () => fileInputRef.current?.click();

  const connMap = useMemo(() => {
    const m = {} as Record<Platform, { connected: boolean; handle?: string }>;
    for (const p of PLATFORMS) {
      const c = activeArtist ? connectionFor(activeArtist.id, p) : undefined;
      m[p] = { connected: c?.status === "connected", handle: c?.accountHandle };
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArtist, connectionFor, scheduler.open]);

  const selectedDate = dtValue ? new Date(dtValue) : null;
  const dateInvalid = !!selectedDate && isNaN(selectedDate.getTime());

  const togglePlatform = (p: Platform) => {
    if (!connMap[p].connected && !platforms.includes(p)) return;
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const validate = (needTime: boolean): boolean => {
    if (!title.trim()) {
      setError("Give the post a title first.");
      return false;
    }
    if (platforms.length === 0) {
      setError("Select at least one platform to publish to.");
      return false;
    }
    if (needTime) {
      if (!selectedDate || isNaN(selectedDate.getTime())) {
        setError("Pick a valid date and time for the schedule.");
        return false;
      }
      if (selectedDate.getTime() < Date.now() - 60_000) {
        setError("The scheduled time is in the past.");
        return false;
      }
    }
    return true;
  };

  const payload = (status: string) => ({
    title: title.trim(),
    caption: caption.trim(),
    hashtags: hashtags.trim(),
    platforms,
    status,
    executionType: execution,
    scheduledTime: selectedDate && !dateInvalid ? selectedDate.toISOString() : null,
    videoUrl,
  });

  const submit = async (asDraft: boolean) => {
    if (saving !== "idle") return;
    if (!validate(!asDraft)) return;
    setSaving(asDraft ? "draft" : "schedule");
    const status = asDraft ? "draft" : "scheduled";
    if (editing) {
      await updatePost(editing.id, payload(status));
      // saved: blob ownership transfers to the post — keep it alive for session previews
      pendingBlobRef.current = null;
      toast(asDraft ? "Draft updated" : "Post rescheduled");
      closeScheduler();
    } else {
      const created = await addPost(payload(status));
      if (created) {
        pendingBlobRef.current = null;
        toast(
          asDraft
            ? "Saved to drafts"
            : `Scheduled — ${platforms.length} platform${platforms.length > 1 ? "s" : ""}`
        );
        closeScheduler();
      }
    }
    setSaving("idle");
  };

  const handleDelete = async () => {
    if (!editing) return;
    await removePost(editing.id);
    handleClose();
  };

  const isBlobVideo = videoUrl?.startsWith("blob:") ?? false;

  return (
    <Modal open={scheduler.open} onClose={handleClose} wide>
      <ModalHeader
        onClose={handleClose}
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-acid/25 bg-acid/10">
            <CalendarClock className="h-[18px] w-[18px] text-acid" />
          </span>
        }
        title={editing ? "Edit scheduled video" : "Schedule new video"}
        subtitle={
          editing
            ? "Update timing, platforms or copy"
            : `Publishing as ${activeArtist?.name ?? "—"} · queued to your calendar`
        }
      />

      {/* hidden real file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[272px_1fr]">
        {/* ------------- video rail ------------- */}
        <div className="border-b border-line bg-ink-2/40 p-5 md:border-b-0 md:border-r">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-2xl border bg-ink transition-colors",
              dragOver ? "border-acid/70 shadow-[0_0_50px_-12px_rgba(205,240,77,0.6)]" : "border-line"
            )}
          >
            {videoUrl ? (
              <>
                <VideoThumb src={videoUrl} className="absolute inset-0 h-full w-full" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-ink/30" />
                <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                  <span className="rounded-md bg-ink/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-text backdrop-blur-sm">
                    {videoMeta
                      ? `${videoMeta.width}×${videoMeta.height}`
                      : "remote media"}
                  </span>
                  <span className="rounded-md bg-ink/70 px-2 py-1 text-[10px] font-semibold text-text backdrop-blur-sm">
                    {videoMeta?.duration != null
                      ? fmtDuration(videoMeta.duration)
                      : durationFor(editing?.id ?? 0)}
                  </span>
                </div>
                {isBlobVideo && (
                  <div className="absolute inset-x-3 bottom-3 flex gap-1.5">
                    <button
                      onClick={openPicker}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-ink/70 py-1.5 text-[11px] font-medium text-text backdrop-blur-sm transition hover:bg-ink/90"
                    >
                      <RefreshCw className="h-3 w-3" /> Replace
                    </button>
                    <button
                      onClick={removeVideo}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-ink/70 py-1.5 text-[11px] font-medium text-text backdrop-blur-sm transition hover:bg-ink/90 hover:text-hot"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button onClick={openPicker} className="group flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center">
                {uploading ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-acid" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={uploadStep}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="text-xs font-medium text-muted"
                      >
                        {PROCESS_STEPS[uploadStep]}
                      </motion.span>
                    </AnimatePresence>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-acid transition-all duration-150"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold tracking-widest text-faint">
                      {progress}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/[0.03] transition group-hover:border-acid/60 group-hover:bg-acid/5">
                      <UploadCloud className="h-6 w-6 text-muted transition group-hover:text-acid" />
                    </span>
                    <span className="text-[13px] font-semibold text-text">
                      {dragOver ? "Let it drop" : "Drop your video"}
                    </span>
                    <span className="text-[11px] leading-relaxed text-faint">
                      MP4 / MOV · 9:16 vertical
                      <br />
                      up to 500 MB
                    </span>
                    <span className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-muted">
                      Browse files
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* real file meta */}
          {videoMeta && (
            <div className="mx-auto mt-3 max-w-[230px]">
              <p className="flex items-center justify-center gap-1.5 truncate text-[11px] text-faint">
                <FileVideo2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{videoMeta.name}</span>
              </p>
              <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-widest text-faint/70">
                {fmtBytes(videoMeta.size)} · local preview
              </p>
            </div>
          )}
          {uploadError && (
            <p className="mx-auto mt-3 max-w-[230px] rounded-lg border border-hot/30 bg-hot/[0.07] px-3 py-2 text-center text-[11px] font-medium text-hot">
              {uploadError}
            </p>
          )}
        </div>

        {/* ------------- form ------------- */}
        <div className="space-y-5 p-5 sm:p-6">
          <Field label="Title" hint={`${title.length}/140`}>
            <input
              className={inputCls}
              placeholder="e.g. midnight tapes — side A premiere"
              value={title}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Description" hint={`${caption.length}/500`}>
            <textarea
              className={cn(inputCls, "min-h-[76px] resize-none leading-relaxed")}
              placeholder="Write the caption your fans will read…"
              value={caption}
              maxLength={500}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>

          <Field label="Hashtags" hint="space separated">
            <input
              className={inputCls}
              placeholder="#lofi #newmusic #fyp"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </Field>

          {/* platforms */}
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Platforms
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {PLATFORMS.map((p) => {
                const meta = PLATFORM_META[p];
                const conn = connMap[p];
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    disabled={!conn.connected && !on}
                    className={cn(
                      "group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                      on
                        ? "border-acid/50 bg-acid/[0.08] shadow-[0_0_24px_-10px_rgba(205,240,77,0.6)]"
                        : "border-line bg-ink-2 hover:border-line-strong",
                      !conn.connected && !on && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg border"
                        style={{
                          color: meta.accent,
                          background: `${meta.accent}1a`,
                          borderColor: `${meta.accent}40`,
                        }}
                      >
                        <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                      </span>
                      {on ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-acid">
                          <Check className="h-3 w-3 text-ink" strokeWidth={3} />
                        </span>
                      ) : !conn.connected ? (
                        <Lock className="h-3.5 w-3.5 text-faint" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-line-strong" />
                      )}
                    </span>
                    <span className="text-[12px] font-semibold">{meta.label}</span>
                    <span className="truncate text-[10px] text-faint">
                      {conn.connected ? conn.handle : "Not connected"}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeArtist && !PLATFORMS.some((p) => connMap[p].connected) && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber">
                <Link2 className="h-3 w-3" />
                No accounts linked for {activeArtist.name} —{" "}
                <Link href="/settings" className="underline underline-offset-2 hover:text-text">
                  connect one in Settings
                </Link>
              </p>
            )}
          </div>

          {/* execution type */}
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Execution mode
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  {
                    key: "direct_publish" as const,
                    icon: Rocket,
                    title: "Direct publish",
                    desc: "We push the video live at exactly this time.",
                  },
                  {
                    key: "send_to_draft" as const,
                    icon: Inbox,
                    title: "Send to drafts",
                    desc: "Lands in the app's drafts for a final human touch.",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setExecution(opt.key)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                    execution === opt.key
                      ? "border-violet/60 bg-violet/[0.08]"
                      : "border-line bg-ink-2 hover:border-line-strong"
                  )}
                >
                  <opt.icon
                    className={cn(
                      "mb-0.5 h-4 w-4",
                      execution === opt.key ? "text-violet" : "text-faint"
                    )}
                  />
                  <span className="text-[12px] font-semibold">{opt.title}</span>
                  <span className="text-[10.5px] leading-snug text-faint">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* datetime */}
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Schedule time
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  type="datetime-local"
                  className={cn(inputCls, "pl-10 pr-3", dateInvalid && "border-hot/60")}
                  value={dtValue}
                  onChange={(e) => setDtValue(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                {(
                  [
                    ["+1 h", "1h"],
                    ["Tomorrow 6pm", "evening"],
                    ["Fri 8pm", "friday"],
                  ] as const
                ).map(([label, kind]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDtValue(toLocalInputValue(quickPreset(kind)))}
                    className="h-10 rounded-xl border border-line bg-ink-2 px-3 text-[11px] font-medium text-muted transition hover:border-line-strong hover:text-text"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {selectedDate && !dateInvalid && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <Sparkles className="h-3 w-3 text-acid" />
                {platforms.length > 0
                  ? `Goes ${execution === "direct_publish" ? "live" : "to drafts"} ${fmtFull(selectedDate)} on ${platforms
                      .map((p) => PLATFORM_META[p].label)
                      .join(" · ")}`
                  : `${fmtFull(selectedDate)} — select platforms above`}
              </p>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-hot/30 bg-hot/[0.07] px-4 py-2.5 text-[12px] font-medium text-hot"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-ink-2/60 px-5 py-4 sm:px-6">
        <div>
          {editing && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-hot/80 transition hover:bg-hot/10 hover:text-hot"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <GhostButton onClick={() => submit(true)} disabled={saving !== "idle"} className="h-10">
            {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save as draft
          </GhostButton>
          <AcidButton onClick={() => submit(false)} disabled={saving !== "idle"}>
            {saving === "schedule" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {editing ? "Update schedule" : "Schedule post"}
          </AcidButton>
        </div>
      </div>
    </Modal>
  );
}
