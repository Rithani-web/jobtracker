// Read-only merged timeline for one application: upcoming interviews and open
// follow-ups pinned on top, past activity newest-first. Expandable lines use
// native <details>, so this stays a server component with no client JS.

import { EmptyState } from "@/components/empty-state";
import { OutcomeBadge } from "@/components/badges";
import {
  cardClass,
  chipClass,
  dueLabel,
  formatDate,
  formatDateTime,
  isOverdue,
} from "@/lib/domain";
import type { FollowUp, Interview } from "@/lib/types";

const subheadClass =
  "mb-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500";

const mutedClass = "text-sm text-zinc-500 dark:text-zinc-400";

const listClass =
  "flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800";

function InterviewLine({ interview }: { interview: Interview }) {
  const headline = (
    <>
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"
      />
      <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {formatDateTime(interview.scheduledAt)}
      </span>
      <span className={chipClass}>{interview.type}</span>
      <OutcomeBadge outcome={interview.outcome} />
    </>
  );

  if (!interview.notes) {
    return <div className="flex flex-wrap items-center gap-2">{headline}</div>;
  }
  return (
    <details>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 select-none">
        {headline}
      </summary>
      <p className="mt-2 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
        {interview.notes}
      </p>
    </details>
  );
}

function FollowUpLine({ followUp }: { followUp: FollowUp }) {
  const headline = (
    <>
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          followUp.done
            ? "bg-zinc-300 dark:bg-zinc-700"
            : "bg-sky-500"
        }`}
      />
      <span
        className={`min-w-0 text-sm font-medium ${
          followUp.done
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : isOverdue(followUp.dueDate, followUp.done)
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {dueLabel(followUp.dueDate)} · {formatDate(followUp.dueDate)}
      </span>
      <span className={chipClass}>Follow-up</span>
    </>
  );

  if (!followUp.note) {
    return <div className="flex flex-wrap items-center gap-2">{headline}</div>;
  }
  return (
    <details>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 select-none">
        {headline}
      </summary>
      <p className="mt-2 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
        {followUp.note}
      </p>
    </details>
  );
}

type PastEvent =
  | { kind: "interview"; id: string; time: Date; interview: Interview }
  | { kind: "followUp"; id: string; time: Date; followUp: FollowUp };

export function ApplicationTimeline({
  interviews,
  followUps,
}: {
  interviews: Interview[];
  followUps: FollowUp[];
}) {
  const now = new Date();

  const upcomingInterviews = interviews
    .filter((i) => i.scheduledAt.getTime() > now.getTime())
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const openFollowUps = followUps
    .filter((f) => !f.done)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const pastEvents: PastEvent[] = [
    ...interviews
      .filter((i) => i.scheduledAt.getTime() <= now.getTime())
      .map((interview) => ({
        kind: "interview" as const,
        id: interview.id,
        time: interview.scheduledAt,
        interview,
      })),
    ...followUps
      .filter((f) => f.done)
      .map((followUp) => ({
        kind: "followUp" as const,
        id: followUp.id,
        time: followUp.dueDate,
        followUp,
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const total = interviews.length + followUps.length;
  const upcomingEmpty =
    upcomingInterviews.length === 0 && openFollowUps.length === 0;

  return (
    <section aria-label="Timeline" className={`${cardClass} p-4 sm:p-5`}>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Timeline ({total})
      </h2>

      {total === 0 ? (
        <EmptyState
          title="No activity yet"
          hint="Add an interview or follow-up above and it will show up here."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className={subheadClass}>Upcoming</h3>
            {upcomingEmpty ? (
              <p className={mutedClass}>Nothing scheduled ahead.</p>
            ) : (
              <ul className={listClass}>
                {upcomingInterviews.map((interview) => (
                  <li
                    key={interview.id}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <InterviewLine interview={interview} />
                  </li>
                ))}
                {openFollowUps.map((followUp) => (
                  <li key={followUp.id} className="py-3 first:pt-0 last:pb-0">
                    <FollowUpLine followUp={followUp} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className={subheadClass}>Past</h3>
            {pastEvents.length === 0 ? (
              <p className={mutedClass}>Nothing completed yet.</p>
            ) : (
              <ul className={listClass}>
                {pastEvents.map((event) => (
                  <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                    {event.kind === "interview" ? (
                      <InterviewLine interview={event.interview} />
                    ) : (
                      <FollowUpLine followUp={event.followUp} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
