import type {
  ElevatedZone,
  GestationalWeeks,
  MeasureKey,
  MeasurementReading,
  RiskFactors,
  RuleSetKind,
  RuleSource,
} from "@ona-bola/shared";

/** Numeric inputs a rule can compare. */
export type NumericMeasure =
  | "BLOOD_PRESSURE.systolic"
  | "BLOOD_PRESSURE.diastolic"
  | "HEMOGLOBIN"
  | "PROTEINURIA"
  | "GLUCOSE"
  | "PATIENT.age"
  | "PATIENT.gestationalWeek";

/** Numeric inputs that come from measurements, so they have a history a trend can read. */
export type ReadingMeasure = Exclude<NumericMeasure, "PATIENT.age" | "PATIENT.gestationalWeek">;

/** Yes/no risk factors recorded on the patient. */
export type FactorMeasure = "RISK_FACTOR.previousCesarean" | "RISK_FACTOR.gestationalDiabetes";

export type Comparison = ">=" | ">" | "<=" | "<";

/**
 * Condition tree of a threshold rule. Comparisons read the latest valid value of each input.
 * A comparison on a missing value is false: a rule never fires on missing data, which the
 * data-quality rules report instead.
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { measure: NumericMeasure; op: Comparison; value: number }
  | { factor: FactorMeasure; is: boolean };

interface RuleBase {
  /** Stable id, shown to users and listed in docs/RULES_PROVENANCE.md. Illustrative rules start with DEMO-. */
  id: string;
  /** English sentence used in reasons, findings and warnings. */
  reason: string;
  source: RuleSource;
}

/** Fires when its condition holds and raises the zone. */
export interface ThresholdRule extends RuleBase {
  kind: "THRESHOLD";
  zone: ElevatedZone;
  when: Condition;
  /**
   * Limits the rule to readings taken in these weeks of pregnancy: the week on each reading's
   * date counts, so a lab value is read against the norm of the week it was taken in.
   * `{ unknown: true }` limits it to patients whose week is unknown.
   */
  gestationalWeeks?: GestationalWeeks;
}

/**
 * Looks at the last `minReadings` values of one measure. Strictly rising (or falling) values, by at
 * least `minChange` from first to last when set, trigger it. With `zone: null` it only reports.
 */
export interface TrendRule extends RuleBase {
  kind: "TREND";
  zone: ElevatedZone | null;
  measure: ReadingMeasure;
  direction: "RISING" | "FALLING";
  minReadings: number;
  minChange?: number;
}

/** Reports missing or stale inputs. With `zone: null` it only adds a data warning. */
export interface DataQualityRule extends RuleBase {
  kind: "DATA_QUALITY";
  zone: ElevatedZone | null;
  check: "MISSING" | "STALE";
  measure: MeasureKey;
  /** For STALE: the latest reading is older than this many days. */
  staleAfterDays?: number;
  /** Runs only while today's week of pregnancy is in this range (or unknown, for `{ unknown: true }`). */
  gestationalWeeks?: GestationalWeeks;
}

export type Rule = ThresholdRule | TrendRule | DataQualityRule;

export interface RuleSet {
  id: string;
  version: string;
  kind: RuleSetKind;
  rules: Rule[];
}

/** A value the engine reasons about: the latest valid reading of a measure, or a patient-level fact. */
export interface Observation {
  measure: MeasureKey;
  value: number | boolean;
  /** ISO timestamp of the reading; null for patient-level facts such as age or risk factors. */
  measuredAt: string | null;
  measurementId: string | null;
}

/** Latest value per measure, built once per assessment. */
export type Facts = Map<MeasureKey, Observation>;

/** A measurement that passed validation, with its timestamp parsed. Sorted oldest first. */
export interface ValidMeasurement {
  id: string;
  measuredAt: Date;
  reading: MeasurementReading;
}

export interface EngineMeasurement {
  id: string;
  /** ISO timestamp. Order of the input array does not matter; the engine sorts by this. */
  measuredAt: string;
  reading: MeasurementReading;
}

/** Everything the engine needs about one patient. Built by the backend from the database. */
export interface EngineInput {
  patientId: string;
  dateOfBirth: string | null;
  estimatedDueDate: string | null;
  riskFactors: RiskFactors;
  measurements: EngineMeasurement[];
}
