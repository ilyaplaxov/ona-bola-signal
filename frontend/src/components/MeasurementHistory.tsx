import type { Measurement, MeasurementReading } from "@ona-bola/shared";
import { useSession, useStrings } from "../app/session";
import { formatDateTime, formatNumber, unitLabel } from "../i18n/format";
import { AiBadge } from "./AiBadge";
import { TrendChart } from "./TrendChart";

interface Visit {
  submissionId: string;
  measuredAt: string;
  recordedBy: string;
  /** The values came from a Claude draft that the clinician checked and saved. */
  aiAssisted: boolean;
  readings: Partial<Record<MeasurementReading["type"], MeasurementReading>>;
}

/** One row per visit (submission), newest first. */
function toVisits(measurements: Measurement[]): Visit[] {
  const visits = new Map<string, Visit>();
  for (const m of measurements) {
    const visit = visits.get(m.submissionId) ?? {
      submissionId: m.submissionId,
      measuredAt: m.measuredAt,
      recordedBy: m.recordedBy.displayName,
      aiAssisted: false,
      readings: {},
    };
    if (m.source === "AI_ASSISTED") visit.aiAssisted = true;
    visit.readings[m.reading.type] = m.reading;
    visits.set(m.submissionId, visit);
  }
  return [...visits.values()].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}

function series(measurements: Measurement[], pick: (r: MeasurementReading) => number | null) {
  return measurements.flatMap((m) => {
    const value = pick(m.reading);
    return value === null ? [] : [{ at: m.measuredAt, value }];
  });
}

export function MeasurementHistory({ measurements }: { measurements: Measurement[] }) {
  const s = useStrings();
  const { lang } = useSession();
  const visits = toVisits(measurements);
  const cell = (r: MeasurementReading | undefined) => {
    if (!r) return <span className="text-slate-300">{s.common.dash}</span>;
    return r.type === "BLOOD_PRESSURE" ? `${r.systolic}/${r.diastolic}` : formatNumber(r.value);
  };

  const systolic = series(measurements, (r) => (r.type === "BLOOD_PRESSURE" ? r.systolic : null));
  const hb = series(measurements, (r) => (r.type === "HEMOGLOBIN" ? r.value : null));

  return (
    <div className="space-y-4">
      {systolic.length > 1 || hb.length > 1 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TrendChart title={s.form.systolic} unit={unitLabel("mmHg", lang)} points={systolic} />
          <TrendChart title={s.patient.hb} unit={unitLabel("g/L", lang)} points={hb} />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{s.patient.date}</th>
              <th className="px-3 py-2 font-medium">
                {s.patient.bp}, {unitLabel("mmHg", lang)}
              </th>
              <th className="px-3 py-2 font-medium">
                {s.patient.hb}, {unitLabel("g/L", lang)}
              </th>
              <th className="px-3 py-2 font-medium">
                {s.patient.protein}, {unitLabel("g/L", lang)}
              </th>
              <th className="px-3 py-2 font-medium">
                {s.patient.glucose}, {unitLabel("mmol/L", lang)}
              </th>
              <th className="px-3 py-2 font-medium">{s.patient.by}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.map((v) => (
              <tr key={v.submissionId}>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {formatDateTime(v.measuredAt, lang)}
                </td>
                <td className="px-3 py-2">{cell(v.readings.BLOOD_PRESSURE)}</td>
                <td className="px-3 py-2">{cell(v.readings.HEMOGLOBIN)}</td>
                <td className="px-3 py-2">{cell(v.readings.PROTEINURIA)}</td>
                <td className="px-3 py-2">{cell(v.readings.GLUCOSE)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {v.recordedBy}
                  {v.aiAssisted ? (
                    <span className="ml-1.5">
                      <AiBadge title={s.ai.assistedTag} />
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
