"use server";

import { getAuthedClient } from "@/lib/supabase";
import type { ActionState } from "@/lib/domain";
import { id, optText, revalidateAll, text } from "@/lib/form";

/**
 * Resolves the optional "linked application" select value. RLS scopes the
 * lookup to the owner, so a foreign application id resolves to null.
 */
async function resolveApplicationLink(
  supabase: Awaited<ReturnType<typeof getAuthedClient>>["supabase"],
  formData: FormData,
): Promise<{ applicationId: string | null; error: string | null }> {
  const applicationId = id(formData, "applicationId");
  if (!applicationId) return { applicationId: null, error: null };

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

export async function createContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const name = text(formData, "name");
  if (!name) return { error: "Name is required.", ok: false };

  const link = await resolveApplicationLink(supabase, formData);
  if (link.error) return { error: link.error, ok: false };

  const { error } = await supabase.from("contacts").insert({
    name,
    company: optText(formData, "company"),
    email: optText(formData, "email"),
    phone: optText(formData, "phone"),
    notes: optText(formData, "notes"),
    application_id: link.applicationId,
  });
  if (error) {
    return { error: "Could not add the contact. Please try again.", ok: false };
  }

  revalidateAll(link.applicationId);
  return { error: null, ok: true };
}

export async function updateContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { error: "Please sign in first.", ok: false };

  const contactId = id(formData, "id");
  if (!contactId) return { error: "Missing contact id.", ok: false };

  const name = text(formData, "name");
  if (!name) return { error: "Name is required.", ok: false };

  const link = await resolveApplicationLink(supabase, formData);
  if (link.error) return { error: link.error, ok: false };

  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      company: optText(formData, "company"),
      email: optText(formData, "email"),
      phone: optText(formData, "phone"),
      notes: optText(formData, "notes"),
      application_id: link.applicationId,
    })
    .eq("id", contactId)
    .select("id")
    .single();
  if (error) {
    return { error: "Could not save the contact. Please try again.", ok: false };
  }

  revalidateAll(link.applicationId);
  return { error: null, ok: true };
}

export async function deleteContact(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const contactId = id(formData, "id");
  const applicationId = id(formData, "applicationId");
  if (contactId) {
    await supabase.from("contacts").delete().eq("id", contactId);
  }
  revalidateAll(applicationId);
}

/** Detaches a contact from its application without deleting the contact. */
export async function unlinkContact(formData: FormData): Promise<void> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return;

  const contactId = id(formData, "id");
  const applicationId = id(formData, "applicationId");
  if (contactId) {
    await supabase.from("contacts").update({ application_id: null }).eq("id", contactId);
  }
  revalidateAll(applicationId);
}
