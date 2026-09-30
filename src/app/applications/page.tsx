import Link from "next/link";
import { getAuthedClient } from "@/lib/supabase";
import { toApplication, type Application } from "@/lib/types";
import {
  STATUSES,
  btnSmall,
  cardClass,
  chipClass,
  formatDate,
  isStatus,
} from "@/lib/domain";
import { StatusBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { ApplicationForm } from "@/components/application-form";
import {
  archiveApplication,
  createApplication,
  deleteApplication,
  unarchiveApplication,
} from "@/app/actions/applications";

type ArchiveView = "active" | "archived" | "all";

/** List URL carrying the given status / archive-state filters (omitting defaults). */
function hrefWith(status: string | null, view: ArchiveView): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (view !== "active") params.set("view", view);
  const qs = params.toString();
  return qs ? `/applications?${qs}` : "/applications";
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Applications" };

type Props = PageProps<"/applications">;

export default async function ApplicationsPage({ searchParams }: Props) {
  const { status, view } = await searchParams;
  const filter = typeof status === "string" && isStatus(status) ? status : null;
  const archiveView: ArchiveView =
    view === "archived" ? "archived" : view === "all" ? "all" : "active";
  const viewHref = (v: ArchiveView) => hrefWith(filter, v);
  const statusHref = (s: string | null) => hrefWith(s, archiveView);

  const { supabase, user } = await getAuthedClient();
  if (!user) return null; // proxy.ts redirects unauthenticated visitors

  let query = supabase
    .from("applications")
    .select(
      "id, company, role, status, archived_at, applied_date, notes, created_at, updated_at, interviews(count), follow_ups(count), contacts(count)",
    )
    .order(archiveView === "archived" ? "archived_at" : "updated_at", {
      ascending: false,
    });
  if (archiveView === "active") query = query.is("archived_at", null);
  else if (archiveView === "archived")
    query = query.not("archived_at", "is", null);
  if (filter) query = query.eq("status", filter);

  const { data } = await query;
  const applications = (data ?? []).map((row) => {
    const application = toApplication(row);
    const counts = row as {
      interviews: { count: number }[];
      follow_ups: { count: number }[];
      contacts: { count: number }[];
    };
    return {
      application,
      interviews: counts.interviews[0]?.count ?? 0,
      followUps: counts.follow_ups[0]?.count ?? 0,
      contacts: counts.contacts[0]?.count ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Applications
        </h1>
        <div className="flex flex-wrap items-center gap-1 sm:gap-3">
          <nav
            aria-label="Filter by archive state"
            className="flex flex-wrap items-center gap-1"
          >
            <FilterPill href={viewHref("active")} active={archiveView === "active"}>
              Active
            </FilterPill>
            <FilterPill
              href={viewHref("archived")}
              active={archiveView === "archived"}
            >
              Archived
            </FilterPill>
            <FilterPill href={viewHref("all")} active={archiveView === "all"}>
              All
            </FilterPill>
          </nav>
          <nav
            aria-label="Filter by status"
            className="flex flex-wrap items-center gap-1"
          >
            <FilterPill href={statusHref(null)} active={!filter}>
              All
            </FilterPill>
            {STATUSES.map((statusOption) => (
              <FilterPill
                key={statusOption}
                href={statusHref(statusOption)}
                active={filter === statusOption}
              >
                {statusOption}
              </FilterPill>
            ))}
          </nav>
        </div>
      </div>

      <details
        className="group rounded-xl border border-dashed border-zinc-300 p-4 transition-colors hover:border-zinc-400 hover:bg-white open:border-solid open:border-zinc-200 open:bg-white sm:p-5 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-950 dark:open:border-zinc-800 dark:open:bg-zinc-950"
        open={applications.length === 0}
      >
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 select-none dark:text-zinc-100">
          + New application
        </summary>
        <div className="mt-4">
          <ApplicationForm action={createApplication} submitLabel="Create application" />
        </div>
      </details>

      {applications.length === 0 ? (
        <EmptyState
          title={
            archiveView === "archived"
              ? "No archived applications"
              : filter
                ? `No ${filter} applications`
                : "No applications yet"
          }
          hint={
            archiveView === "archived"
              ? "Applications you archive land here — use the Archive button on a row or on an application's page."
              : filter
                ? "Try a different status filter, or add a new application below."
                : "Add your first application using the form above — company and role are all you need to start."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map(({ application, interviews, followUps, contacts }) => (
            <ApplicationRow
              key={application.id}
              application={application}
              interviews={interviews}
              followUps={followUps}
              contacts={contacts}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationRow({
  application,
  interviews,
  followUps,
  contacts,
}: {
  application: Application;
  interviews: number;
  followUps: number;
  contacts: number;
}) {
  return (
    <li
      className={`${cardClass} group flex flex-col gap-3 p-4 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-zinc-300 hover:shadow-md focus-within:border-zinc-300 motion-safe:hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:hover:border-zinc-700 dark:focus-within:border-zinc-700`}
    >
      <div className="min-w-0">
        <Link
          href={`/applications/${application.id}`}
          className="text-[15px] font-semibold text-zinc-950 underline-offset-4 group-hover:underline dark:text-zinc-50"
        >
          {application.company}
          <span className="font-normal text-zinc-400 dark:text-zinc-500">
            {" "}
            ·{" "}
          </span>
          <span className="font-normal text-zinc-700 dark:text-zinc-300">
            {application.role}
          </span>
        </Link>
        <p className="mt-1 text-[13px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {application.appliedDate
            ? `Applied ${formatDate(application.appliedDate)} · `
            : "Not applied yet · "}
          {interviews} interview{interviews === 1 ? "" : "s"} ·{" "}
          {followUps} follow-up{followUps === 1 ? "" : "s"} ·{" "}
          {contacts} contact{contacts === 1 ? "" : "s"}
          {application.archivedAt ? (
            <span className={`${chipClass} ml-1.5 whitespace-nowrap align-middle`}>
              Archived {formatDate(application.archivedAt)}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
        <StatusBadge status={application.status} />
        <form
          action={
            application.archivedAt ? unarchiveApplication : archiveApplication
          }
        >
          <input type="hidden" name="id" value={application.id} />
          <button type="submit" className={btnSmall}>
            {application.archivedAt ? "Unarchive" : "Archive"}
          </button>
        </form>
        <form action={deleteApplication}>
          <input type="hidden" name="id" value={application.id} />
          <ConfirmSubmit
            message={`Delete “${application.company} — ${application.role}” with all of its interviews and follow-ups?`}
          >
            Delete
          </ConfirmSubmit>
        </form>
      </div>
    </li>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}
