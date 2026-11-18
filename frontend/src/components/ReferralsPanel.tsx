import { Specialty, type ReferralUrgency } from "@ona-bola/shared";
import { useState, type FormEvent } from "react";
import { useCan } from "../app/auth";
import { useStrings } from "../app/session";
import { useCreateReferral, useReferrals } from "../services/queries";
import { ReferralCard } from "./ReferralCard";

const field =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 focus:border-rose-600";

/** "Refer to a specialist": specialty, urgency and the reason. Sent as SENT; the consultant takes it from there. */
function ReferralForm({
  patientId,
  patientReference,
  onDone,
}: {
  patientId: string;
  patientReference: string;
  onDone: () => void;
}) {
  const s = useStrings();
  const create = useCreateReferral(patientId, patientReference);
  const [specialty, setSpecialty] = useState<Specialty>("THERAPIST");
  const [urgency, setUrgency] = useState<ReferralUrgency>("ROUTINE");
  const [reason, setReason] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { toSpecialty: specialty, urgency, reason: reason.trim() },
      { onSuccess: onDone },
    );
  }

  return (
    <form
      onSubmit={submit}
      id="referral-form"
      className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/50 p-5"
    >
      <h3 className="text-lg font-semibold">{s.referral.new}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          {s.referral.specialty}
          <select
            id="referral-specialty"
            value={specialty}
            onChange={(e) => setSpecialty(Specialty.parse(e.target.value))}
            className={field}
          >
            {Specialty.options.map((value) => (
              <option key={value} value={value}>
                {s.specialty[value]}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{s.referral.urgency}</legend>
          <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300 bg-white">
            {(["ROUTINE", "URGENT"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={urgency === value}
                onClick={() => setUrgency(value)}
                className={`flex-1 px-3 text-sm font-semibold ${
                  urgency === value
                    ? value === "URGENT"
                      ? "bg-red-700 text-white"
                      : "bg-rose-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.referral.urgencyLabels[value]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        {s.referral.reason}
        <textarea
          id="referral-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          className={`${field} py-2`}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {s.referral.reasonHint}
        </span>
      </label>
      {create.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {s.referral.failed}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          id="referral-submit"
          disabled={reason.trim() === "" || create.isPending}
          className="rounded-lg bg-rose-800 px-5 text-sm font-semibold text-white hover:bg-rose-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {create.isPending ? s.referral.sending : s.referral.send}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {s.referral.cancel}
        </button>
      </div>
    </form>
  );
}

/** The "Referrals" tab of a patient card: this patient's referrals and the form to add one. */
export function ReferralsPanel({
  patientId,
  patientReference,
}: {
  patientId: string;
  patientReference: string;
}) {
  const s = useStrings();
  const canCreate = useCan("REFERRAL_CREATE");
  const list = useReferrals({ box: "all", patientId });
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{s.referral.title}</h2>
        {canCreate && !creating ? (
          <button
            type="button"
            id="referral-open"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-rose-800 px-4 text-sm font-semibold text-white hover:bg-rose-900"
          >
            {s.referral.new}
          </button>
        ) : null}
      </div>
      {creating ? (
        <ReferralForm
          patientId={patientId}
          patientReference={patientReference}
          onDone={() => setCreating(false)}
        />
      ) : null}
      {list.isPending ? <p className="text-slate-500">{s.common.loading}</p> : null}
      {list.isError ? <p className="text-red-700">{s.common.loadError}</p> : null}
      {list.data && list.data.items.length === 0 && !creating ? (
        <p className="text-slate-500">{s.referral.empty}</p>
      ) : null}
      <ul className="space-y-3">
        {list.data?.items.map((r) => (
          <ReferralCard key={r.id} referral={r} showPatient={false} />
        ))}
      </ul>
    </div>
  );
}
