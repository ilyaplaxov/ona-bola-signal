import { Link } from "react-router";
import { useCurrentUser } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { ZoneBadge } from "../components/ZoneBadge";
import { formatDateTime } from "../i18n/format";
import { usePatients } from "../services/queries";

/** Doctor profile (TEAM_PLAN item 2): who is signed in and the patients assigned to them. */
export function ProfilePage() {
  const s = useStrings();
  const { lang } = useSession();
  const me = useCurrentUser();
  const patients = usePatients({ assigned: "me" });
  const mine = patients.data?.items;
  if (!me) return null;

  const facts: [string, string | null | undefined][] = [
    [s.profile.username, me.username],
    [s.profile.role, s.role[me.role]],
    [s.profile.specialty, me.specialty ? s.specialty[me.specialty] : null],
    [s.profile.facility, me.facility],
    [s.profile.district, me.district],
  ];
  const initial = (me.displayName.replace(/^dr\.?\s+/i, "").charAt(0) || "?").toUpperCase();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{s.profile.title}</h1>

      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-800 text-2xl font-bold text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-slate-900">{me.displayName}</p>
          <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {facts
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-slate-500">{label}:</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {s.profile.myPatients}
            {mine ? <span className="ml-2 text-slate-500">· {mine.length}</span> : null}
          </h2>
          <Link
            to="/patients?assigned=me"
            className="text-sm font-semibold text-rose-800 hover:underline"
          >
            {s.nav.patients} →
          </Link>
        </div>
        {patients.isPending ? <p className="mt-3 text-slate-500">{s.common.loading}</p> : null}
        {mine && mine.length === 0 ? (
          <p className="mt-3 text-slate-500">{s.profile.noPatients}</p>
        ) : null}
        <ul className="mt-3 divide-y divide-slate-100">
          {mine?.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <ZoneBadge zone={p.currentRiskZone} incomplete={p.hasDataWarnings} />
              <Link
                to={`/patients/${p.id}`}
                className="font-medium text-slate-900 hover:text-rose-800"
              >
                {p.displayName}
              </Link>
              <span className="font-mono text-xs text-slate-500">{p.externalReference}</span>
              <span className="ml-auto text-sm text-slate-500 tabular-nums">
                {p.gestationalWeek === null
                  ? s.common.dash
                  : `${p.gestationalWeek} ${s.common.weeks}`}
                {p.lastMeasurementAt ? ` · ${formatDateTime(p.lastMeasurementAt, lang)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
