"use client";

import { useActionState, useState } from "react";
import { inputClass, labelClass, initialActionState } from "@/lib/domain";
import { FormMessages } from "@/components/form-messages";
import { SubmitButton } from "@/components/submit-button";
import { signIn, signUp } from "@/app/actions/auth";

export function LoginForm() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [state, formAction] = useActionState(
    mode === "signIn" ? signIn : signUp,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "signUp" ? 8 : undefined}
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>

      <FormMessages state={state} />

      <SubmitButton
        pendingLabel={mode === "signIn" ? "Signing in…" : "Creating account…"}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {mode === "signIn" ? "Sign in" : "Create account"}
      </SubmitButton>

      <button
        type="button"
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
        className="text-center text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        {mode === "signIn"
          ? "No account yet? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
