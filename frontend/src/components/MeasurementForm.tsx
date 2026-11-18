import {
  SubmitMeasurementsRequest,
  type AnalyzeNoteResponse,
  type MeasurementReading,
} from "@ona-bola/shared";
import { useState, type FormEvent } from "react";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { unitLabel } from "../i18n/format";
import { ApiError } from "../services/api";
import { useSubmitMeasurements } from "../services/queries";
import { AiNotePanel } from "./AiNotePanel";
import { ZoneBadge } from "./ZoneBadge";

/** A time in the browser's zone, in the format a datetime-local input expects. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const localNow = () => toLocalInput(new Date());

const EMPTY = { systolic: "", diastolic: "", hb: "", protein: "", glucose: "" };

type Draft = AnalyzeNoteResponse["draft"];

/** Form values for what Claude found; the fields it found nothing for stay empty. */
function valuesFromDraft(draft: Draft): typeof EMPTY {
  const next = { ...EMPTY };
  for (const m of draft.measurements) {
    if (m.type === "BLOOD_PRESSURE") {
      next.systolic = String(m.systolic);
      next.diastolic = String(m.diastolic);
    } else if (m.type === "HEMOGLOBIN") next.hb = String(m.value);
    else if (m.type === "PROTEINURIA") next.protein = String(m.value);
    else next.glucose = String(m.value);
  }
  return next;
}

/**
 * One visit at a time. The submission id is created once per visit and reused on retry, so a
 * double click or a network retry never stores the visit twice. The zone comes back from the server.
 */
export function MeasurementForm({
  patientId,
  initialDraft,
}: {
  patientId: string;
  /** A draft read from a document in the Documents tab: the form opens already filled with it. */
  initialDraft?: Draft | undefined;
}) {
  const s = useStrings();
  const { lang } = useSession();
  const allowed = useCan("VISIT_ADD");
  const submit = useSubmitMeasurements(patientId);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const prefilled = initialDraft !== undefined && initialDraft.measurements.length > 0;
  const [values, setValues] = useState(() => (prefilled ? valuesFromDraft(initialDraft) : EMPTY));
  const [measuredAt, setMeasuredAt] = useState(() =>
    prefilled && initialDraft.measuredAt
      ? toLocalInput(new Date(initialDraft.measuredAt))
      : localNow(),
  );
  const [source, setSource] = useState<"MANUAL" | "AI_ASSISTED">(
    prefilled ? "AI_ASSISTED" : "MANUAL",
  );
  const [problem, setProblem] = useState<string | null>(null);

  /** Puts Claude's draft into the form (only the values it found); the clinician still saves. */
  function applyDraft(draft: Draft) {
    if (draft.measurements.length === 0) return;
    const found = valuesFromDraft(draft);
    setValues((v) => ({
      systolic: found.systolic || v.systolic,
      diastolic: found.diastolic || v.diastolic,
      hb: found.hb || v.hb,
      protein: found.protein || v.protein,
      glucose: found.glucose || v.glucose,
    }));
    if (draft.measuredAt) setMeasuredAt(toLocalInput(new Date(draft.measuredAt)));
    setSource("AI_ASSISTED");
    setProblem(null);
  }

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const num = (text: string) => Number(text.replace(",", "."));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const readings: MeasurementReading[] = [];
    if (values.systolic || values.diastolic) {
      if (!values.systolic || !values.diastolic) return setProblem(s.form.bpBoth);
      readings.push({
        type: "BLOOD_PRESSURE",
        systolic: num(values.systolic),
        diastolic: num(values.diastolic),
        unit: "mmHg",
      });
    }
    if (values.hb) readings.push({ type: "HEMOGLOBIN", value: num(values.hb), unit: "g/L" });
    if (values.protein)
      readings.push({ type: "PROTEINURIA", value: num(values.protein), unit: "g/L" });
    if (values.glucose)
      readings.push({ type: "GLUCOSE", value: num(values.glucose), unit: "mmol/L" });
    if (readings.length === 0) return setProblem(s.form.atLeastOne);

    const parsed = SubmitMeasurementsRequest.safeParse({
      submissionId,
      measuredAt: new Date(measuredAt).toISOString(),
      source,
      measurements: readings,
    });
    if (!parsed.success) {
      return setProblem(`${s.form.invalid}: ${parsed.error.issues[0]?.message ?? ""}`);
    }
    submit.mutate(parsed.data, {
      onSuccess: () => {
        setSubmissionId(crypto.randomUUID());
        setValues(EMPTY);
        setMeasuredAt(localNow());
        setSource("MANUAL");
      },
    });
  }

  const apiProblem =
    submit.error instanceof ApiError
      ? submit.error.code === "ACTOR_REQUIRED"
        ? s.form.noPermission
        : submit.error.message
      : submit.error
        ? s.common.loadError
        : null;
  const result = submit.data;
  const input =
    "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm tabular-nums focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none";
  const label = "block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <p className="text-xs text-slate-500">{s.form.subtitle}</p>
      <AiNotePanel key={submissionId} patientId={patientId} onDraft={applyDraft} />
      <div>
        <label className={label} htmlFor="m-when">
          {s.form.when}
        </label>
        <input
          id="m-when"
          type="datetime-local"
          className={input}
          value={measuredAt}
          onChange={(e) => setMeasuredAt(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="m-sys">
            {s.form.systolic}, {unitLabel("mmHg", lang)}
          </label>
          <input
            id="m-sys"
            inputMode="numeric"
            className={input}
            value={values.systolic}
            onChange={set("systolic")}
          />
        </div>
        <div>
          <label className={label} htmlFor="m-dia">
            {s.form.diastolic}, {unitLabel("mmHg", lang)}
          </label>
          <input
            id="m-dia"
            inputMode="numeric"
            className={input}
            value={values.diastolic}
            onChange={set("diastolic")}
          />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="m-hb">
          {s.form.hb}, {unitLabel("g/L", lang)}
        </label>
        <input
          id="m-hb"
          inputMode="decimal"
          className={input}
          value={values.hb}
          onChange={set("hb")}
        />
      </div>
      <div>
        <label className={label} htmlFor="m-prot">
          {s.form.protein}, {unitLabel("g/L", lang)}
        </label>
        <input
          id="m-prot"
          inputMode="decimal"
          className={input}
          value={values.protein}
          onChange={set("protein")}
        />
      </div>
      <div>
        <label className={label} htmlFor="m-glu">
          {s.form.glucose}, {unitLabel("mmol/L", lang)}
        </label>
        <input
          id="m-glu"
          inputMode="decimal"
          className={input}
          value={values.glucose}
          onChange={set("glucose")}
        />
      </div>

      {source === "AI_ASSISTED" ? (
        <p className="text-xs font-medium text-violet-800">{s.ai.draftSource}</p>
      ) : null}
      {!allowed ? <p className="text-sm text-amber-800">{s.form.noPermission}</p> : null}
      {problem || apiProblem ? (
        <p role="alert" className="text-sm text-red-700">
          {problem ?? apiProblem}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!allowed || submit.isPending}
        className="w-full rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submit.isPending ? s.form.saving : s.form.submit}
      </button>

      {result ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{s.form.result}:</span>
            <ZoneBadge
              zone={result.assessment.zone}
              incomplete={result.assessment.dataWarnings.length > 0}
            />
            <span className="text-slate-500">
              ({s.form.previous}: {s.zone[result.previousZone ?? "NOT_ASSESSED"]})
            </span>
          </div>
          {result.newAlertIds.length > 0 ? (
            <p className="mt-2 font-medium text-red-700">{s.form.alertSent}</p>
          ) : null}
          {result.replayed ? <p className="mt-2 text-slate-600">{s.form.replayed}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
