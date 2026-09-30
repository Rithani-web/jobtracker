// Dashboard — implements the "Job tracker dashboard" Figma frame (node 2:39)
// against the real schema. Adaptations: the design's "Screening" stage and
// "Response rate" metric have no data source (replaced by Offers), the
// "Next step" column is derived from each application's soonest upcoming
// interview or open follow-up, and the app shell's existing navigation is
// reused instead of the frame's.

import Link from "next/link";
import Image from "next/image";
import { getAuthedClient } from "@/lib/supabase";
import {
  dueLabel,
  formatDateShort,
  formatTime,
  isOverdue,
  startOfToday,
} from "@/lib/domain";
import {
  toApplication,
  type AppSummary,
  type ApplicationRow,
} from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { toggleFollowUp } from "@/app/actions/followups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

// ---- Design tokens (Figma frame 2:39) --------------------------------------

const card =
  "rounded-[14px] border border-[#dde1dd] bg-white dark:border-zinc-800 dark:bg-zinc-950";

const serifTitle =
  "font-serif text-[20px] leading-tight text-[#18201d] dark:text-zinc-50";

const actionLink =
  "text-xs text-[#244a3a] hover:underline dark:text-emerald-300";

// The four forward statuses, in pipeline order. (Rejected/Withdrawn are
// outcomes, not stages; the design's "Screening" has no schema equivalent.)
const PIPELINE_STAGES = [
  {
    status: "Saved",
    segment:
      "bg-[#f4f5f2] text-[#98a09b] dark:bg-zinc-800/60 dark:text-zinc-400",
  },
  {
    status: "Applied",
    segment:
      "bg-[#e8eef2] text-[#667a8a] dark:bg-sky-950/60 dark:text-sky-300",
  },
  {
    status: "Interviewing",
    segment:
      "bg-[#eeeaf5] text-[#6d5a8c] dark:bg-violet-950/60 dark:text-violet-300",
  },
  {
    status: "Offer",
    segment:
      "bg-[#e2f0eb] text-[#2f7661] dark:bg-emerald-950/60 dark:text-emerald-300",
  },
] as const;

function stageBadgeClass(status: string): string {
  switch (status) {
    case "Applied":
      return "bg-[#e8eef2] text-[#667a8a] dark:bg-sky-950/60 dark:text-sky-300";
    case "Interviewing":
      return "bg-[#eeeaf5] text-[#6d5a8c] dark:bg-violet-950/60 dark:text-violet-300";
    case "Offer":
      return "bg-[#e2f0eb] text-[#2f7661] dark:bg-emerald-950/60 dark:text-emerald-300";
    case "Rejected":
      return "bg-[#f5e8e8] text-[#9a5b59] dark:bg-red-950/60 dark:text-red-300";
    case "Withdrawn":
      return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400";
    default: // Saved
      return "bg-[#f4f5f2] text-[#68716c] dark:bg-zinc-800/60 dark:text-zinc-400";
  }
}

const ACTIVE_STATUSES = new Set(["Applied", "Interviewing", "Offer"]);

type RecentRow = ApplicationRow & {
  interviews: { scheduled_at: string; type: string }[];
  follow_ups: { due_date: string; note: string | null; done: boolean }[];
};

/** "Recruiter call · Sep 24" — soonest upcoming interview or open follow-up. */
function nextStepFor(row: RecentRow, nowMs: number): string | null {
  const items: { at: number; label: string }[] = [];
  for (const interview of row.interviews) {
    const at = new Date(interview.scheduled_at).getTime();
    if (at >= nowMs) items.push({ at, label: `${interview.type} · ` });
  }
  for (const followUp of row.follow_ups) {
    if (followUp.done) continue;
    const at = new Date(followUp.due_date).getTime();
    const task = followUp.note?.trim() ? followUp.note.trim() : "Follow up";
    items.push({ at, label: `${task} · ` });
  }
  if (items.length === 0) return null;
  items.sort((a, b) => a.at - b.at);
  return `${items[0].label}${formatDateShort(new Date(items[0].at))}`;
}

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const longDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default async function DashboardPage() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return null; // proxy.ts redirects; this satisfies the type-checker

  const now = new Date();
  const nowMs = now.getTime();
  const todayIso = startOfToday().toISOString();
  const nowIso = now.toISOString();
  const weekAgoMs = nowMs - 7 * 86_400_000;
  const in7dIso = new Date(nowMs + 7 * 86_400_000).toISOString();

  const [
    totalRes,
    statusRes,
    openFollowUpRes,
    overdueFollowUpRes,
    upcomingCountRes,
    interviews7dRes,
    upcomingInterviewsRes,
    nextFollowUpsRes,
    recentRes,
  ] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("applications").select("status, created_at"),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("done", false),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("done", false)
      .lt("due_date", todayIso),
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", nowIso),
    supabase
      .from("interviews")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_at", nowIso)
      .lt("scheduled_at", in7dIso),
    supabase
      .from("interviews")
      .select("id, scheduled_at, type, applications(id, company, role)")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at")
      .limit(5),
    supabase
      .from("follow_ups")
      .select("id, due_date, done, note, applications(id, company, role)")
      .eq("done", false)
      .order("due_date")
      .limit(5),
    supabase
      .from("applications")
      .select(
        "*, interviews(scheduled_at, type), follow_ups(due_date, note, done)",
      )
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const statusRows = (statusRes.data ?? []) as {
    status: string;
    created_at: string;
  }[];
  const statusCount = new Map<string, number>();
  for (const row of statusRows) {
    statusCount.set(row.status, (statusCount.get(row.status) ?? 0) + 1);
  }
  const activeCount =
    (statusCount.get("Applied") ?? 0) +
    (statusCount.get("Interviewing") ?? 0) +
    (statusCount.get("Offer") ?? 0);
  const offerCount = statusCount.get("Offer") ?? 0;
  const total = totalRes.count ?? 0;
  const newThisWeek = statusRows.filter(
    (row) =>
      ACTIVE_STATUSES.has(row.status) &&
      new Date(row.created_at).getTime() >= weekAgoMs,
  ).length;
  const overdueFollowUpCount = overdueFollowUpRes.count ?? 0;

  type InterviewEmbed = {
    id: string;
    scheduled_at: string;
    type: string;
    applications: AppSummary | AppSummary[] | null;
  };
  const upcomingInterviews = (upcomingInterviewsRes.data ?? []).map((row) => {
    const embed = row as InterviewEmbed;
    const application = Array.isArray(embed.applications)
      ? embed.applications[0]
      : embed.applications;
    return {
      id: embed.id,
      scheduledAt: new Date(embed.scheduled_at),
      type: embed.type,
      application,
    };
  });

  type FollowUpEmbed = {
    id: string;
    due_date: string;
    done: boolean;
    note: string | null;
    applications: AppSummary | AppSummary[] | null;
  };
  const nextFollowUps = (nextFollowUpsRes.data ?? []).map((row) => {
    const embed = row as FollowUpEmbed;
    const application = Array.isArray(embed.applications)
      ? embed.applications[0]
      : embed.applications;
    return {
      id: embed.id,
      dueDate: new Date(embed.due_date),
      done: embed.done,
      note: embed.note,
      application,
    };
  });

  const recentApplications = ((recentRes.data ?? []) as RecentRow[]).map(
    (row) => ({
      application: toApplication(row),
      nextStep: nextStepFor(row, nowMs),
    }),
  );

  const greeting =
    now.getHours() < 12
      ? "Good morning."
      : now.getHours() < 18
        ? "Good afternoon."
        : "Good evening.";

  return (
    <div className="rounded-2xl border border-[#dde1dd] bg-[#f4f5f2] p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:p-6">
      <div className="flex flex-col gap-6">
        {/* Page heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase text-[#244a3a] dark:text-emerald-300">
              {longDateFormat.format(now)}
            </p>
            <h1 className="font-serif text-[32px] leading-[1.1] text-[#18201d] dark:text-zinc-50 sm:text-[40px]">
              {greeting}
            </h1>
            <p className="text-sm text-[#68716c] dark:text-zinc-400">
              Here&apos;s the pulse of your search and what needs attention
              next.
            </p>
          </div>
          <Link
            href="/applications"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-[#244a3a] px-[18px] py-[11px] text-sm text-white transition-colors hover:bg-[#1d3c2f] sm:self-auto"
          >
            <Image
              src="/icons/plus.svg"
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5"
            />
            Add application
          </Link>
        </div>

        {/* Pipeline */}
        <section
          aria-label="Application pipeline"
          className="flex overflow-x-auto rounded-[14px] border border-[#dde1dd] bg-white shadow-[0_5px_18px_rgba(24,32,29,0.05)] dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex w-[190px] shrink-0 flex-col justify-center gap-1 px-6">
            <p className="text-xs uppercase text-[#68716c] dark:text-zinc-400">
              Application pipeline
            </p>
            <p className="font-serif text-[25px] leading-tight text-[#18201d] dark:text-zinc-50">
              {total} tracked
            </p>
          </div>
          {PIPELINE_STAGES.map(({ status, segment }) => (
            <Link
              key={status}
              href={`/applications?status=${status}`}
              className={`flex h-[92px] min-w-[130px] flex-1 flex-col justify-center gap-1 border-l-4 border-white px-4 transition-opacity hover:opacity-80 dark:border-zinc-950 ${segment}`}
            >
              <p className="font-serif text-[26px] leading-none">
                {statusCount.get(status) ?? 0}
              </p>
              <p className="text-xs text-[#68716c] dark:text-zinc-400">
                {status}
              </p>
            </Link>
          ))}
        </section>

        {/* Summary metrics */}
        <section
          aria-label="Summary metrics"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <MetricCard
            label="Active applications"
            value={activeCount}
            note={`+${newThisWeek} this week`}
            icon="/icons/briefcase.svg"
          />
          <MetricCard
            label="Offers"
            value={offerCount}
            note="across your pipeline"
            icon="/icons/trending-up.svg"
          />
          <MetricCard
            label="Interviews"
            value={upcomingCountRes.count ?? 0}
            note={`${interviews7dRes.count ?? 0} in the next 7 days`}
            icon="/icons/calendar.svg"
          />
          <MetricCard
            label="Follow-ups due"
            value={openFollowUpRes.count ?? 0}
            note={
              overdueFollowUpCount > 0
                ? `${overdueFollowUpCount} overdue`
                : "none overdue"
            }
            icon="/icons/list-check.svg"
          />
        </section>

        {/* Applications workspace */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <section
            aria-label="Applications"
            className={`${card} flex min-w-0 flex-col overflow-hidden`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <p className={serifTitle}>Applications</p>
              <Link href="/applications" className={actionLink}>
                View all {total} →
              </Link>
            </div>

            {recentApplications.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  title="No applications yet"
                  hint="Add your first application — company and role are all you need to start."
                >
                  <Link
                    href="/applications"
                    className="mt-2 rounded-md bg-[#244a3a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3c2f]"
                  >
                    Add your first application
                  </Link>
                </EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="flex h-[38px] items-center bg-[#f4f5f2] px-6 text-[11px] uppercase text-[#98a09b] dark:bg-zinc-900/60 dark:text-zinc-500">
                    <p className="w-[170px] shrink-0">Company</p>
                    <p className="min-w-0 flex-1 pr-4">Role</p>
                    <p className="w-[110px] shrink-0">Stage</p>
                    <p className="w-[82px] shrink-0">Applied</p>
                    <p className="w-[190px] shrink-0">Next step</p>
                  </div>
                  {recentApplications.map(({ application, nextStep }) => (
                    <div
                      key={application.id}
                      className="flex h-[64px] items-center border-t border-[#dde1dd] px-6 transition-colors hover:bg-[#fafbf9] dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <div className="flex w-[170px] shrink-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#f4f5f2] font-serif text-base text-[#18201d] dark:bg-zinc-800 dark:text-zinc-100">
                          {application.company.trim().charAt(0).toUpperCase()}
                        </span>
                        <Link
                          href={`/applications/${application.id}`}
                          className="truncate text-sm text-[#18201d] hover:underline dark:text-zinc-100"
                        >
                          {application.company}
                        </Link>
                      </div>
                      <p className="min-w-0 flex-1 truncate pr-4 text-xs text-[#18201d] dark:text-zinc-200">
                        {application.role}
                      </p>
                      <div className="w-[110px] shrink-0">
                        <span
                          className={`inline-flex items-center rounded-full px-[9px] py-[5px] text-[11px] ${stageBadgeClass(application.status)}`}
                        >
                          {application.status}
                        </span>
                      </div>
                      <p className="w-[82px] shrink-0 text-xs text-[#68716c] dark:text-zinc-400">
                        {formatDateShort(application.appliedDate)}
                      </p>
                      <p className="w-[190px] shrink-0 truncate pr-2 text-xs text-[#68716c] dark:text-zinc-400">
                        {nextStep ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Planning rail */}
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Upcoming interviews"
              className={`${card} w-full p-6`}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className={serifTitle}>Upcoming interviews</p>
              </div>
              {upcomingInterviews.length === 0 ? (
                <EmptyState
                  title="No interviews scheduled"
                  hint="Add one from an application's detail page once you land an interview."
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {upcomingInterviews.map((interview) =>
                    interview.application ? (
                      <li key={interview.id}>
                        <Link
                          href={`/applications/${interview.application.id}`}
                          className="group flex items-center gap-3"
                        >
                          <span className="flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-md bg-[#e7efeb] text-[#244a3a] dark:bg-emerald-950/60 dark:text-emerald-300">
                            <span className="text-[9px] font-bold uppercase leading-none">
                              {weekdayFormat.format(interview.scheduledAt)}
                            </span>
                            <span className="font-serif text-[19px] leading-tight">
                              {interview.scheduledAt.getDate()}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm text-[#18201d] group-hover:underline dark:text-zinc-100">
                                {interview.application.company}
                              </span>
                              <span className="shrink-0 text-[11px] text-[#68716c] dark:text-zinc-400">
                                {formatTime(interview.scheduledAt)}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-[#68716c] dark:text-zinc-400">
                              {interview.type}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </section>

            <section
              aria-label="Follow-up tasks"
              className={`${card} w-full p-6`}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className={serifTitle}>Follow-up tasks</p>
                <Link href="/follow-ups" className={actionLink}>
                  Add task +
                </Link>
              </div>
              {nextFollowUps.length === 0 ? (
                <EmptyState
                  title="No open follow-ups"
                  hint="Add tasks like “send thank-you email” from an application or the Follow-ups page."
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {nextFollowUps.map((followUp) =>
                    followUp.application ? (
                      <li
                        key={followUp.id}
                        className="flex items-start gap-3"
                      >
                        <form action={toggleFollowUp} className="shrink-0">
                          <input type="hidden" name="id" value={followUp.id} />
                          <button
                            type="submit"
                            aria-label={`Mark “${followUp.note ?? "follow-up"}” as done`}
                            title="Mark as done"
                            className="mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border border-[#c9cfcb] bg-white transition-colors hover:border-[#244a3a] dark:border-zinc-600 dark:bg-transparent dark:hover:border-emerald-400"
                          >
                            <span className="sr-only">Mark done</span>
                          </button>
                        </form>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/applications/${followUp.application.id}`}
                            className="block text-xs text-[#18201d] hover:underline dark:text-zinc-100"
                          >
                            {followUp.note || "Follow up"} ·{" "}
                            {followUp.application.company}
                          </Link>
                          <p
                            className={`text-[11px] ${
                              isOverdue(followUp.dueDate, followUp.done)
                                ? "text-[#9a5b59] dark:text-red-400"
                                : "text-[#98a09b] dark:text-zinc-500"
                            }`}
                          >
                            {dueLabel(followUp.dueDate)}
                          </p>
                        </div>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number;
  note?: string;
  icon: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-[#dde1dd] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex w-full items-start justify-between gap-2">
        <p className="text-xs font-semibold text-[#68716c] dark:text-zinc-400">
          {label}
        </p>
        <Image
          src={icon}
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 shrink-0 dark:brightness-200"
        />
      </div>
      <p className="font-serif text-[28px] leading-none text-[#18201d] dark:text-zinc-50">
        {value}
      </p>
      {note ? (
        <p className="text-[11px] text-[#98a09b] dark:text-zinc-500">{note}</p>
      ) : null}
    </div>
  );
}
