// Shared domain vocabulary for the entities whose "choice" fields are plain
// strings in SQLite (the allowed values are documented in prisma/schema.prisma
// and enforced here in app code), plus the styling tokens used across pages.

export const STATUSES = [
  "Saved",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export type Status = (typeof STATUSES)[number];

export const INTERVIEW_TYPES = [
  "PhoneScreen",
  "Technical",
  "Behavioral",
  "Onsite",
  "Final",
  "Other",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const OUTCOMES = ["Pending", "Passed", "Rejected"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export function isInterviewType(value: string): value is InterviewType {
  return (INTERVIEW_TYPES as readonly string[]).includes(value);
}

export function isOutcome(value: string): value is Outcome {
  return (OUTCOMES as readonly string[]).includes(value);
}

export const NOTIFICATION_KINDS = [
  "follow_up_overdue",
  "interview_upcoming",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/** Chip label per kind in the notification panel. */
export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  follow_up_overdue: "Overdue",
  interview_upcoming: "Interview",
};

// ---- Form state -----------------------------------------------------------

export type ActionState = { error: string | null; ok: boolean };
export const initialActionState: ActionState = { error: null, ok: false };

// ---- Date helpers ---------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Sep 25" — table cells, timeline chips, and next-step labels. */
const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatDateShort(date: Date | null | undefined): string {
  return date ? shortDateFormat.format(date) : "—";
}

/** "10:30 AM" — interview rail times. */
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function formatTime(date: Date | null | undefined): string {
  return date ? timeFormat.format(date) : "—";
}

export function formatDate(date: Date | null | undefined): string {
  return date ? dateFormat.format(date) : "—";
}

export function formatDateTime(date: Date | null | undefined): string {
  return date ? dateTimeFormat.format(date) : "—";
}

/** "YYYY-MM-DD" (local) for `<input type="date">` defaults. */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DDTHH:mm" (local) for `<input type="datetime-local">` defaults. */
export function toDateTimeInput(date: Date | null | undefined): string {
  if (!date) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${toDateInput(date)}T${h}:${min}`;
}

/**
 * Parses a `<input type="date">` or `<input type="datetime-local">` value into
 * a local Date. Returns null for blank or malformed input.
 */
export function parseDateInput(value: FormDataEntryValue | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(
    String(value ?? "").trim(),
  );
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0"] = match;
  const date = new Date(+y, +mo - 1, +d, +h, +mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "Overdue", "Today", "Tomorrow", "in N days", or "N days ago". */
export function dueLabel(dueDate: Date): string {
  const today = startOfToday();
  const due = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function isOverdue(dueDate: Date, done: boolean): boolean {
  return !done && dueDate < startOfToday();
}

// ---- Shared styling tokens -------------------------------------------------

export const cardClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

export const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/30";

export const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export const btnDanger =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40";

export const btnSmall =
  "inline-flex h-8 items-center justify-center rounded-lg border border-zinc-300 px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Small neutral chip for inline labels (archived markers, event types). */
export const chipClass =
  "rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

const badgeBase =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const STATUS_BADGE: Record<Status, string> = {
  Saved: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Applied: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  Interviewing:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Withdrawn:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export function statusBadgeClass(status: string): string {
  return isStatus(status) ? STATUS_BADGE[status] : STATUS_BADGE.Saved;
}

const OUTCOME_BADGE: Record<Outcome, string> = {
  Pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Passed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function outcomeBadgeClass(outcome: string): string {
  return isOutcome(outcome) ? OUTCOME_BADGE[outcome] : OUTCOME_BADGE.Pending;
}

export function badgeClass(extra: string): string {
  return `${badgeBase} ${extra}`;
}

/** Adds a non-breaking space so badges keep their padding when empty. */
export const BADGE_FALLBACK = " ";
