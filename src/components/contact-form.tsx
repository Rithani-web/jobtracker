"use client";

import { useActionState } from "react";
import type { Application, Contact } from "@/lib/types";
import type { ActionState } from "@/lib/domain";
import { initialActionState, inputClass, labelClass } from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  contact?: Contact;
  /**
   * Applications to offer in the "linked application" select. When omitted,
   * the form targets `fixedApplicationId` via a hidden input instead.
   */
  applications?: Pick<Application, "id" | "company" | "role">[];
  fixedApplicationId?: string;
  submitLabel?: string;
};

export function ContactForm({
  action,
  contact,
  applications,
  fixedApplicationId,
  submitLabel = "Save contact",
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {contact ? <input type="hidden" name="id" value={contact.id} /> : null}
      {applications ? null : fixedApplicationId ? (
        <input
          type="hidden"
          name="applicationId"
          value={contact?.applicationId ?? fixedApplicationId}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            defaultValue={contact?.name}
            placeholder="Jordan Smith"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact-company" className={labelClass}>
            Company{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="contact-company"
            name="company"
            type="text"
            maxLength={200}
            defaultValue={contact?.company ?? ""}
            placeholder="Acme Corp"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={320}
            defaultValue={contact?.email ?? ""}
            placeholder="jordan@acme.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={contact?.phone ?? ""}
            placeholder="+1 555 010 1234"
            className={inputClass}
          />
        </div>

        {applications ? (
          <div className="sm:col-span-2">
            <label htmlFor="contact-application" className={labelClass}>
              Linked application{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <select
              id="contact-application"
              name="applicationId"
              defaultValue={contact?.applicationId ?? ""}
              className={inputClass}
            >
              <option value="">— None —</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.company} — {application.role}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="contact-notes" className={labelClass}>
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="contact-notes"
          name="notes"
          rows={2}
          defaultValue={contact?.notes ?? ""}
          placeholder="Recruiter for the frontend role, met at the conference…"
          className={`${inputClass} resize-y`}
        />
      </div>

      <FormMessages state={state} />

      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
