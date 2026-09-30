"use client";

import { useActionState } from "react";
import type { Application } from "@/lib/types";
import type { ActionState } from "@/lib/domain";
import {
  STATUSES,
  inputClass,
  labelClass,
  toDateInput,
  initialActionState,
} from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  application?: Application;
  submitLabel?: string;
};


export function ApplicationForm({
  action,
  application,
  submitLabel = "Save application",
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {application ? <input type="hidden" name="id" value={application.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className={labelClass}>
            Company
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            maxLength={200}
            defaultValue={application?.company}
            placeholder="Acme Corp"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="role" className={labelClass}>
            Role
          </label>
          <input
            id="role"
            name="role"
            type="text"
            required
            maxLength={200}
            defaultValue={application?.role}
            placeholder="Frontend Engineer"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={application?.status ?? "Saved"}
            className={inputClass}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="appliedDate" className={labelClass}>
            Applied date{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="appliedDate"
            name="appliedDate"
            type="date"
            defaultValue={toDateInput(application?.appliedDate)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={application?.notes ?? ""}
          placeholder="Job posting link, salary expectations, referral name…"
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
