import type { ActionState } from "@/lib/domain";

/** Renders a form action's error and success feedback. */
export function FormMessages({ state }: { state: ActionState }) {
  return (
    <div aria-live="polite">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}
    </div>
  );
}
