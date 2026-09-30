import Link from "next/link";
import { getAuthedClient } from "@/lib/supabase";
import { toContact, type AppSummary, type Contact } from "@/lib/types";
import { cardClass } from "@/lib/domain";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { ContactForm } from "@/components/contact-form";
import {
  createContact,
  deleteContact,
  updateContact,
} from "@/app/actions/contacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return null; // proxy.ts redirects

  const [contactsRes, applicationsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, applications(id, company, role)")
      .order("name"),
    supabase
      .from("applications")
      .select("id, company, role")
      .order("company"),
  ]);

  const applications = (applicationsRes.data ?? []) as AppSummary[];
  const contacts: (Contact & { application: AppSummary | null })[] = (
    contactsRes.data ?? []
  ).map((row) => {
    const contact = toContact(row);
    const embed = row as { applications: AppSummary | AppSummary[] | null };
    const application = Array.isArray(embed.applications)
      ? embed.applications[0]
      : embed.applications;
    return { ...contact, application: application ?? null };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Contacts
      </h1>

      <details className={`${cardClass} p-4 sm:p-5`} open={contacts.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 select-none dark:text-zinc-100">
          + Add contact
        </summary>
        <div className="mt-4">
          <ContactForm
            action={createContact}
            applications={applications}
            submitLabel="Create contact"
          />
        </div>
      </details>

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          hint="Add recruiters, referrers, and interviewers — optionally linked to an application."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {contact.name}
                  {contact.company ? (
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      {" "}
                      · {contact.company}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {contact.email}
                    </a>
                  ) : null}
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  ) : null}
                </p>
                {contact.application ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Linked to{" "}
                    <Link
                      href={`/applications/${contact.application.id}`}
                      className="font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
                    >
                      {contact.application.company} —{" "}
                      {contact.application.role}
                    </Link>
                  </p>
                ) : null}
                {contact.notes ? (
                  <p className="mt-1 text-sm whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                    {contact.notes}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 select-none hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                    Edit
                  </summary>
                  <div className="mt-3">
                    <ContactForm
                      action={updateContact}
                      contact={contact}
                      applications={applications}
                      submitLabel="Save contact"
                    />
                  </div>
                </details>
              </div>
              <form action={deleteContact} className="shrink-0">
                <input type="hidden" name="id" value={contact.id} />
                {contact.applicationId ? (
                  <input
                    type="hidden"
                    name="applicationId"
                    value={contact.applicationId}
                  />
                ) : null}
                <ConfirmSubmit message={`Delete contact “${contact.name}”?`}>
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
