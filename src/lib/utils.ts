import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/* ---------------- platforms ---------------- */

export type Platform = "tiktok" | "instagram" | "youtube";

export const PLATFORMS: Platform[] = ["tiktok", "instagram", "youtube"];

export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; accent: string; pillClass: string }
> = {
  tiktok: {
    label: "TikTok",
    short: "TT",
    accent: "#2df5e2",
    pillClass:
      "bg-[#2df5e2]/10 text-[#2df5e2] border-[#2df5e2]/25",
  },
  instagram: {
    label: "Reels",
    short: "IG",
    accent: "#ff7ab8",
    pillClass:
      "bg-[#ff7ab8]/10 text-[#ff7ab8] border-[#ff7ab8]/25",
  },
  youtube: {
    label: "Shorts",
    short: "YT",
    accent: "#ff5c5c",
    pillClass:
      "bg-[#ff5c5c]/10 text-[#ff5c5c] border-[#ff5c5c]/25",
  },
};

export type PostStatus = "draft" | "scheduled" | "published";

export const STATUS_META: Record<
  PostStatus,
  { label: string; dot: string; chip: string }
> = {
  draft: {
    label: "Draft",
    dot: "#8d8d9e",
    chip: "bg-white/5 text-[#b9b9c7] border-white/10",
  },
  scheduled: {
    label: "Scheduled",
    dot: "#ffb45a",
    chip: "bg-[#ffb45a]/10 text-[#ffb45a] border-[#ffb45a]/25",
  },
  published: {
    label: "Published",
    dot: "#38e08c",
    chip: "bg-[#38e08c]/10 text-[#38e08c] border-[#38e08c]/25",
  },
};

/* ---------------- artist identity ---------------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] ?? "")).toUpperCase();
}

/** Stable vivid gradient per artist name. */
export function artistGradient(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return [`hsl(${hue} 85% 62%)`, `hsl(${(hue + 60) % 360} 90% 55%)`];
}

export function handleFor(artistName: string, platform: Platform): string {
  const slug = artistName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${slug || "artist"}_${platform}`;
}

/* ---------------- dates ---------------- */

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtFull(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relTime(d: Date): string {
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const future = diff > 0;
  let s: string;
  if (mins < 60) s = `${mins}m`;
  else if (hours < 24) s = `${hours}h`;
  else if (days < 30) s = `${days}d`;
  else s = `${Math.round(days / 30)}mo`;
  return future ? `in ${s}` : `${s} ago`;
}

export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtDuration(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
