import { CreatePatientRequest, type PatientSummary, type RiskFactors } from "@ona-bola/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession, useStrings } from "../app/session";
import { MEASURE_LABELS } from "../i18n/strings";
import { ApiError } from "../services/api";
import { useCreatePatient, useUsers } from "../services/queries";

const EMPTY = {
  externalReference: "",
  displayName: "",
  dateOfBirth: "",
  district: "",
  facility: "",
  estimatedDueDate: "",
  assignedUserId: "",
  previousCesarean: "",
  gestationalDiabetes: "",
};
type Field = keyof typeof EMPTY;

/** "" means not recorded, which the Risk Engine reports as missing data rather than "no". */
const toFactor = (value: string): boolean | undefined =>
  value === "yes" ? true : value === "no" ? false : undefined;

/**
 * Registers a synthetic patient. The patient starts "not assessed"; the first visit entered on
 * the patient page produces the first zone.
 */
export function RegisterPatientForm({
  known,
  onClose,
}: {
  /** Existing patients, for district and facility suggestions. */
  known: PatientSummary[];
  onClose: () => void;
}) {
  const s = useStrings();
  const { lang, actorId } = useSession();
  const navigate = useNavigate();
  const create = useCreatePatient();
  const users = useUsers();
  const [values, setValues] = useState(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const set = (key: Field) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const doctors = users.data?.items.filter((u) => u.role === "DOCTOR") ?? [];
  const districts = [...new Set(known.map((p) => p.district))].sort();
  const facilities = [...new Set(known.map((p) => p.facility))].sort();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const riskFactors: RiskFactors = {};
    const cesarean = toFactor(values.previousCesarean);
    const diabetes = toFactor(values.gestationalDiabetes);
    if (cesarean !== undefined) riskFactors.previousCesarean = cesarean;
    if (diabetes !== undefined) riskFactors.gestationalDiabetes = diabetes;

    const parsed = CreatePatientRequest.safeParse({
      externalReference: values.externalReference,
      displayName: values.displayName,
      district: values.district,
      facility: values.facility,
      riskFactors,
      ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
      ...(values.estimatedDueDate ? { estimatedDueDate: values.estimatedDueDate } : {}),
      ...(values.assignedUserId ? { assignedUserId: values.assignedUserId } : {}),
    });
    if (!parsed.success) return setProblem(s.register.required);
    create.mutate(parsed.data, { onSuccess: (patient) => navigate(`/patients/${patient.id}`) });
  }

  const apiProblem =
    create.error instanceof ApiError
      ? create.error.code === "CONFLICT"
        ? s.register.duplicate
        : create.error.code === "ACTOR_REQUIRED"
          ? s.register.chooseRole
          : create.error.message
      : create.error
        ? s.common.loadError
        : null;

  const input =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-rose-600 focus:ring-1 focus:ring-rose-600 focus:outline-none";
  const label = "block text-xs font-medium text-slate-600";
  const factorSelect = (key: "previousCesarean" | "gestationalDiabetes") => (
    <div>
      <label className={label} htmlFor={`r-${key}`}>
        {MEASURE_LABELS[`RISK_FACTOR.${key}`][lang]}
      </label>
      <select id={`r-${key}`} className={input} value={values[key]} onChange={set(key)}>
        <option value="">{s.register.unknown}</option>
        <option value="yes">{s.common.yes}</option>
        <option value="no">{s.common.no}</option>
      </select>
    </div>
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="register-title"
      className="space-y-4 rounded-xl border border-rose-200 bg-white p-5"
    >
      <div>
        <h2 id="register-title" className="text-lg font-semibold">
          {s.register.title}
        </h2>
        <p className="text-xs text-amber-800">{s.register.syntheticOnly}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className={label} htmlFor="r-due">
            {s.register.due}
          </label>
          <input
            id="r-due"
            type="date"
            className={input}
            value={values.estimatedDueDate}
            onChange={set("estimatedDueDate")}
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
        {factorSelect("previousCesarean")}
        {factorSelect("gestationalDiabetes")}
      </div>

      {!actorId ? <p className="text-sm text-amber-800">{s.register.chooseRole}</p> : null}
      {problem || apiProblem ? (
        <p role="alert" className="text-sm text-red-700">
          {problem ?? apiProblem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!actorId || create.isPending}
          className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {create.isPending ? s.register.saving : s.register.save}
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
