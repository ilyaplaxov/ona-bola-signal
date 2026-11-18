import type { PatientDetail } from "@ona-bola/shared";
import { useState } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { formatDateTime } from "../i18n/format";
import { tempSignalLinked, useIssueSignalLink } from "../services/queries";

/** A link with a copy button: the code is the secret, so the doctor reads or pastes it to the patient. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const s = useStrings();
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined); // clipboard blocked: the text is on screen to select by hand
  }
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-1 flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {copied ? s.signal.copied : s.signal.copy}
        </button>
      </div>
    </div>
  );
}

/**
 * "Connect Telegram": issues the one-time code and shows the bot link and the website link
 * (TEAM_PLAN item 7). A QR code is not drawn: the link is enough for the demo.
 */
export function SignalLinkPanel({ patient }: { patient: PatientDetail }) {
  const s = useStrings();
  const { lang } = useSession();
  const canLink = useCan("SIGNAL_LINK");
  const issue = useIssueSignalLink(patient.id, patient.externalReference);
  // The server says whether the patient is linked; while the endpoint is missing, the stand-in does.
  const linked =
    patient.signalLink?.telegram || patient.signalLink?.web || tempSignalLinked(patient.id);
  const link = issue.data;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{s.signal.title}</h2>
        <span
          data-signal-linked={linked}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            linked
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-slate-300 bg-slate-100 text-slate-600"
          }`}
        >
          {linked ? s.signal.linked : s.signal.notLinked}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{s.signal.hint}</p>

      {canLink ? (
        <button
          type="button"
          id="signal-connect"
          disabled={issue.isPending}
          onClick={() => issue.mutate()}
          className="mt-3 rounded-lg bg-rose-800 px-4 text-sm font-semibold text-white hover:bg-rose-900 disabled:bg-slate-300"
        >
          {issue.isPending ? s.signal.connecting : s.signal.connect}
        </button>
      ) : null}
      {issue.isError ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {s.signal.failed}
        </p>
      ) : null}

      {link ? (
        <div
          id="signal-link"
          className="mt-4 space-y-3 rounded-lg border border-rose-200 bg-rose-50/50 p-4"
        >
          <div>
            <p className="text-sm font-medium text-slate-700">{s.signal.code}</p>
            <p
              id="signal-code"
              className="font-mono text-3xl font-bold tracking-widest text-rose-900"
            >
              {link.code}
            </p>
            <p className="text-sm text-slate-500">
              {s.signal.expires(formatDateTime(link.expiresAt, lang))}
            </p>
          </div>
          {link.telegramUrl ? (
            <CopyRow label={s.signal.telegramLink} value={link.telegramUrl} />
          ) : (
            <p className="text-sm text-slate-600">{s.signal.noBot}</p>
          )}
          <CopyRow label={s.signal.webLink} value={`${window.location.origin}${link.webPath}`} />
        </div>
      ) : null}
    </section>
  );
}
