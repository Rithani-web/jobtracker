"use client";

import { useActionState } from "react";
import type { Application, FollowUp } from "@/lib/types";
import type { ActionState } from "@/lib/domain";
import {
  initialActionState,
  inputClass,
  labelClass,
  toDateInput,
} from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  followUp?: FollowUp;
  /**
   * Applications to offer in the select. When omitted, the form targets
   * `fixedApplicationId` via a hidden input instead.
   */
  applications?: Pick<Application, "id" | "company" | "role">[];
  fixedApplicationId?: string;
  submitLabel?: string;
};

export function FollowUpForm({
  action,
  followUp,
  applications,
  fixedApplicationId,
  submitLabel = "Save follow-up",
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {followUp ? <input type="hidden" name="id" value={followUp.id} /> : null}
      {applications ? null : fixedApplicationId ? (
        <input
          type="hidden"
          name="applicationId"
          value={followUp?.applicationId ?? fixedApplicationId}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {applications ? (
          <div>
            <label htmlFor="followup-application" className={labelClass}>
              Application
            </label>
            <select
              id="followup-application"
              name="applicationId"
              required
              defaultValue={followUp?.applicationId ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Select an application…
              </option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.company} — {application.role}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="dueDate" className={labelClass}>
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={toDateInput(followUp?.dueDate ?? defaultDue())}
            className={inputClass}
          />
        </div>

        <div className="flex items-center">
          <label
            htmlFor="done"
            className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <input
              id="done"
              name="done"
              type="checkbox"
              defaultChecked={followUp?.done ?? false}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            Done
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="followup-note" className={labelClass}>
          Note <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="followup-note"
          name="note"
          rows={2}
          defaultValue={followUp?.note ?? ""}
          placeholder="Send a thank-you email to the panel…"
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

function defaultDue(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
}
