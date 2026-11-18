import type { ReferralListQuery } from "@ona-bola/shared";
import { useState } from "react";
import { useCan } from "../app/auth";
import { useStrings } from "../app/session";
import { ReferralCard } from "../components/ReferralCard";
import { useReferrals } from "../services/queries";

type Box = NonNullable<ReferralListQuery["box"]>;

/** All referrals the signed-in doctor sent or must answer; the consultant's inbox is the default. */
export function ReferralsPage() {
  const s = useStrings();
  // A consultant opens on what waits for an answer; a referring doctor on what was sent.
  const canRespond = useCan("REFERRAL_RESPOND");
  const [chosen, setBox] = useState<Box | null>(null);
  const box: Box = chosen ?? (canRespond ? "incoming" : "outgoing");
  const list = useReferrals({ box });
  const boxes: [Box, string][] = [
    ["incoming", s.referral.boxIncoming],
    ["outgoing", s.referral.boxOutgoing],
    ["all", s.referral.boxAll],
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{s.referral.title}</h1>
      <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm" role="tablist">
        {boxes.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`box-${value}`}
            aria-selected={box === value}
            onClick={() => setBox(value)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
              box === value ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {list.isPending ? <p className="text-slate-500">{s.common.loading}</p> : null}
      {list.isError ? <p className="text-red-700">{s.common.loadError}</p> : null}
      {list.data && list.data.items.length === 0 ? (
        <p className="text-slate-500">{s.referral.empty}</p>
      ) : null}
      <ul className="space-y-3">
        {list.data?.items.map((r) => (
          <ReferralCard key={r.id} referral={r} />
        ))}
      </ul>
    </div>
  );
}
