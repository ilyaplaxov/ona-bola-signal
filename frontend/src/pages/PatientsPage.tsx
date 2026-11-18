import { ZoneFilter } from "@ona-bola/shared";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession, useStrings } from "../app/session";
import { PatientForm } from "../components/PatientForm";
import { ZoneBadge } from "../components/ZoneBadge";
import { formatDateTime } from "../i18n/format";
import { usePatients } from "../services/queries";

/** Value that settles `delay` ms after the last change (search as you type). */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function PatientsPage() {
  const s = useStrings();
  const { lang } = useSession();
  const [params, setParams] = useSearchParams();
  const zoneParam = ZoneFilter.safeParse(params.get("zone"));
  const zone = zoneParam.success ? zoneParam.data : undefined;
  const district = params.get("district") ?? undefined;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [registering, setRegistering] = useState(false);
  const q = useDebounced(search.trim(), 300);

  const list = usePatients({ q: q || undefined, zone, district });
  const everyone = usePatients({});
  const districts = [...new Set(everyone.data?.items.map((p) => p.district) ?? [])].sort();

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get("q") ?? "") !== q) setParam("q", q || undefined);
    // Only the settled search text should update the address bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const control =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{s.patients.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {s.patients.total}: {list.data?.total ?? "…"}
          </span>
          {registering ? null : (
            <button
              type="button"
              id="register-open"
              onClick={() => setRegistering(true)}
              className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-800"
            >
              {s.register.open}
            </button>
          )}
        </div>
      </div>

      {registering ? (
        <PatientForm known={everyone.data?.items ?? []} onClose={() => setRegistering(false)} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          id="patient-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={s.patients.search}
          className={`${control} min-w-64 flex-1`}
        />
        <select
          id="zone-filter"
          value={zone ?? ""}
          onChange={(e) => setParam("zone", e.target.value || undefined)}
          className={control}
        >
          <option value="">{s.patients.allZones}</option>
          {ZoneFilter.options.map((z) => (
            <option key={z} value={z}>
              {s.zone[z]}
            </option>
          ))}
        </select>
        <select
          id="district-filter"
          value={district ?? ""}
          onChange={(e) => setParam("district", e.target.value || undefined)}
          className={control}
        >
          <option value="">{s.patients.allDistricts}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {list.isError ? <p className="text-red-700">{s.common.loadError}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">{s.patients.colZone}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colPatient}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colDistrict}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colWeek}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colAge}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colLast}</th>
              <th className="px-4 py-2.5 font-medium">{s.patients.colAlerts}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <ZoneBadge zone={p.currentRiskZone} incomplete={p.hasDataWarnings} />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    to={`/patients/${p.id}`}
                    className="font-medium text-slate-900 hover:text-rose-800"
                  >
                    {p.displayName}
                  </Link>
                  <div className="font-mono text-xs text-slate-500">{p.externalReference}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.district}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {p.gestationalWeek === null
                    ? s.common.dash
                    : `${p.gestationalWeek} ${s.common.weeks}`}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {p.ageYears === null ? s.common.dash : `${p.ageYears}`}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 tabular-nums">
                  {p.lastMeasurementAt ? formatDateTime(p.lastMeasurementAt, lang) : s.common.dash}
                </td>
                <td className="px-4 py-2.5">
                  {p.openAlertCount > 0 ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                      {p.openAlertCount}
                    </span>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && list.data.items.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{s.patients.empty}</p>
        ) : null}
        {list.isPending ? (
          <p className="p-6 text-center text-sm text-slate-500">{s.common.loading}</p>
        ) : null}
      </div>
    </div>
  );
}
