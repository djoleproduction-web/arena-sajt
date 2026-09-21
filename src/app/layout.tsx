import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/app-context";
import { Sidebar } from "@/components/sidebar";
import { SchedulerModal } from "@/components/scheduler-modal";
import { Toasts } from "@/components/ui";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Setlist — Artist Social Scheduler",
  description:
    "Full-stack social video scheduler and content dashboard for music artists. Plan TikTok, Reels and Shorts in one dark control room.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${inter.variable}`}>
      <body className="noise min-h-dvh bg-ink font-sans text-text antialiased">
        <AppProvider>
          <Sidebar />
          <main className="pb-24 pt-20 lg:pb-10 lg:pl-[248px] lg:pt-0">
            <div className="mx-auto w-full max-w-[1180px] px-5 pt-4 sm:px-8 lg:pt-10">
              {children}
            </div>
          </main>
          <SchedulerModal />
          <Toasts />
        </AppProvider>
      </body>
    </html>
  );
}
