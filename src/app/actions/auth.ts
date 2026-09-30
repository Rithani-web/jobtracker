"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { text } from "@/lib/form";
import type { ActionState } from "@/lib/domain";

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { error: "Invalid email or password.", ok: false };
  }

  redirect("/");
}

export async function signUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required.", ok: false };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", ok: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message, ok: false };
  }
  if (!data.session) {
    return {
      error: "Account created — check your inbox to confirm the email, then sign in.",
      ok: false,
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
