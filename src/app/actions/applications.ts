"use server";

import { redirect } from "next/navigation";
import { getAuthedClient } from "@/lib/supabase";
import { isStatus, parseDateInput, type ActionState } from "@/lib/domain";
import { id, optText, revalidateAll, text } from "@/lib/form";

export async function createApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const company = text(formData, "company");
  const role = text(formData, "role");
  if (!company) return { error: "Company is required.", ok: false };
  if (!role) return { error: "Role is required.", ok: false };

  const status = text(formData, "status") || "Saved";
  if (!isStatus(status)) return { error: "Invalid status.", ok: false };

  const appliedDate = parseDateInput(formData.get("appliedDate"));
  const notes = optText(formData, "notes");

  const { data, error } = await supabase
    .from("applications")
    .insert({
      company,
      role,
      status,
      applied_date: appliedDate ? appliedDate.toISOString() : null,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Could not create the application. Please try again.", ok: false };
  }

  revalidateAll(data.id);
  redirect(`/applications/${data.id}`);
}

export async function updateApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const applicationId = id(formData, "id");
  if (!applicationId) return { error: "Missing application id.", ok: false };

  const company = text(formData, "company");
  const role = text(formData, "role");
  if (!company) return { error: "Company is required.", ok: false };
  if (!role) return { error: "Role is required.", ok: false };

  const status = text(formData, "status") || "Saved";
  if (!isStatus(status)) return { error: "Invalid status.", ok: false };

  const appliedDate = parseDateInput(formData.get("appliedDate"));
  const notes = optText(formData, "notes");

  // RLS scopes the update to the owner; zero rows → PGRST116 → not found.
  const { error } = await supabase
    .from("applications")
    .update({
      company,
      role,
      status,
      applied_date: appliedDate ? appliedDate.toISOString() : null,
      notes,
    })
    .eq("id", applicationId)
    .select("id")
    .single();

  if (error) {
    return { error: "Could not save the application. Please try again.", ok: false };
  }

  revalidateAll(applicationId);
  return { error: null, ok: true };
}

export async function deleteApplication(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const applicationId = id(formData, "id");
  if (applicationId) {
    await supabase.from("applications").delete().eq("id", applicationId);
  }
  revalidateAll(applicationId);

  const redirectTo = text(formData, "redirectTo");
  if (redirectTo.startsWith("/")) redirect(redirectTo);
}

/**
 * Soft-archives an application: sets archived_at so it leaves the default
 * (Active) list view. The row itself stays — dashboard metrics keep counting
 * and its interviews / follow-ups / contacts are untouched. Reversible via
 * unarchiveApplication. RLS scopes the update to the owner; a foreign or
 * missing id updates zero rows.
 */
export async function archiveApplication(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const applicationId = id(formData, "id");
  if (applicationId) {
    await supabase
      .from("applications")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", applicationId);
  }
  revalidateAll(applicationId);
}

export async function unarchiveApplication(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const applicationId = id(formData, "id");
  if (applicationId) {
    await supabase
      .from("applications")
      .update({ archived_at: null })
      .eq("id", applicationId);
  }
  revalidateAll(applicationId);
}

/**
 * Saves the application's notes (create / update / clear — clearing the field
 * deletes the note). Kept as its own action so the notes panel can be edited
 * independently of the rest of the application.
 */
export async function updateApplicationNotes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const applicationId = id(formData, "id");
  if (!applicationId) return { error: "Missing application id.", ok: false };

  const { error } = await supabase
    .from("applications")
    .update({ notes: optText(formData, "notes") })
    .eq("id", applicationId)
    .select("id")
    .single();

  if (error) {
    return { error: "Could not save the note. Please try again.", ok: false };
  }

  revalidateAll(applicationId);
  return { error: null, ok: true };
}
