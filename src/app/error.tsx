"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/60 dark:bg-red-950/30">
      <h1 className="text-lg font-semibold text-red-700 dark:text-red-300">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-red-600 dark:text-red-400">
        An unexpected error occurred while loading this page. Your data is safe
        — try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
