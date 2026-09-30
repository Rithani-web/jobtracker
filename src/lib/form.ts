import { revalidatePath } from "next/cache";

// FormData parsing helpers shared by the server actions.

export function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Trimmed string, or null when blank (maps to a nullable column). */
export function optText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

/** Non-empty entity id (a uuid string in Supabase), or null when absent. */
export function id(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 && value.length <= 64 ? value : null;
}

export function isCheckboxChecked(formData: FormData, key: string): boolean {
  const value = text(formData, key);
  return value === "on" || value === "1" || value === "true";
}

/**
 * Revalidates every route that renders JobTracker data, so any list, dashboard
 * metric, or detail page reflects the mutation.
 */
export function revalidateAll(applicationId?: string | null): void {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/contacts");
  revalidatePath("/follow-ups");
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}
