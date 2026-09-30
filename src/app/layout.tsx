import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { getAuthedClient } from "@/lib/supabase";
import { NavLink } from "@/components/nav-link";
import { NotificationBell } from "@/components/notification-bell";
import { signOut } from "@/app/actions/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the dashboard's editorial serif (hero, pipeline numbers).
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "JobTracker",
    template: "%s · JobTracker",
  },
  description:
    "Track job applications, interviews, contacts, and follow-ups in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { user } = await getAuthedClient();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans dark:bg-black">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Job
              <span className="text-zinc-400 dark:text-zinc-500">Tracker</span>
            </Link>
            {user ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
                  <NavLink href="/">Dashboard</NavLink>
                  <NavLink href="/applications">Applications</NavLink>
                  <NavLink href="/follow-ups">Follow-ups</NavLink>
                  <NavLink href="/contacts">Contacts</NavLink>
                </nav>
                <NotificationBell />
                <div className="flex items-center gap-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
                  <span className="hidden max-w-[16ch] truncate text-xs text-zinc-500 sm:inline dark:text-zinc-400">
                    {user.email}
                  </span>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
          JobTracker — your job search, organized.
        </footer>
      </body>
    </html>
  );
}
