import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useSession, useStrings } from "../app/session";
import { AiPanel } from "../components/AiPanel";
import { AlertList } from "../components/AlertList";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { MeasurementForm } from "../components/MeasurementForm";
import { MeasurementHistory } from "../components/MeasurementHistory";
import { PatientForm } from "../components/PatientForm";
import { ReferralsPanel } from "../components/ReferralsPanel";
import { RiskExplanation } from "../components/RiskExplanation";
import { RiskGroupChips, RiskGroups } from "../components/RiskGroups";
import { SignalLinkPanel } from "../components/SignalLinkPanel";
import { ZoneBadge } from "../components/ZoneBadge";
import { formatDate, formatDateTime } from "../i18n/format";
import { MEASURE_LABELS } from "../i18n/strings";
import {
  useAiEnabled,
  useAlerts,
  useDimed,
  useMeasurements,
  usePatient,
  useReferrals,
  useRiskHistory,
} from "../services/queries";

const card = "rounded-xl border border-slate-200 bg-white p-5";

const TABS = ["overview", "visits", "documents", "referrals"] as const;
type Tab = (typeof TABS)[number];

export function PatientDetailsPage() {
  const { id = "" } = useParams();
  const s = useStrings();
  const { lang } = useSession();
  const [params, setParams] = useSearchParams();
  const patient = usePatient(id);
  const measurements = useMeasurements(id);
  const risk = useRiskHistory(id);
  const alerts = useAlerts({ patientId: id });
  const dimed = useDimed(id);
  const referrals = useReferrals({ box: "all", patientId: id });
  const aiEnabled = useAiEnabled();
  const [editing, setEditing] = useState(false);

  // visit (submission id) -> DIMED delivery status
  const visitDimed = useMemo(
    () =>
      Object.fromEntries(
        (dimed.data?.items ?? [])
          .filter((item) => item.recordType === "VISIT")
          .map((item) => [item.recordId, item.status]),
      ),
    [dimed.data],
  );

  if (patient.isPending) return <p className="text-slate-500">{s.common.loading}</p>;
  if (patient.isError) return <p className="text-red-700">{s.common.loadError}</p>;
  const p = patient.data;
  const factor = (value: boolean | undefined) =>
    value === undefined ? s.common.notRecorded : value ? s.common.yes : s.common.no;

  const requested = params.get("tab");
  const tab: Tab = TABS.find((t) => t === requested) ?? "overview";
  const openReferrals =
    referrals.data?.items.filter((r) => r.status === "SENT" || r.status === "ACCEPTED").length ??
    p.openReferralCount ??
    0;

  return (
    <div className="space-y-5">
      <Link to="/patients" className="text-sm text-rose-800 hover:underline">
        {s.patient.back}
      </Link>

      <header className={`${card} flex flex-wrap items-start justify-between gap-4`}>
        <div>
          <h1 className="text-2xl font-bold">{p.displayName}</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{p.externalReference}</span> · {p.district} · {p.facility}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="inline text-slate-500">{s.patient.age}: </dt>
              <dd className="inline font-medium">{p.ageYears ?? s.common.dash}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">{s.patient.week}: </dt>
              <dd className="inline font-medium">
                {p.gestationalAgeDays !== null
                  ? `${Math.floor(p.gestationalAgeDays / 7)} ${s.register.weeksShort} ${p.gestationalAgeDays % 7} ${s.register.daysShort}`
                  : p.gestationalWeek === null
                    ? s.common.dash
                    : `${p.gestationalWeek} ${s.common.weeks}`}
                {p.datingMethod ? (
                  <span className="font-normal text-slate-500">
                    {" "}
                    ({s.register.datedBy[p.datingMethod]})
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">{s.patient.due}: </dt>
              <dd className="inline font-medium">
                {p.estimatedDueDate ? formatDate(p.estimatedDueDate, lang) : s.common.dash}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">{s.patient.doctor}: </dt>
              <dd className="inline font-medium">{p.assignedUser?.displayName ?? s.common.dash}</dd>
            </div>
          </dl>
          <RiskGroupChips groups={p.riskGroups} />
        </div>
        <div className="flex flex-col items-end gap-3">
          <ZoneBadge zone={p.currentRiskZone} incomplete={p.hasDataWarnings} large />
          {editing ? null : (
            <button
              type="button"
              id="patient-edit"
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {s.register.edit}
            </button>
          )}
        </div>
      </header>

      {editing ? <PatientForm patient={p} known={[]} onClose={() => setEditing(false)} /> : null}

      <div
        role="tablist"
        aria-label={p.displayName}
        className="flex gap-1 border-b border-slate-300"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            onClick={() => setParams(t === "overview" ? {} : { tab: t }, { replace: true })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-base font-semibold ${
              tab === t
                ? "border-rose-700 text-rose-900"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {s.tabs[t]}
            {t === "referrals" && openReferrals > 0 ? (
              <span className="rounded-full bg-amber-600 px-2 text-xs font-bold text-white">
                {openReferrals}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div key={tab} role="tabpanel" aria-labelledby={`tab-${tab}`} className="page-in">
        {tab === "overview" ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              {/* The Risk Engine (green, rules) and the AI (violet, explains) side by side in meaning. */}
              <section
                aria-labelledby="engine-title"
                className="overflow-hidden rounded-2xl border border-rose-200 bg-white"
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-rose-800 px-5 py-3 text-white">
                  <h2 id="engine-title" className="text-lg font-semibold">
                    {s.engine.name}
                  </h2>
                  <p className="text-sm text-rose-100 sm:ml-auto">{s.engine.caption}</p>
                </header>
                <div className="p-5">
                  <h3 className="mb-3 text-base font-semibold text-slate-700">
                    {s.patient.current}
                  </h3>
                  {p.currentAssessment ? (
                    <RiskExplanation assessment={p.currentAssessment} />
                  ) : (
                    <p className="text-slate-600">{s.patient.notAssessed}</p>
                  )}
                </div>
              </section>

              {aiEnabled ? (
                <>
                  <AiPanel patientId={id} assessmentId={p.currentAssessment?.id ?? null} />
                  <p className="text-sm text-slate-500">{s.engine.legend}</p>
                </>
              ) : null}

              <section className={card}>
                <h2 className="mb-3 text-lg font-semibold">{s.patient.alerts}</h2>
                {alerts.data ? (
                  alerts.data.items.length > 0 ? (
                    <AlertList alerts={alerts.data.items} showPatient={false} />
                  ) : (
                    <p className="text-slate-500">{s.patient.noAlerts}</p>
                  )
                ) : null}
              </section>
            </div>

            <div className="space-y-5">
              <SignalLinkPanel patient={p} />

              <section className={card}>
                <h2 className="mb-2 text-lg font-semibold">{s.patient.riskFactors}</h2>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">
                      {MEASURE_LABELS["RISK_FACTOR.previousCesarean"][lang]}
                    </dt>
                    <dd className="font-medium">{factor(p.riskFactors.previousCesarean)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">
                      {MEASURE_LABELS["RISK_FACTOR.gestationalDiabetes"][lang]}
                    </dt>
                    <dd className="font-medium">{factor(p.riskFactors.gestationalDiabetes)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">{s.riskGroups.parity}</dt>
                    <dd className="font-medium">{p.riskFactors.parity ?? s.common.notRecorded}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">{s.riskGroups.bmi}</dt>
                    <dd className="font-medium">{p.riskFactors.bmi ?? s.common.notRecorded}</dd>
                  </div>
                </dl>
              </section>

              <section className={card}>
                <h2 className="mb-2 text-lg font-semibold">{s.riskGroups.title}</h2>
                <RiskGroups groups={p.riskGroups} />
              </section>
            </div>
          </div>
        ) : null}

        {tab === "visits" ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <section className={card}>
                <h2 className="mb-4 text-lg font-semibold">{s.patient.history}</h2>
                {measurements.data ? (
                  <MeasurementHistory measurements={measurements.data.items} dimed={visitDimed} />
                ) : (
                  <p className="text-slate-500">{s.common.loading}</p>
                )}
              </section>

              <section className={card}>
                <h2 className="mb-3 text-lg font-semibold">{s.patient.assessments}</h2>
                <ol className="space-y-1.5 text-sm">
                  {risk.data?.history.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3">
                      <span className="w-40 shrink-0 text-xs text-slate-500 tabular-nums">
                        {formatDateTime(a.assessedAt, lang)}
                      </span>
                      <ZoneBadge zone={a.zone} incomplete={a.dataWarnings.length > 0} />
                      <span className="text-slate-500">
                        {s.patient.reasonsCount(a.reasons.length)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <section className={`${card} self-start`}>
              <h2 className="mb-2 text-lg font-semibold">{s.form.title}</h2>
              <MeasurementForm patientId={id} />
            </section>
          </div>
        ) : null}

        {tab === "documents" ? <DocumentsPanel patientId={id} /> : null}

        {tab === "referrals" ? (
          <ReferralsPanel patientId={id} patientReference={p.externalReference} />
        ) : null}
      </div>
    </div>
  );
}
