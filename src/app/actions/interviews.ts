"use server";

import { getAuthedClient } from "@/lib/supabase";
import {
  isInterviewType,
  isOutcome,
  parseDateInput,
  type ActionState,
} from "@/lib/domain";
import { id, optText, revalidateAll, text } from "@/lib/form";

/** Validates the shared interview fields; returns the column payload or an error state. */
function readInterviewFields(formData: FormData): { data: {
  scheduled_at: string;
  type: string;
  outcome: string;
  notes: string | null;
} } | { error: ActionState } {
  const scheduledAt = parseDateInput(formData.get("scheduledAt"));
  if (!scheduledAt) {
    return { error: { error: "A valid date and time is required.", ok: false } };
  }

  const type = text(formData, "type") || "Other";
  if (!isInterviewType(type)) {
    return { error: { error: "Invalid interview type.", ok: false } };
  }

  const outcome = text(formData, "outcome") || "Pending";
  if (!isOutcome(outcome)) {
    return { error: { error: "Invalid outcome.", ok: false } };
  }

  return {
    data: {
      scheduled_at: scheduledAt.toISOString(),
      type,
      outcome,
      notes: optText(formData, "notes"),
    },
  };
}

export async function createInterview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const applicationId = id(formData, "applicationId");
  if (!applicationId) return { error: "Missing application id.", ok: false };

  // RLS scopes this lookup to the owner, so linking to someone else's
  // application is treated as "not found".
  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) {
    return { error: "The linked application no longer exists.", ok: false };
  }

  const fields = readInterviewFields(formData);
  if ("error" in fields) return fields.error;

  const { error } = await supabase
    .from("interviews")
    .insert({ application_id: applicationId, ...fields.data });
  if (error) {
    return { error: "Could not add the interview. Please try again.", ok: false };
  }

  revalidateAll(applicationId);
  return { error: null, ok: true };
}

export async function updateInterview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const interviewId = id(formData, "id");
  const applicationId = id(formData, "applicationId");
  if (!interviewId || !applicationId) {
    return { error: "Missing interview id.", ok: false };
  }

  const fields = readInterviewFields(formData);
  if ("error" in fields) return fields.error;

  const { error } = await supabase
    .from("interviews")
    .update(fields.data)
    .eq("id", interviewId)
    .select("id")
    .single();
  if (error) {
    return { error: "Could not save the interview. Please try again.", ok: false };
  }

  revalidateAll(applicationId);
  return { error: null, ok: true };
}

export async function deleteInterview(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const interviewId = id(formData, "id");
  const applicationId = id(formData, "applicationId");
  if (interviewId) {
    await supabase.from("interviews").delete().eq("id", interviewId);
  }
  revalidateAll(applicationId);
}
