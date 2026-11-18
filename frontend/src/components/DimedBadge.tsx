import type { DimedSyncStatus } from "@ona-bola/shared";
import { useStrings } from "../app/session";

const STYLE: Record<DimedSyncStatus, string> = {
  SENT: "border-emerald-300 bg-emerald-50 text-emerald-900",
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  FAILED: "border-red-300 bg-red-50 text-red-900",
};

/** Delivery status of a record to DIMED (TEAM_PLAN item 8). Shows nothing when there is no status. */
export function DimedBadge({ status }: { status: DimedSyncStatus | undefined }) {
  const s = useStrings();
  if (!status) return null;
  return (
    <span
      data-dimed={status}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLE[status]}`}
    >
      <span aria-hidden="true">{status === "SENT" ? "✓" : status === "PENDING" ? "…" : "!"}</span>
      {s.dimed.status[status]}
    </span>
  );
}
