import type { Alert } from "@ona-bola/shared";
import { Link } from "react-router";
import { useCurrentUser, useSession, useStrings } from "../app/session";
import { formatDateTime, ruleLabel } from "../i18n/format";
import { ApiError } from "../services/api";
import { useAcknowledgeAlert } from "../services/queries";
import { ZoneBadge } from "./ZoneBadge";

/** Alert cards with the acknowledge action. Only the recipient role may acknowledge. */
export function AlertList({
  alerts,
  showPatient = true,
}: {
  alerts: Alert[];
  showPatient?: boolean;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const me = useCurrentUser();
  const acknowledge = useAcknowledgeAlert();

  if (alerts.length === 0) return <p className="text-sm text-slate-500">{s.alerts.empty}</p>;

  return (
    <ul className="space-y-3">
      {alerts.map((alert) => {
        const pending = alert.status === "PENDING";
        const mayAcknowledge = me?.role === alert.recipientRole;
        const failed =
          acknowledge.variables === alert.id && acknowledge.error instanceof ApiError
            ? acknowledge.error.message
            : null;
        return (
          <li
            key={alert.id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${
              pending
                ? alert.severity === "RED"
                  ? "border-red-300"
                  : "border-amber-300"
                : "border-slate-200 opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ZoneBadge zone={alert.severity} />
                  {showPatient ? (
                    <Link
                      to={`/patients/${alert.patientId}`}
                      className="font-mono text-sm font-semibold text-rose-800 hover:underline"
                    >
                      {alert.patientReference}
                    </Link>
                  ) : null}
                  <span className="text-xs text-slate-500">
                    {formatDateTime(alert.createdAt, lang)}
                  </span>
                </div>
                <ul className="text-sm text-slate-800">
                  {alert.triggeredRuleIds.map((ruleId) => (
                    <li key={ruleId}>{ruleLabel(ruleId, lang, alert.message)}</li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  {s.alerts.recipient}: {s.role[alert.recipientRole]}
                </p>
              </div>
              <div className="text-right text-sm">
                {pending ? (
                  <button
                    type="button"
                    onClick={() => acknowledge.mutate(alert.id)}
                    disabled={!mayAcknowledge || acknowledge.isPending}
                    title={mayAcknowledge ? undefined : s.alerts.onlySpecialist}
                    className="rounded-md bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {acknowledge.isPending && acknowledge.variables === alert.id
                      ? s.alerts.acknowledging
                      : s.alerts.acknowledge}
                  </button>
                ) : (
                  <span className="text-emerald-700">
                    ✓ {s.alerts.ackBy}: {alert.acknowledgedBy?.displayName ?? s.common.dash}
                    {alert.acknowledgedAt ? (
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(alert.acknowledgedAt, lang)}
                      </span>
                    ) : null}
                  </span>
                )}
                {pending && !mayAcknowledge ? (
                  <p className="mt-1 max-w-48 text-xs text-slate-500">{s.alerts.onlySpecialist}</p>
                ) : null}
                {failed ? <p className="mt-1 text-xs text-red-700">{failed}</p> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
