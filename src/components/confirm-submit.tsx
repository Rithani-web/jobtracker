"use client";

import type { ReactNode } from "react";
import { btnDanger } from "@/lib/domain";

/**
 * Submit button that asks for confirmation before the surrounding form's
 * server action runs. Canceling the dialog cancels the submission.
 */
export function ConfirmSubmit({
  message,
  children,
  className,
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className ?? btnDanger}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
