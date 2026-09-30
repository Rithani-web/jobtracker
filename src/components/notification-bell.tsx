"use client";

import { useCallback, useEffect, useRef, useState, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
  NOTIFICATION_KIND_LABEL,
  cardClass,
  chipClass,
  formatDateShort,
} from "@/lib/domain";
import {
  toNotification,
  type Notification,
  type NotificationRow,
} from "@/lib/types";

const POLL_MS = 60_000;

/** "just now" / "5m ago" / "2h ago" / "3d ago", then a short date. */
function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(date);
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * Header bell + dropdown panel for the notification center. The badge and
 * panel are client state fed by /api/notifications (which also syncs reminder
 * rows server-side), polled every minute and on window focus.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: NotificationRow[];
        unreadCount: number;
      };
      setItems(data.notifications.map(toNotification));
      setUnreadCount(data.unreadCount);
      setLoaded(true);
    } catch {
      // Network hiccup — the badge just stays stale until the next poll.
    }
  }, []);

  useEffect(() => {
    // First poll off the effect's synchronous path (react-hooks/set-state-in-effect).
    const kickoff = setTimeout(refresh, 0);
    // A backgrounded tab would otherwise keep polling forever — skip while
    // hidden and refresh once on return.
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /** Optimistically flips the row locally; the count comes back from the API. */
  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id && !n.readAt ? { ...n, readAt: new Date() } : n,
      ),
    );
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok)
        setUnreadCount(
          ((await res.json()) as { unreadCount: number }).unreadCount,
        );
    } catch {
      // Reconciled by the next poll.
    }
  }

  async function markAllRead() {
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date() })),
    );
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok)
        setUnreadCount(
          ((await res.json()) as { unreadCount: number }).unreadCount,
        );
    } catch {
      // Reconciled by the next poll.
    }
  }

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch(
        `/api/notifications?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok)
        setUnreadCount(
          ((await res.json()) as { unreadCount: number }).unreadCount,
        );
    } catch {
      // Reconciled by the next poll.
    }
  }

  async function openItem(notification: Notification) {
    // Fire-and-forget: navigation shouldn't wait on the PATCH round-trip;
    // the next poll reconciles if it fails.
    if (!notification.readAt) markRead(notification.id);
    setOpen(false);
    if (notification.applicationId) {
      router.push(`/applications/${notification.applicationId}`);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-lg border border-zinc-300 p-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden ${cardClass}`}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading…
              </li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                You&apos;re all caught up.
              </li>
            ) : (
              items.map((notification) => (
                <li
                  key={notification.id}
                  className="group flex items-stretch border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <button
                    type="button"
                    onClick={() => openItem(notification)}
                    className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2">
                      {!notification.readAt && (
                        <span
                          aria-label="Unread"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                        />
                      )}
                      <span className={chipClass}>
                        {NOTIFICATION_KIND_LABEL[notification.kind]}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {notification.body}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(notification.id)}
                    aria-label="Dismiss notification"
                    className="px-2 text-zinc-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-600"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
