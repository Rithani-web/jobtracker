import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </p>
      {hint ? (
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}
