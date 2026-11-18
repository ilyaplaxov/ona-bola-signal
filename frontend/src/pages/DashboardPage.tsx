import type { ZoneFilter } from "@ona-bola/shared";
import { Link } from "react-router";
import { useSession, useStrings } from "../app/session";
import { ZoneBadge } from "../components/ZoneBadge";
import { formatDateTime } from "../i18n/format";
import { useDashboard } from "../services/queries";

const ZONE_CARDS: { zone: ZoneFilter; tone: string }[] = [
  { zone: "RED", tone: "border-red-300 bg-red-50" },
  { zone: "YELLOW", tone: "border-amber-300 bg-amber-50" },
  { zone: "GREEN", tone: "border-emerald-300 bg-emerald-50" },
  { zone: "NOT_ASSESSED", tone: "border-slate-300 bg-white" },
];

export function DashboardPage() {
  const s = useStrings();
  const { lang } = useSession();
  const stats = useDashboard();

  if (stats.isPending) return <p className="text-slate-500">{s.common.loading}</p>;
  if (stats.isError) return <p className="text-red-700">{s.common.loadError}</p>;
  const { zoneCounts, pendingAlerts, recentActivity, districts = [] } = stats.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{s.dashboard.title}</h1>
        <p className="text-sm text-slate-500">{s.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ZONE_CARDS.map(({ zone, tone }) => (
          <Link
            key={zone}
            to={`/patients?zone=${zone}`}
            className={`rounded-xl border p-4 transition hover:shadow-md ${tone}`}
          >
            <ZoneBadge zone={zone === "NOT_ASSESSED" ? null : zone} />
            <div className="mt-3 text-4xl font-bold tabular-nums">{zoneCounts[zone]}</div>
            <div className="text-sm text-slate-600">{s.dashboard.patients}</div>
          </Link>
        ))}
      </div>

      {districts.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">{s.dashboard.byDistrict}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">{s.dashboard.district}</th>
                  {ZONE_CARDS.map(({ zone }) => (
                    <th key={zone} className="px-3 py-1.5 font-medium">
                      <ZoneBadge zone={zone === "NOT_ASSESSED" ? null : zone} />
                    </th>
                  ))}
                  <th className="px-3 py-1.5 font-medium">{s.dashboard.pendingShort}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districts.map((d) => (
                  <tr key={d.district}>
                    <td className="py-2 pr-4">
                      <Link
                        to={`/patients?district=${encodeURIComponent(d.district)}`}
                        className="font-medium text-slate-900 hover:text-rose-800"
                      >
                        {d.district}
                      </Link>
                    </td>
                    {ZONE_CARDS.map(({ zone }) => (
                      <td key={zone} className="px-3 py-2">
                        {d.zoneCounts[zone] || <span className="text-slate-300">0</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {d.pendingAlerts > 0 ? (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                          {d.pendingAlerts}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">{s.dashboard.pending}</h2>
          <div className="mt-3 flex items-end gap-4">
            <span className="text-5xl font-bold tabular-nums">{pendingAlerts.total}</span>
            <span className="space-y-1 pb-1 text-sm">
              <span className="block">
                <ZoneBadge zone="RED" /> {pendingAlerts.RED}
              </span>
              <span className="block">
                <ZoneBadge zone="YELLOW" /> {pendingAlerts.YELLOW}
              </span>
            </span>
          </div>
          <Link
            to="/alerts"
            className="mt-4 inline-block text-sm font-semibold text-rose-800 hover:underline"
          >
            {s.dashboard.openInbox}
          </Link>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold">{s.dashboard.recent}</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {recentActivity.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="w-36 shrink-0 text-xs text-slate-500 tabular-nums">
                  {formatDateTime(event.createdAt, lang)}
                </span>
                <span className="font-medium">{s.audit[event.action]}</span>
                {event.patientId && event.patientReference ? (
                  <Link
                    to={`/patients/${event.patientId}`}
                    className="font-mono text-xs font-semibold text-rose-800 hover:underline"
                  >
                    {event.patientReference}
                  </Link>
                ) : null}
                <span className="text-slate-500">
                  {event.actor?.displayName ?? s.common.system}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
