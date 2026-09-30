"use server";

import { getAuthedClient } from "@/lib/supabase";
import { parseDateInput, type ActionState } from "@/lib/domain";
import {
  id,
  isCheckboxChecked,
  optText,
  revalidateAll,
} from "@/lib/form";

/**
 * Resolves the required "application" select value. RLS scopes the lookup to
 * the owner, so a foreign application id resolves to null.
 */
async function resolveApplicationId(
  supabase: Awaited<ReturnType<typeof getAuthedClient>>["supabase"],
  formData: FormData,
): Promise<{ applicationId: string | null; error: string | null }> {
  const applicationId = id(formData, "applicationId");
  if (!applicationId) {
    return {
      applicationId: null,
      error: "Select the application this follow-up belongs to.",
    };
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) {
    return {
      applicationId: null,
      error: "The selected application no longer exists.",
    };
  }
  return { applicationId, error: null };
}

export async function createFollowUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const link = await resolveApplicationId(supabase, formData);
  if (link.error || !link.applicationId) {
    return { error: link.error ?? "Missing application.", ok: false };
  }

  const dueDate = parseDateInput(formData.get("dueDate"));
  if (!dueDate) return { error: "A valid due date is required.", ok: false };

  const { error } = await supabase.from("follow_ups").insert({
    application_id: link.applicationId,
    due_date: dueDate.toISOString(),
    done: isCheckboxChecked(formData, "done"),
    note: optText(formData, "note"),
  });
  if (error) {
    return { error: "Could not add the follow-up. Please try again.", ok: false };
  }

  revalidateAll(link.applicationId);
  return { error: null, ok: true };
}

export async function updateFollowUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const followUpId = id(formData, "id");
  if (!followUpId) return { error: "Missing follow-up id.", ok: false };

  const link = await resolveApplicationId(supabase, formData);
  if (link.error || !link.applicationId) {
    return { error: link.error ?? "Missing application.", ok: false };
  }

  const dueDate = parseDateInput(formData.get("dueDate"));
  if (!dueDate) return { error: "A valid due date is required.", ok: false };

  const { error } = await supabase
    .from("follow_ups")
    .update({
      application_id: link.applicationId,
      due_date: dueDate.toISOString(),
      done: isCheckboxChecked(formData, "done"),
      note: optText(formData, "note"),
    })
    .eq("id", followUpId)
    .select("id")
    .single();
  if (error) {
    return { error: "Could not save the follow-up. Please try again.", ok: false };
  }

  revalidateAll(link.applicationId);
  return { error: null, ok: true };
}

/** Flips a follow-up between open and done. */
export async function toggleFollowUp(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const followUpId = id(formData, "id");
  if (!followUpId) return;

  const { data: existing } = await supabase
    .from("follow_ups")
    .select("done, application_id")
    .eq("id", followUpId)
    .maybeSingle();
  if (!existing) return;

  await supabase
    .from("follow_ups")
    .update({ done: !existing.done })
    .eq("id", followUpId);
  revalidateAll(existing.application_id);
}

export async function deleteFollowUp(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const followUpId = id(formData, "id");
  const applicationId = id(formData, "applicationId");
  if (followUpId) {
    await supabase.from("follow_ups").delete().eq("id", followUpId);
  }
  revalidateAll(applicationId);
}
