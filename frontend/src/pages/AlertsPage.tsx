import type { AlertStatus } from "@ona-bola/shared";
import { useState } from "react";
import { useStrings } from "../app/session";
import { AlertList } from "../components/AlertList";
import { SignalCard } from "../components/SignalCard";
import { useAlerts, useSignals } from "../services/queries";

export function AlertsPage() {
  const s = useStrings();
  const [status, setStatus] = useState<AlertStatus | undefined>("PENDING");
  const alerts = useAlerts(status ? { status } : {});
  // Patient signals sit in the same inbox: the "pending" tab shows the NEW ones, "handled" the rest.
  const signals = useSignals({});
  const shownSignals = (signals.data?.items ?? []).filter(
    (x) => status === undefined || (status === "PENDING") === (x.status === "NEW"),
  );
  const tabs: [AlertStatus | undefined, string][] = [
    ["PENDING", s.alerts.pending],
    ["ACKNOWLEDGED", s.alerts.acknowledged],
    [undefined, s.alerts.all],
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{s.alerts.title}</h1>
      <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm" role="tablist">
        {tabs.map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
              status === value ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {alerts.isPending ? <p className="text-slate-500">{s.common.loading}</p> : null}
      {alerts.isError ? <p className="text-red-700">{s.common.loadError}</p> : null}
      {shownSignals.length > 0 ? (
        <section aria-labelledby="signals-title" className="space-y-3">
          <h2 id="signals-title" className="text-lg font-semibold">
            {s.signal.listTitle}
          </h2>
          <ul className="space-y-3">
            {shownSignals.map((x) => (
              <SignalCard key={x.id} signal={x} />
            ))}
          </ul>
        </section>
      ) : null}
      {alerts.data ? <AlertList alerts={alerts.data.items} /> : null}
    </div>
  );
}
