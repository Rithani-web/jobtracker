"use client";

import { useActionState } from "react";
import type { Interview } from "@/lib/types";
import type { ActionState } from "@/lib/domain";
import {
  INTERVIEW_TYPES,
  OUTCOMES,
  initialActionState,
  inputClass,
  labelClass,
  toDateTimeInput,
} from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Required when creating (links the interview to its application). */
  applicationId?: string;
  interview?: Interview;
  submitLabel?: string;
};

export function InterviewForm({
  action,
  applicationId,
  interview,
  submitLabel = "Save interview",
}: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const linkedApplicationId = interview?.applicationId ?? applicationId;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {interview ? (
        <input type="hidden" name="id" value={interview.id} />
      ) : null}
      {linkedApplicationId ? (
        <input type="hidden" name="applicationId" value={linkedApplicationId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="scheduledAt" className={labelClass}>
            Scheduled at
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeInput(
              interview?.scheduledAt ?? defaultSlot(),
            )}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={interview?.type ?? "Other"}
            className={inputClass}
          >
            {INTERVIEW_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="outcome" className={labelClass}>
            Outcome
          </label>
          <select
            id="outcome"
            name="outcome"
            defaultValue={interview?.outcome ?? "Pending"}
            className={inputClass}
          >
            {OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="interview-notes" className={labelClass}>
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="interview-notes"
          name="notes"
          rows={2}
          defaultValue={interview?.notes ?? ""}
          placeholder="Interviewer names, topics to prepare…"
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

/** Convenience default: tomorrow at 10:00 local time. */
function defaultSlot(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}
