"use client";

import { cn, type Platform } from "@/lib/utils";

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 3c.35 1.98 1.73 3.36 3.9 3.56v2.9c-1.47-.05-2.8-.47-3.9-1.22v5.89c0 3.25-2.4 5.87-5.6 5.87-3.05 0-5.5-2.5-5.5-5.44 0-3.08 2.7-5.5 5.9-5.31v2.95c-.24-.04-.48-.06-.73-.05-1.47.03-2.63 1.17-2.63 2.54 0 1.42 1.14 2.57 2.56 2.57 1.66 0 2.9-1.2 2.94-3.02V3h3.06Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.42-4.81ZM10 15.02V8.98L15.5 12 10 15.02Z" />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  if (platform === "tiktok") return <TikTokIcon className={className} />;
  if (platform === "instagram") return <InstagramIcon className={className} />;
  return <YouTubeIcon className={className} />;
}

export function PlatformChip({
  platform,
  size = "md",
  className,
}: {
  platform: Platform;
  size?: "sm" | "md";
  className?: string;
}) {
  const box =
    size === "sm"
      ? "h-[18px] w-[18px] rounded-[6px]"
      : "h-6 w-6 rounded-lg";
  const ring =
    platform === "tiktok"
      ? "bg-[#2df5e2]/15 text-[#2df5e2] border-[#2df5e2]/30"
      : platform === "instagram"
        ? "bg-[#ff7ab8]/15 text-[#ff7ab8] border-[#ff7ab8]/30"
        : "bg-[#ff5c5c]/15 text-[#ff5c5c] border-[#ff5c5c]/30";
  return (
    <span
      title={platform}
      className={cn(
        "inline-flex items-center justify-center border backdrop-blur-sm",
        box,
        ring,
        className
      )}
    >
      <PlatformIcon
        platform={platform}
        className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}
      />
    </span>
  );
}

/** Animated equalizer logo mark. */
export function EqMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-end justify-center gap-[3px] h-9 w-9 rounded-xl bg-acid text-ink shadow-[0_0_30px_-6px_rgba(205,240,77,0.7)]",
        className
      )}
    >
      <span className="flex items-end gap-[2.5px] h-4">
        <span className="eq-bar w-[3px] h-4 rounded-full bg-ink" />
        <span className="eq-bar w-[3px] h-4 rounded-full bg-ink" />
        <span className="eq-bar w-[3px] h-4 rounded-full bg-ink" />
      </span>
    </span>
  );
}
