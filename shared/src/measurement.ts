import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { UserRef } from "./user";

export const MeasurementType = z.enum(["BLOOD_PRESSURE", "HEMOGLOBIN", "PROTEINURIA", "GLUCOSE"]);
export type MeasurementType = z.infer<typeof MeasurementType>;

/**
 * The one accepted unit per type. Readings in any other unit are rejected, never converted silently.
 * To be confirmed against local lab forms (docs/MENTOR_QUESTIONS.md, domain question 3).
 */
export const CANONICAL_UNITS = {
  BLOOD_PRESSURE: "mmHg",
  HEMOGLOBIN: "g/L",
  PROTEINURIA: "g/L",
  GLUCOSE: "mmol/L",
} as const satisfies Record<MeasurementType, string>;

// Structural checks only. Plausibility ranges are data-quality rules in the Risk Engine, with their
// values recorded in docs/RULES_PROVENANCE.md, so the contracts hold no clinical numbers.

export const BloodPressureReading = z.object({
  type: z.literal("BLOOD_PRESSURE"),
  systolic: z.number().int().positive(),
  diastolic: z.number().int().positive(),
  unit: z.literal(CANONICAL_UNITS.BLOOD_PRESSURE),
});

export const HemoglobinReading = z.object({
  type: z.literal("HEMOGLOBIN"),
  value: z.number().positive(),
  unit: z.literal(CANONICAL_UNITS.HEMOGLOBIN),
});

/** Protein concentration in a single urine sample, as district lab forms usually report it. */
export const ProteinuriaReading = z.object({
  type: z.literal("PROTEINURIA"),
  /** Zero is a valid result (no protein detected). */
  value: z.number().nonnegative(),
  unit: z.literal(CANONICAL_UNITS.PROTEINURIA),
});

/** Venous plasma glucose. The demo rules assume a fasting sample (to confirm with the mentor). */
export const GlucoseReading = z.object({
  type: z.literal("GLUCOSE"),
  value: z.number().positive(),
  unit: z.literal(CANONICAL_UNITS.GLUCOSE),
});

/** One value as entered in the measurement form, discriminated by `type`. */
export const MeasurementReading = z
  .discriminatedUnion("type", [
    BloodPressureReading,
    HemoglobinReading,
    ProteinuriaReading,
    GlucoseReading,
  ])
  .refine((r) => r.type !== "BLOOD_PRESSURE" || r.diastolic < r.systolic, {
    message: "Diastolic pressure must be lower than systolic pressure",
    path: ["diastolic"],
  });
export type MeasurementReading = z.infer<typeof MeasurementReading>;

/** Where a value came from. DEMO_SEED is written only by the seed script. */
export const MeasurementSource = z.enum(["MANUAL", "AI_ASSISTED", "DEMO_SEED"]);
export type MeasurementSource = z.infer<typeof MeasurementSource>;

/** A stored value. One submission (a visit) holds at most one reading per type. */
export const Measurement = z.object({
  id: Uuid,
  patientId: Uuid,
  submissionId: Uuid,
  measuredAt: IsoDateTime,
  recordedBy: UserRef,
  source: MeasurementSource,
  reading: MeasurementReading,
  createdAt: IsoDateTime,
});
export type Measurement = z.infer<typeof Measurement>;

/**
 * Inputs the Risk Engine can refer to in rules, reasons, trend findings and data warnings.
 * The UI maps each key to a label.
 */
export const MeasureKey = z.enum([
  "BLOOD_PRESSURE.systolic",
  "BLOOD_PRESSURE.diastolic",
  "HEMOGLOBIN",
  "PROTEINURIA",
  "GLUCOSE",
  "PATIENT.age",
  "PATIENT.gestationalWeek",
  "RISK_FACTOR.previousCesarean",
  "RISK_FACTOR.gestationalDiabetes",
]);
export type MeasureKey = z.infer<typeof MeasureKey>;
