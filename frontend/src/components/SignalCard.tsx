import type { PatientSignal } from "@ona-bola/shared";
import { Link } from "react-router";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { formatDateTime } from "../i18n/format";
import { useHandleSignal } from "../services/queries";

const REACTIONS = ["CONTACTED", "CALLED_IN", "SENT_TO_HOSPITAL"] as const;

/**
 * A signal the patient sent herself (Telegram or the /signal page). It carries a "from patient"
 * mark so it is never mistaken for a Risk Engine alert, and the doctor's reaction buttons.
 */
export function SignalCard({ signal }: { signal: PatientSignal }) {
  const s = useStrings();
  const { lang } = useSession();
  const canHandle = useCan("SIGNAL_HANDLE");
  const handle = useHandleSignal();
  const isNew = signal.status === "NEW";

  return (
    <li
      data-signal={signal.status}
      className={`rounded-xl border p-4 shadow-sm ${
        signal.escalated ? "border-red-400 bg-red-50" : "border-sky-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
          {s.signal.fromPatient} · {s.signal.via[signal.channel]}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            isNew
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-slate-300 bg-slate-100 text-slate-700"
          }`}
        >
          {s.signal.status[signal.status]}
        </span>
        {signal.escalated ? (
          <span className="rounded-full bg-red-700 px-2.5 py-0.5 text-xs font-bold text-white">
            {s.signal.escalated}
          </span>
        ) : null}
        <Link
          to={`/patients/${signal.patientId}`}
          className="font-mono text-sm font-semibold text-rose-800 hover:underline"
        >
          {signal.patientReference}
        </Link>
        <span className="text-sm text-slate-500 sm:ml-auto">
          {formatDateTime(signal.createdAt, lang)}
        </span>
      </div>

      <p className="mt-2 font-medium text-slate-900">{s.signal.kinds[signal.kind]}</p>

      {signal.handledBy ? (
        <p className="mt-1 text-sm text-slate-500">
          {s.signal.handledBy}: {signal.handledBy.displayName}
        </p>
      ) : null}

      {canHandle ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {REACTIONS.filter((r) => r !== signal.status).map((r) => (
            <button
              key={r}
              type="button"
              data-signal-action={r}
              disabled={handle.isPending}
              onClick={() => handle.mutate({ id: signal.id, status: r })}
              className="rounded-lg border border-rose-800 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
            >
              {s.signal.status[r]}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
