import {
  CreatePatientRequest,
  dueDateFromStart,
  gestationalAgeDays,
  pregnancyStart,
  PregnancyDating,
  UpdatePatientRequest,
  type PatientDetail,
  type PatientSummary,
  type RiskFactors,
  type RiskFlag,
} from "@ona-bola/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCan } from "../app/auth";
import { useSession, useStrings } from "../app/session";
import { capitalize, formatDate, riskFactorLabel } from "../i18n/format";
import { MEASURE_LABELS } from "../i18n/strings";
import { ApiError } from "../services/api";
import { useCreatePatient, useUpdatePatient, useUsers } from "../services/queries";

/** Anamnesis findings offered as checkboxes: the ones the protocol's risk scales use most. */
const FORM_FLAGS: RiskFlag[] = [
  "PREVIOUS_PREECLAMPSIA",
  "PREVIOUS_HYPERTENSION_IN_PREGNANCY",
  "CHRONIC_HYPERTENSION",
  "DIABETES",
  "PREVIOUS_GDM",
  "CHRONIC_KIDNEY_DISEASE",
  "AUTOIMMUNE_DISEASE",
  "FAMILY_HISTORY_PREECLAMPSIA",
  "FAMILY_HISTORY_DIABETES",
  "MULTIPLE_PREGNANCY",
  "PREVIOUS_PPH",
  "PLACENTA_PREVIA_OR_ACCRETA",
  "PREVIOUS_STILLBIRTH",
  "SMOKING",
  "VARICOSE_VEINS",
];

/** KEEP (edit only) leaves the stored dating as it is; NONE means not known yet. */
type DatingChoice = "LMP" | "ULTRASOUND" | "NONE" | "KEEP";

const factorValue = (v: boolean | undefined) => (v === true ? "yes" : v === false ? "no" : "");
/** "" means not recorded, which the Risk Engine reports as missing data rather than "no". */
const toFactor = (value: string): boolean | undefined =>
  value === "yes" ? true : value === "no" ? false : undefined;
const num = (text: string) => Number(text.replace(",", "."));

function initialValues(patient: PatientDetail | undefined) {
  const rf = patient?.riskFactors ?? {};
  return {
    externalReference: patient?.externalReference ?? "",
    displayName: patient?.displayName ?? "",
    dateOfBirth: patient?.dateOfBirth ?? "",
    district: patient?.district ?? "",
    facility: patient?.facility ?? "",
    assignedUserId: patient?.assignedUser?.id ?? "",
    lmpDate: "",
    scanDate: "",
    scanWeeks: "",
    scanDays: "0",
    previousCesarean: factorValue(rf.previousCesarean),
    gestationalDiabetes: factorValue(rf.gestationalDiabetes),
    parity: rf.parity === undefined ? "" : String(rf.parity),
    bmi: rf.bmi === undefined ? "" : String(rf.bmi),
  };
}
type Values = ReturnType<typeof initialValues>;

/**
 * Registers a synthetic patient (no `patient`) or edits one. The pregnancy is dated by the last
 * menstrual period or by an ultrasound scan; the due date is worked out from that. A new patient
 * starts "not assessed"; editing the dating or the risk factors of an assessed patient re-runs the
 * Risk Engine on the server.
 */
export function PatientForm({
  patient,
  known,
  onClose,
}: {
  patient?: PatientDetail;
  /** Existing patients, for district and facility suggestions. */
  known: PatientSummary[];
  onClose: () => void;
}) {
  const s = useStrings();
  const { lang } = useSession();
  // registering needs PATIENT_CREATE, editing an existing card needs PATIENT_EDIT
  const allowed = useCan(patient ? "PATIENT_EDIT" : "PATIENT_CREATE");
  const navigate = useNavigate();
  const create = useCreatePatient();
  const update = useUpdatePatient(patient?.id ?? "");
  const users = useUsers();
  const editing = patient !== undefined;
  const [values, setValues] = useState<Values>(() => initialValues(patient));
  const [dating, setDating] = useState<DatingChoice>(editing ? "KEEP" : "LMP");
  const [flags, setFlags] = useState<Set<RiskFlag>>(
    () => new Set(patient?.riskFactors.flags ?? []),
  );
  const [problem, setProblem] = useState<string | null>(null);

  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const doctors = users.data?.items.filter((u) => u.role === "DOCTOR") ?? [];
  const districts = [...new Set(known.map((p) => p.district))].sort();
  const facilities = [...new Set(known.map((p) => p.facility))].sort();

  /** The dating the form describes, or undefined while it is incomplete. */
  function datingValue(): PregnancyDating | undefined {
    const candidate =
      dating === "LMP"
        ? { method: "LMP", lmpDate: values.lmpDate }
        : {
            method: "ULTRASOUND",
            scanDate: values.scanDate,
            weeks: values.scanWeeks === "" ? NaN : num(values.scanWeeks),
            days: values.scanDays === "" ? 0 : num(values.scanDays),
          };
    const parsed = PregnancyDating.safeParse(candidate);
    return parsed.success ? parsed.data : undefined;
  }

  const today = new Date().toISOString().slice(0, 10);
  const preview = (() => {
    if (dating !== "LMP" && dating !== "ULTRASOUND") return null;
    const d = datingValue();
    if (!d) return null;
    const start = pregnancyStart(d);
    const days = gestationalAgeDays(start, today);
    return { days, due: dueDateFromStart(start) };
  })();

  function riskFactors(): RiskFactors {
    const rf: RiskFactors = {};
    const cesarean = toFactor(values.previousCesarean);
    const diabetes = toFactor(values.gestationalDiabetes);
    if (cesarean !== undefined) rf.previousCesarean = cesarean;
    if (diabetes !== undefined) rf.gestationalDiabetes = diabetes;
    if (values.parity !== "") rf.parity = num(values.parity);
    if (values.bmi !== "") rf.bmi = num(values.bmi);
    if (flags.size > 0) rf.flags = [...flags];
    return rf;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const datingPart: { dating?: PregnancyDating | null } = {};
    if (dating === "LMP" || dating === "ULTRASOUND") {
      const d = datingValue();
      if (!d) return setProblem(s.register.datingIncomplete);
      datingPart.dating = d;
    } else if (dating === "NONE" && editing) {
      datingPart.dating = null;
    }

    if (editing) {
      const parsed = UpdatePatientRequest.safeParse({
        displayName: values.displayName,
        dateOfBirth: values.dateOfBirth || null,
        district: values.district,
        facility: values.facility,
        assignedUserId: values.assignedUserId || null,
        riskFactors: riskFactors(),
        ...datingPart,
      });
      if (!parsed.success) return setProblem(s.register.required);
      update.mutate(parsed.data, { onSuccess: onClose });
      return;
    }

    const parsed = CreatePatientRequest.safeParse({
      externalReference: values.externalReference,
      displayName: values.displayName,
      district: values.district,
      facility: values.facility,
      riskFactors: riskFactors(),
      ...datingPart,
      ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
      ...(values.assignedUserId ? { assignedUserId: values.assignedUserId } : {}),
    });
    if (!parsed.success) return setProblem(s.register.required);
    create.mutate(parsed.data, { onSuccess: (p) => navigate(`/patients/${p.id}`) });
  }

  const mutation = editing ? update : create;
  const apiProblem =
    mutation.error instanceof ApiError
      ? mutation.error.code === "CONFLICT"
        ? s.register.duplicate
        : mutation.error.code === "ACTOR_REQUIRED"
          ? s.register.noPermission
          : mutation.error.code === "VALIDATION_FAILED"
            ? s.register.datingInvalid
            : mutation.error.message
      : mutation.error
        ? s.common.loadError
        : null;

  const input =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none";
  const label = "block text-xs font-medium text-slate-600";
  const factorSelect = (key: "previousCesarean" | "gestationalDiabetes") => (
    <div>
      <label className={label} htmlFor={`r-${key}`}>
        {capitalize(MEASURE_LABELS[`RISK_FACTOR.${key}`][lang])}
      </label>
      <select id={`r-${key}`} className={input} value={values[key]} onChange={set(key)}>
        <option value="">{s.register.unknown}</option>
        <option value="yes">{s.common.yes}</option>
        <option value="no">{s.common.no}</option>
      </select>
    </div>
  );
  const choices: DatingChoice[] = editing
    ? ["KEEP", "LMP", "ULTRASOUND", "NONE"]
    : ["LMP", "ULTRASOUND", "NONE"];
  const choiceLabel: Record<DatingChoice, string> = {
    KEEP: s.register.datingKeep,
    LMP: s.register.datingLmp,
    ULTRASOUND: s.register.datingUltrasound,
    NONE: s.register.datingNone,
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="patient-form-title"
      className="space-y-5 rounded-xl border border-rose-200 bg-white p-5"
    >
      <div>
        <h2 id="patient-form-title" className="text-lg font-semibold">
          {editing ? s.register.editTitle : s.register.title}
        </h2>
        <p className="text-xs text-amber-800">{s.register.syntheticOnly}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {editing ? null : (
          <div>
            <label className={label} htmlFor="r-ref">
              {s.register.reference} *
            </label>
            <input
              id="r-ref"
              className={`${input} font-mono`}
              placeholder={s.register.referenceHint}
              maxLength={32}
              value={values.externalReference}
              onChange={set("externalReference")}
            />
          </div>
        )}
        <div>
          <label className={label} htmlFor="r-name">
            {s.register.name} *
          </label>
          <input
            id="r-name"
            className={input}
            maxLength={120}
            value={values.displayName}
            onChange={set("displayName")}
          />
        </div>
        <div>
          <label className={label} htmlFor="r-district">
            {s.register.district} *
          </label>
          <input
            id="r-district"
            className={input}
            list="r-district-options"
            maxLength={80}
            value={values.district}
            onChange={set("district")}
          />
          <datalist id="r-district-options">
            {districts.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="r-facility">
            {s.register.facility} *
          </label>
          <input
            id="r-facility"
            className={input}
            list="r-facility-options"
            maxLength={120}
            value={values.facility}
            onChange={set("facility")}
          />
          <datalist id="r-facility-options">
            {facilities.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="r-dob">
            {s.register.dob}
          </label>
          <input
            id="r-dob"
            type="date"
            className={input}
            value={values.dateOfBirth}
            onChange={set("dateOfBirth")}
          />
        </div>
        <div>
          <label className={label} htmlFor="r-doctor">
            {s.register.doctor}
          </label>
          <select
            id="r-doctor"
            className={input}
            value={values.assignedUserId}
            onChange={set("assignedUserId")}
          >
            <option value="">{s.register.noDoctor}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">{s.register.datingTitle}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="dating"
                value={c}
                checked={dating === c}
                onChange={() => setDating(c)}
              />
              {choiceLabel[c]}
            </label>
          ))}
        </div>
        {dating === "KEEP" && patient ? (
          <p className="text-sm text-slate-600">
            {patient.estimatedDueDate
              ? `${s.patient.due}: ${formatDate(patient.estimatedDueDate, lang)}`
              : s.register.datingNone}
          </p>
        ) : null}
        {dating === "LMP" ? (
          <div className="max-w-xs">
            <label className={label} htmlFor="r-lmp">
              {s.register.lmpDate}
            </label>
            <input
              id="r-lmp"
              type="date"
              max={today}
              className={input}
              value={values.lmpDate}
              onChange={set("lmpDate")}
            />
          </div>
        ) : null}
        {dating === "ULTRASOUND" ? (
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="r-scan">
                {s.register.scanDate}
              </label>
              <input
                id="r-scan"
                type="date"
                max={today}
                className={input}
                value={values.scanDate}
                onChange={set("scanDate")}
              />
            </div>
            <div>
              <label className={label} htmlFor="r-scan-weeks">
                {s.register.scanAge}, {s.register.weeksShort}
              </label>
              <input
                id="r-scan-weeks"
                inputMode="numeric"
                className={input}
                value={values.scanWeeks}
                onChange={set("scanWeeks")}
              />
            </div>
            <div>
              <label className={label} htmlFor="r-scan-days">
                {s.register.daysShort} (0–6)
              </label>
              <input
                id="r-scan-days"
                inputMode="numeric"
                className={input}
                value={values.scanDays}
                onChange={set("scanDays")}
              />
            </div>
          </div>
        ) : null}
        {preview ? (
          <p
            id="r-dating-preview"
            aria-live="polite"
            className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900"
          >
            {preview.days < 0
              ? s.register.datingInvalid
              : s.register.datingPreview(
                  Math.floor(preview.days / 7),
                  preview.days % 7,
                  formatDate(preview.due, lang),
                )}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">{s.register.datingHint}</p>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">{s.register.anamnesis}</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {factorSelect("previousCesarean")}
          {factorSelect("gestationalDiabetes")}
          <div>
            <label className={label} htmlFor="r-parity">
              {s.riskGroups.parity}
            </label>
            <input
              id="r-parity"
              inputMode="numeric"
              className={input}
              value={values.parity}
              onChange={set("parity")}
            />
          </div>
          <div>
            <label className={label} htmlFor="r-bmi">
              {s.riskGroups.bmi}
            </label>
            <input
              id="r-bmi"
              inputMode="decimal"
              className={input}
              value={values.bmi}
              onChange={set("bmi")}
            />
          </div>
        </div>
        <div>
          <p className={label}>{s.register.flags}</p>
          <div className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {FORM_FLAGS.map((flag) => (
              <label key={flag} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={flags.has(flag)}
                  onChange={(e) =>
                    setFlags((all) => {
                      const next = new Set(all);
                      if (e.target.checked) next.add(flag);
                      else next.delete(flag);
                      return next;
                    })
                  }
                />
                {capitalize(riskFactorLabel(flag, lang))}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">{s.register.anamnesisHint}</p>
      </fieldset>

      {editing ? <p className="text-xs text-slate-500">{s.register.reassessNote}</p> : null}
      {!allowed ? <p className="text-sm text-amber-800">{s.register.noPermission}</p> : null}
      {problem || apiProblem ? (
        <p role="alert" className="text-sm text-red-700">
          {problem ?? apiProblem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          id="patient-form-save"
          disabled={!allowed || mutation.isPending}
          className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {mutation.isPending
            ? s.register.saving
            : editing
              ? s.register.saveChanges
              : s.register.save}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {s.register.cancel}
        </button>
      </div>
    </form>
  );
}
