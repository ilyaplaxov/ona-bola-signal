import type { Referral, ReferralActionRequest, ReferralStatus } from "@ona-bola/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useCan, useCurrentUser } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { formatDateTime } from "../i18n/format";
import { useUpdateReferral } from "../services/queries";

const STATUS_STYLE: Record<ReferralStatus, string> = {
  SENT: "border-amber-300 bg-amber-50 text-amber-900",
  ACCEPTED: "border-sky-300 bg-sky-50 text-sky-900",
  CONCLUDED: "border-emerald-300 bg-emerald-50 text-emerald-900",
  CLOSED: "border-slate-300 bg-slate-100 text-slate-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-500 line-through",
};

const chip = "rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";
const button =
  "rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";

/**
 * One referral with the actions its status and the viewer's role allow (shared/permissions.ts):
 * the consultant accepts it and writes the conclusion; the referring doctor closes or cancels it.
 */
export function ReferralCard({
  referral,
  showPatient = true,
}: {
  referral: Referral;
  showPatient?: boolean;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const me = useCurrentUser();
  const canRespond = useCan("REFERRAL_RESPOND");
  const canCreate = useCan("REFERRAL_CREATE");
  const update = useUpdateReferral();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");

  const mine = referral.fromUser.id === me?.id;
  const open = referral.status === "SENT" || referral.status === "ACCEPTED";
  const respond = canRespond && !mine;
  const act = (body: ReferralActionRequest) => update.mutate({ id: referral.id, body });

  return (
    <li
      data-referral={referral.status}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${chip} ${STATUS_STYLE[referral.status]}`}>
          {s.referral.status[referral.status]}
        </span>
        {referral.urgency === "URGENT" ? (
          <span className={`${chip} border-red-300 bg-red-50 text-red-800`}>
            {s.referral.urgencyLabels.URGENT}
          </span>
        ) : null}
        <span className="font-semibold text-slate-900">{s.specialty[referral.toSpecialty]}</span>
        {showPatient ? (
          <Link
            to={`/patients/${referral.patientId}`}
            className="font-mono text-sm font-semibold text-rose-800 hover:underline"
          >
            {referral.patientReference}
          </Link>
        ) : null}
        <span className="text-sm text-slate-500 sm:ml-auto">
          {formatDateTime(referral.createdAt, lang)}
        </span>
      </div>

      <p className="mt-2 text-slate-800">{referral.reason}</p>
      <p className="mt-1 text-sm text-slate-500">
        {s.referral.from}: {referral.fromUser.displayName} · {s.referral.to}:{" "}
        {referral.toUser?.displayName ?? s.referral.anyDoctor}
      </p>

      {referral.conclusion ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-sm font-semibold text-emerald-900">{s.referral.conclusion}</p>
          <p className="mt-1 whitespace-pre-line text-slate-800">{referral.conclusion}</p>
        </div>
      ) : null}

      {writing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={s.referral.conclusionPlaceholder}
            aria-label={s.referral.conclusion}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-rose-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-referral-action="conclude"
              disabled={text.trim() === "" || update.isPending}
              onClick={() =>
                act({ action: "CONCLUDE", conclusion: text.trim(), attachmentIds: [] })
              }
              className={`${button} bg-rose-800 text-white hover:bg-rose-900`}
            >
              {s.referral.saveConclusion}
            </button>
            <button
              type="button"
              onClick={() => setWriting(false)}
              className={`${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}
            >
              {s.referral.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {respond && referral.status === "SENT" ? (
            <button
              type="button"
              data-referral-action="accept"
              disabled={update.isPending}
              onClick={() => act({ action: "ACCEPT" })}
              className={`${button} bg-rose-800 text-white hover:bg-rose-900`}
            >
              {s.referral.accept}
            </button>
          ) : null}
          {respond && open ? (
            <button
              type="button"
              data-referral-action="write-conclusion"
              onClick={() => setWriting(true)}
              className={`${button} border border-rose-800 bg-white text-rose-800 hover:bg-rose-50`}
            >
              {s.referral.conclude}
            </button>
          ) : null}
          {canCreate && mine && referral.status === "CONCLUDED" ? (
            <button
              type="button"
              data-referral-action="close"
              disabled={update.isPending}
              onClick={() => act({ action: "CLOSE" })}
              className={`${button} bg-rose-800 text-white hover:bg-rose-900`}
            >
              {s.referral.close}
            </button>
          ) : null}
          {canCreate && mine && open ? (
            <button
              type="button"
              data-referral-action="cancel"
              disabled={update.isPending}
              onClick={() => act({ action: "CANCEL" })}
              className={`${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}
            >
              {s.referral.cancelReferral}
            </button>
          ) : null}
        </div>
      )}
      {update.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {s.referral.failed}
        </p>
      ) : null}
    </li>
  );
}
