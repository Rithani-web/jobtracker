import {
  badgeClass,
  outcomeBadgeClass,
  statusBadgeClass,
} from "@/lib/domain";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={badgeClass(statusBadgeClass(status))}>
      <span
        aria-hidden
        className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {status}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span className={badgeClass(outcomeBadgeClass(outcome))}>{outcome}</span>
  );
}
