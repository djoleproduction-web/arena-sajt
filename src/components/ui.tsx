"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import {
  artistGradient,
  cn,
  initials,
  STATUS_META,
  type PostStatus,
} from "@/lib/utils";
import { useApp } from "@/context/app-context";

/* ---------------- artist avatar ---------------- */

export function ArtistAvatar({
  name,
  size = "md",
  ring,
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  className?: string;
}) {
  const [a, b] = artistGradient(name);
  const dims = {
    xs: "h-5 w-5 text-[8px] rounded-md",
    sm: "h-7 w-7 text-[10px] rounded-lg",
    md: "h-9 w-9 text-xs rounded-xl",
    lg: "h-12 w-12 text-sm rounded-2xl",
    xl: "h-16 w-16 text-lg rounded-2xl",
  }[size];
  return (
    <span
      className={cn(
        "inline-flex select-none items-center justify-center font-display font-bold text-ink shrink-0",
        dims,
        ring && "ring-2 ring-white/15",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------- status chip ---------------- */

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[(status as PostStatus)] ?? STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
        meta.chip,
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", status === "scheduled" && "pulse-mint")}
        style={{ background: meta.dot, ["--tw-shadow-color" as never]: meta.dot }}
      />
      {meta.label}
    </span>
  );
}

/* ---------------- modal shell ---------------- */

export function Modal({
  open,
  onClose,
  children,
  wide,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/80 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              "relative w-full overflow-hidden border border-line bg-panel-2 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]",
              wide ? "max-w-4xl" : "max-w-lg",
              "rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col",
              className
            )}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  icon,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
      <div className="flex items-center gap-3.5">
        {icon}
        <div>
          <h2 className="text-display text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
        </div>
      </div>
      <button
        onClick={onClose}
        className="rounded-full p-2 text-muted transition hover:bg-white/5 hover:text-text"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------------- buttons ---------------- */

export function AcidButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-acid px-4 text-[13px] font-semibold text-ink",
        "transition-all hover:bg-[#d8f675] hover:shadow-[0_0_28px_-8px_rgba(205,240,77,0.8)] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] px-4 text-[13px] font-medium text-text",
        "transition-all hover:border-line-strong hover:bg-white/[0.06] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- page header ---------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="text-display text-[28px] sm:text-[34px] font-bold leading-none tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-2.5 text-sm muted max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </motion.div>
  );
}

/* ---------------- toasts ---------------- */

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-2xl backdrop-blur-xl",
              t.tone === "ok"
                ? "border-[#38e08c]/25 bg-[#0d141b]/90 text-text"
                : "border-hot/30 bg-[#160d12]/90 text-text"
            )}
          >
            {t.tone === "ok" ? (
              <CheckCircle2 className="h-4 w-4 text-mint" />
            ) : (
              <XCircle className="h-4 w-4 text-hot" />
            )}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- form bits ---------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
        {hint && <span className="text-[10px] font-normal normal-case tracking-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-[13px] text-text placeholder:text-faint outline-none transition focus:border-acid/50 focus:ring-2 focus:ring-acid/15";
