"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/domain";
import {
  initialActionState,
  inputClass,
} from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";

/**
 * Create / update / clear form for an application's notes. Saving an empty
 * textarea deletes the note.
 */
export function NoteForm({
  action,
  applicationId,
  notes,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  applicationId: string;
  notes: string | null;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={applicationId} />
      <textarea
        name="notes"
        rows={4}
        defaultValue={notes ?? ""}
        placeholder="Write a note — recruiter conversations, salary details, what stood out in the interview…"
        className={`${inputClass} mt-0 resize-y`}
      />
      <FormMessages state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving note…">Save note</SubmitButton>
        {notes ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Saving an empty note clears it.
          </span>
        ) : null}
      </div>
    </form>
  );
}
