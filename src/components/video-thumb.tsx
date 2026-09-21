"use client";

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a real video preview when `src` is a local blob URL
 * (created via URL.createObjectURL), an <img> for remote urls,
 * and a subtle placeholder when there is no media yet.
 */
export function VideoThumb({
  src,
  className,
  interactive = false,
  alt = "",
}: {
  src: string | null;
  className?: string;
  /** When true and src is a blob, show native video controls. */
  interactive?: boolean;
  alt?: string;
}) {
  if (!src) {
    return (
      <span
        className={cn(
          "flex h-full w-full items-center justify-center bg-ink-2 text-faint",
          className
        )}
      >
        <Play className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (src.startsWith("blob:")) {
    return (
      <video
        src={src}
        muted
        loop
        playsInline
        autoPlay={!interactive}
        controls={interactive}
        preload="metadata"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />;
}
