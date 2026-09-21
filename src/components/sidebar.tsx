"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  Plus,
  Settings2,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/app-context";
import { EqMark } from "@/components/platform-icons";
import { ArtistAvatar } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/artists", label: "Artists", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { artists, activeArtist, setActiveArtist, openScheduler, ready } = useApp();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <>
      {/* ---------- desktop rail ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-ink-2/70 backdrop-blur-xl lg:flex">
        <div className="flex h-full flex-col px-4 py-6">
          {/* brand */}
          <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-1.5">
            <EqMark />
            <div>
              <div className="text-display text-[15px] font-bold leading-none tracking-[0.18em]">
                SETLIST
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-faint">
                Artist Social OS
              </div>
            </div>
          </Link>

          {/* primary CTA */}
          <button
            onClick={() => openScheduler()}
            className="group mb-8 flex h-11 items-center justify-center gap-2 rounded-xl bg-acid text-[13px] font-bold text-ink transition-all hover:shadow-[0_0_32px_-6px_rgba(205,240,77,0.8)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            Schedule post
          </button>

          {/* nav */}
          <nav className="flex-1 space-y-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors",
                    active ? "text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl border border-line bg-white/[0.05]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-acid" />
                  )}
                  <item.icon className={cn("relative z-10 h-[17px] w-[17px]", active && "text-acid")} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* active artist switcher */}
          <div ref={switcherRef} className="relative">
            <AnimatePresence>
              {switcherOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-line bg-panel-3 p-1.5 shadow-2xl"
                >
                  <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                    Switch artist
                  </div>
                  {artists.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setActiveArtist(a.id);
                        setSwitcherOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-white/[0.05]",
                        a.id === activeArtist?.id ? "text-text" : "text-muted"
                      )}
                    >
                      <ArtistAvatar name={a.name} size="sm" />
                      <span className="flex-1 truncate font-medium">{a.name}</span>
                      {a.id === activeArtist?.id && <Check className="h-3.5 w-3.5 text-acid" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-3 text-left transition hover:border-line-strong"
            >
              {ready && activeArtist ? (
                <>
                  <ArtistAvatar name={activeArtist.name} ring />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{activeArtist.name}</span>
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
                      Active artist
                    </span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
                </>
              ) : (
                <>
                  <span className="shimmer h-9 w-9 rounded-xl bg-panel-3" />
                  <span className="shimmer h-3 flex-1 rounded bg-panel-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- mobile top bar ---------- */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-ink-2/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <EqMark className="h-7 w-7 rounded-lg" />
          <span className="text-display text-sm font-bold tracking-[0.18em]">SETLIST</span>
        </Link>
        <button
          onClick={() => openScheduler()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-acid px-3 text-xs font-bold text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Post
        </button>
      </header>

      {/* ---------- mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-line bg-ink-2/90 px-2 backdrop-blur-xl lg:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 text-[10px] font-medium",
                active ? "text-acid" : "text-muted"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
