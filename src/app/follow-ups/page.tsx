import Link from "next/link";
import { getAuthedClient } from "@/lib/supabase";
import {
  toFollowUp,
  type AppSummary,
  type FollowUp,
} from "@/lib/types";
import { cardClass, dueLabel, formatDate, isOverdue } from "@/lib/domain";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { FollowUpForm } from "@/components/followup-form";
import {
  createFollowUp,
  deleteFollowUp,
  toggleFollowUp,
  updateFollowUp,
} from "@/app/actions/followups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups" };

const VIEWS = ["Open", "Done", "All"] as const;

type Props = PageProps<"/follow-ups">;

export default async function FollowUpsPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const activeView =
    typeof view === "string" && (VIEWS as readonly string[]).includes(view)
      ? (view as (typeof VIEWS)[number])
      : "Open";

  const { supabase, user } = await getAuthedClient();
  if (!user) return null; // proxy.ts redirects

  let query = supabase
    .from("follow_ups")
    .select("id, application_id, due_date, done, note, applications(id, company, role)")
    .order("due_date");
  if (activeView === "Open") query = query.eq("done", false);
  if (activeView === "Done") query = query.eq("done", true);

  const [followUpsRes, applicationsRes] = await Promise.all([
    query,
    supabase.from("applications").select("id, company, role").order("company"),
  ]);

  const applications = (applicationsRes.data ?? []) as AppSummary[];
  const followUps: (FollowUp & { application: AppSummary | null })[] = (
    followUpsRes.data ?? []
  ).map((row) => {
    const followUp = toFollowUp(row);
    const embed = row as { applications: AppSummary | AppSummary[] | null };
    const application = Array.isArray(embed.applications)
      ? embed.applications[0]
      : embed.applications;
    return { ...followUp, application: application ?? null };
  });

  const emptyHint =
    activeView === "Open"
      ? "Nothing outstanding — add a task or switch to “All” to see completed ones."
      : activeView === "Done"
        ? "No completed follow-ups yet. Tick the circle on an open one when it's done."
        : "Add your first follow-up with the form above.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Follow-ups
        </h1>
        <nav aria-label="Filter follow-ups" className="flex flex-wrap items-center gap-1">
          {VIEWS.map((option) => (
            <Link
              key={option}
              href={option === "Open" ? "/follow-ups" : `/follow-ups?view=${option}`}
              aria-current={activeView === option ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeView === option
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>
      </div>

      <details className={`${cardClass} p-4 sm:p-5`} open={followUps.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 select-none dark:text-zinc-100">
          + Add follow-up
        </summary>
        <div className="mt-4">
          <FollowUpForm
            action={createFollowUp}
            applications={applications}
            submitLabel="Create follow-up"
          />
        </div>
      </details>

      {followUps.length === 0 ? (
        <EmptyState title={`No ${activeView.toLowerCase()} follow-ups`} hint={emptyHint} />
      ) : (
        <ul className="flex flex-col gap-3">
          {followUps.map((followUp) => (
            <li
              key={followUp.id}
              className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <form action={toggleFollowUp} className="shrink-0 pt-0.5">
                  <input type="hidden" name="id" value={followUp.id} />
                  <button
                    type="submit"
                    aria-label={
                      followUp.done
                        ? "Reopen follow-up"
                        : "Mark follow-up as done"
                    }
                    title={followUp.done ? "Reopen" : "Mark as done"}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      followUp.done
                        ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                        : "border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-600 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    {followUp.done ? "✓" : null}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      followUp.done
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : isOverdue(followUp.dueDate, followUp.done)
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {dueLabel(followUp.dueDate)} · {formatDate(followUp.dueDate)}
                  </p>
                  {followUp.note ? (
                    <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                      {followUp.note}
                    </p>
                  ) : null}
                  {followUp.application ? (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      For{" "}
                      <Link
                        href={`/applications/${followUp.application.id}`}
                        className="font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                      >
                        {followUp.application.company} — {followUp.application.role}
                      </Link>
                    </p>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                      Edit
                    </summary>
                    <div className="mt-3">
                      <FollowUpForm
                        action={updateFollowUp}
                        followUp={followUp}
                        applications={applications}
                        submitLabel="Save follow-up"
                      />
                    </div>
                  </details>
                </div>
              </div>
              <form action={deleteFollowUp} className="shrink-0">
                <input type="hidden" name="id" value={followUp.id} />
                <input
                  type="hidden"
                  name="applicationId"
                  value={followUp.applicationId}
                />
                <ConfirmSubmit message="Delete this follow-up?">
                  Delete
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
