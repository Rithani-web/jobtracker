import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthedClient } from "@/lib/supabase";
import {
  toApplication,
  toContact,
  toFollowUp,
  toInterview,
  type ApplicationDetailRow,
} from "@/lib/types";
import {
  btnGhost,
  cardClass,
  chipClass,
  dueLabel,
  formatDate,
  formatDateTime,
  isOverdue,
} from "@/lib/domain";
import { OutcomeBadge, StatusBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { ApplicationTimeline } from "@/components/application-timeline";
import { ApplicationForm } from "@/components/application-form";
import { ContactForm } from "@/components/contact-form";
import { FollowUpForm } from "@/components/followup-form";
import { InterviewForm } from "@/components/interview-form";
import { NoteForm } from "@/components/note-form";
import {
  archiveApplication,
  deleteApplication,
  unarchiveApplication,
  updateApplication,
  updateApplicationNotes,
} from "@/app/actions/applications";
import {
  createInterview,
  deleteInterview,
  updateInterview,
} from "@/app/actions/interviews";
import {
  createContact,
  deleteContact,
  unlinkContact,
  updateContact,
} from "@/app/actions/contacts";
import {
  createFollowUp,
  deleteFollowUp,
  toggleFollowUp,
  updateFollowUp,
} from "@/app/actions/followups";

export const dynamic = "force-dynamic";

type Props = PageProps<"/applications/[id]">;

export default async function ApplicationDetailPage({ params }: Props) {
  const { id: applicationId } = await params;

  const { supabase, user } = await getAuthedClient();
  if (!user) return null; // proxy.ts redirects
  if (!applicationId || applicationId.length > 64) notFound();

  const { data } = await supabase
    .from("applications")
    .select(
      "*, interviews(*), follow_ups(*), contacts(*)",
    )
    .eq("id", applicationId)
    .order("scheduled_at", { referencedTable: "interviews", ascending: false })
    .order("due_date", { referencedTable: "follow_ups", ascending: true })
    .order("name", { referencedTable: "contacts", ascending: true })
    .maybeSingle();
  if (!data) notFound();

  const row = data as ApplicationDetailRow;
  const application = toApplication(row);
  const interviews = (row.interviews ?? []).map(toInterview);
  const followUps = (row.follow_ups ?? []).map(toFollowUp);
  const contacts = (row.contacts ?? []).map(toContact);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link
          href="/applications"
          className="text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Applications
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {application.company}
            </h1>
            <StatusBadge status={application.status} />
            {application.archivedAt ? (
              <span className={chipClass}>
                Archived {formatDate(application.archivedAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            {application.role} ·{" "}
            {application.appliedDate
              ? `Applied ${formatDate(application.appliedDate)}`
              : "Not applied yet"}{" "}
            · Created {formatDate(application.createdAt)} · Updated{" "}
            {formatDate(application.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <form
            action={
              application.archivedAt ? unarchiveApplication : archiveApplication
            }
          >
            <input type="hidden" name="id" value={application.id} />
            <button type="submit" className={btnGhost}>
              {application.archivedAt ? "Unarchive" : "Archive"}
            </button>
          </form>
          <form action={deleteApplication}>
            <input type="hidden" name="id" value={application.id} />
            <input type="hidden" name="redirectTo" value="/applications" />
            <ConfirmSubmit
              message={`Delete “${application.company} — ${application.role}” with all of its interviews and follow-ups?`}
            >
              Delete application
            </ConfirmSubmit>
          </form>
        </div>
      </header>

      <details className={`${cardClass} p-4 sm:p-5`}>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 select-none dark:text-zinc-100">
          Edit application
        </summary>
        <div className="mt-4">
          <ApplicationForm
            action={updateApplication}
            application={application}
            submitLabel="Save changes"
          />
        </div>
      </details>

      <section aria-label="Notes" className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Notes
        </h2>
        <NoteForm
          action={updateApplicationNotes}
          applicationId={application.id}
          notes={application.notes}
        />
      </section>

      <section aria-label="Interviews" className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Interviews ({interviews.length})
        </h2>

        <details
          className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          open={interviews.length === 0}
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-700 select-none dark:text-zinc-300">
            + Add interview
          </summary>
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            <InterviewForm
              action={createInterview}
              applicationId={application.id}
              submitLabel="Add interview"
            />
          </div>
        </details>

        {interviews.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No interviews yet"
              hint="Add phone screens, technical rounds, and onsites as they get scheduled."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {interviews.map((interview) => (
              <li key={interview.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDateTime(interview.scheduledAt)}
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {interview.type}
                      </span>
                      <OutcomeBadge outcome={interview.outcome} />
                    </p>
                    {interview.notes ? (
                      <p className="mt-1 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                        {interview.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={deleteInterview}>
                      <input type="hidden" name="id" value={interview.id} />
                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />
                      <ConfirmSubmit message="Delete this interview?">
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                    Edit
                  </summary>
                  <div className="mt-3">
                    <InterviewForm
                      action={updateInterview}
                      interview={interview}
                      submitLabel="Save interview"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Follow-ups" className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Follow-ups ({followUps.length})
        </h2>

        <details
          className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          open={followUps.length === 0}
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-700 select-none dark:text-zinc-300">
            + Add follow-up
          </summary>
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            <FollowUpForm
              action={createFollowUp}
              fixedApplicationId={application.id}
              submitLabel="Add follow-up"
            />
          </div>
        </details>

        {followUps.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No follow-ups yet"
              hint="Track tasks like “send thank-you email” or “ping the recruiter”."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex min-w-0 items-start gap-3">
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
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          followUp.done
                            ? "text-zinc-400 line-through dark:text-zinc-500"
                            : isOverdue(followUp.dueDate, followUp.done)
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {dueLabel(followUp.dueDate)} ·{" "}
                        {formatDate(followUp.dueDate)}
                      </p>
                      {followUp.note ? (
                        <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                          {followUp.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={deleteFollowUp}>
                      <input type="hidden" name="id" value={followUp.id} />
                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />
                      <ConfirmSubmit message="Delete this follow-up?">
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
                <details className="mt-2 pl-8">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                    Edit
                  </summary>
                  <div className="mt-3">
                    <FollowUpForm
                      action={updateFollowUp}
                      followUp={followUp}
                      submitLabel="Save follow-up"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ApplicationTimeline interviews={interviews} followUps={followUps} />

      <section aria-label="Contacts" className={`${cardClass} p-4 sm:p-5`}>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Contacts ({contacts.length})
        </h2>

        <details
          className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          open={contacts.length === 0}
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-700 select-none dark:text-zinc-300">
            + Add contact
          </summary>
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            <ContactForm
              action={createContact}
              fixedApplicationId={application.id}
              submitLabel="Add contact"
            />
          </div>
        </details>

        {contacts.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No contacts yet"
              hint="Keep recruiters, referrers, and interviewers connected to this application."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {contacts.map((contact) => (
              <li key={contact.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {contact.name}
                      {contact.company ? (
                        <span className="font-normal text-zinc-500 dark:text-zinc-400">
                          {" "}
                          · {contact.company}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {contact.email ? <a href={`mailto:${contact.email}`} className="underline-offset-4 hover:underline">{contact.email}</a> : null}
                      {contact.phone ? <a href={`tel:${contact.phone}`} className="underline-offset-4 hover:underline">{contact.phone}</a> : null}
                    </p>
                    {contact.notes ? (
                      <p className="mt-1 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                        {contact.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={unlinkContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Unlink
                      </button>
                    </form>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <input
                        type="hidden"
                        name="applicationId"
                        value={application.id}
                      />
                      <ConfirmSubmit
                        message={`Delete contact “${contact.name}”?`}
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                    Edit
                  </summary>
                  <div className="mt-3">
                    <ContactForm
                      action={updateContact}
                      contact={contact}
                      fixedApplicationId={application.id}
                      submitLabel="Save contact"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
