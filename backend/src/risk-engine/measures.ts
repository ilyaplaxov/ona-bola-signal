import type { MeasureKey, MeasurementReading, MeasurementType } from "@ona-bola/shared";

/** English labels and units, used in reason texts and rule descriptions. */
export const MEASURE_INFO: Record<MeasureKey, { label: string; unit: string | null }> = {
  "BLOOD_PRESSURE.systolic": { label: "systolic pressure", unit: "mmHg" },
  "BLOOD_PRESSURE.diastolic": { label: "diastolic pressure", unit: "mmHg" },
  HEMOGLOBIN: { label: "haemoglobin", unit: "g/L" },
  PROTEINURIA: { label: "proteinuria", unit: "g/L" },
  GLUCOSE: { label: "fasting glucose", unit: "mmol/L" },
  "PATIENT.age": { label: "age", unit: "years" },
  "PATIENT.gestationalWeek": { label: "gestational week", unit: "weeks" },
  "RISK_FACTOR.previousCesarean": { label: "previous caesarean", unit: null },
  "RISK_FACTOR.gestationalDiabetes": { label: "gestational diabetes", unit: null },
};

/** The measure a warning about a whole reading of this type refers to. */
export const PRIMARY_MEASURE: Record<MeasurementType, MeasureKey> = {
  BLOOD_PRESSURE: "BLOOD_PRESSURE.systolic",
  HEMOGLOBIN: "HEMOGLOBIN",
  PROTEINURIA: "PROTEINURIA",
  GLUCOSE: "GLUCOSE",
};

/** The numeric values a reading provides, keyed by measure. */
export function valuesOf(reading: MeasurementReading): [MeasureKey, number][] {
  switch (reading.type) {
    case "BLOOD_PRESSURE":
      return [
        ["BLOOD_PRESSURE.systolic", reading.systolic],
        ["BLOOD_PRESSURE.diastolic", reading.diastolic],
      ];
    case "HEMOGLOBIN":
      return [["HEMOGLOBIN", reading.value]];
    case "PROTEINURIA":
      return [["PROTEINURIA", reading.value]];
    case "GLUCOSE":
      return [["GLUCOSE", reading.value]];
  }
}

/** Formats a value with its unit, e.g. "152 mmHg" or "yes". */
export function formatValue(measure: MeasureKey, value: number | boolean): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  const unit = MEASURE_INFO[measure].unit;
  const number = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return unit ? `${number} ${unit}` : number;
}
