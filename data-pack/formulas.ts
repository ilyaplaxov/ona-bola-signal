export const DAY_MS = 86_400_000;
export const PREGNANCY_DAYS = 280;

export type Trimester = 1 | 2 | 3;

export interface GestationalAge {
  totalDays: number;
  weeks: number;
  days: number;
  decimalWeeks: number;
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

export function addDays(d: Date, days: number): Date {
  return new Date(utcMidnight(d) + days * DAY_MS);
}

export function eddFromLmp(lmp: Date): Date {
  return addDays(lmp, PREGNANCY_DAYS);
}

export function gestationalAge(edd: Date, at: Date): GestationalAge {
  const totalDays = PREGNANCY_DAYS - daysBetween(at, edd);
  return {
    totalDays,
    weeks: Math.floor(totalDays / 7),
    days: ((totalDays % 7) + 7) % 7,
    decimalWeeks: totalDays / 7,
  };
}

export function trimester(gaWeeks: number): Trimester {
  if (gaWeeks < 14) return 1;
  if (gaWeeks < 28) return 2;
  return 3;
}

export function ageInYears(dateOfBirth: Date, at: Date): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function meanArterialPressure(systolic: number, diastolic: number): number {
  return (systolic - diastolic) / 3 + diastolic;
}

export type BmiCategory = "UNDERWEIGHT" | "NORMAL" | "OVERWEIGHT" | "OBESE";

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "UNDERWEIGHT";
  if (value < 25) return "NORMAL";
  if (value < 30) return "OVERWEIGHT";
  return "OBESE";
}

export const GESTATIONAL_WEIGHT_GAIN_KG: Record<BmiCategory, readonly [number, number]> = {
  UNDERWEIGHT: [12.5, 18],
  NORMAL: [11.5, 16],
  OVERWEIGHT: [7, 11.5],
  OBESE: [5, 9],
};

export function weightGainTargetKg(prePregnancyBmi: number): readonly [number, number] {
  return GESTATIONAL_WEIGHT_GAIN_KG[bmiCategory(prePregnancyBmi)];
}

export function transferrinSaturationPct(serumIronUmolL: number, tibcUmolL: number): number {
  return (serumIronUmolL / tibcUmolL) * 100;
}

export type AnemiaGrade = "NONE" | "MILD" | "MODERATE" | "SEVERE" | "VERY_SEVERE";

export function anemiaThresholdGL(t: Trimester): number {
  return t === 2 ? 105 : 110;
}

export function anemiaGradeNational(hbGL: number, t: Trimester): AnemiaGrade {
  if (hbGL < 50) return "VERY_SEVERE";
  if (hbGL < 70) return "SEVERE";
  if (hbGL < 90) return "MODERATE";
  if (hbGL < anemiaThresholdGL(t)) return "MILD";
  return "NONE";
}

export function anemiaGradeWho2024(hbGL: number, t: Trimester): AnemiaGrade {
  if (hbGL < 70) return "SEVERE";
  if (hbGL < (t === 2 ? 95 : 100)) return "MODERATE";
  if (hbGL < anemiaThresholdGL(t)) return "MILD";
  return "NONE";
}

export const SFH_Z = { p3: -1.88, p10: -1.28, p50: 0, p90: 1.28, p97: 1.88 } as const;
export const SFH_VALID_WEEKS = [16, 42] as const;

function assertSfhRange(gaWeeks: number): void {
  if (gaWeeks < SFH_VALID_WEEKS[0] || gaWeeks > SFH_VALID_WEEKS[1]) {
    throw new RangeError(`INTERGROWTH-21st SFH standard covers ${SFH_VALID_WEEKS[0]}-${SFH_VALID_WEEKS[1]} weeks, got ${gaWeeks}`);
  }
}

export function sfhMedianCm(gaWeeks: number): number {
  assertSfhRange(gaWeeks);
  const ga2 = gaWeeks * gaWeeks;
  return 5.133374 + 0.1058353119 * ga2 - 0.0231295 * ga2 * Math.log(gaWeeks);
}

export function sfhSdCm(gaWeeks: number): number {
  assertSfhRange(gaWeeks);
  return 0.9922667 + 0.0258087 * gaWeeks;
}

export function sfhCentilesCm(gaWeeks: number): Record<keyof typeof SFH_Z, number> {
  const median = sfhMedianCm(gaWeeks);
  const sd = sfhSdCm(gaWeeks);
  return {
    p3: median + SFH_Z.p3 * sd,
    p10: median + SFH_Z.p10 * sd,
    p50: median,
    p90: median + SFH_Z.p90 * sd,
    p97: median + SFH_Z.p97 * sd,
  };
}

export function sfhZScore(gaWeeks: number, sfhCm: number): number {
  return (sfhCm - sfhMedianCm(gaWeeks)) / sfhSdCm(gaWeeks);
}

export interface AncVisitWindow {
  visit: number;
  fromWeek: number;
  toWeek: number;
}

export const ANC_VISITS: readonly AncVisitWindow[] = [
  { visit: 1, fromWeek: 0, toWeek: 12 },
  { visit: 2, fromWeek: 18, toWeek: 20 },
  { visit: 3, fromWeek: 26, toWeek: 26 },
  { visit: 4, fromWeek: 30, toWeek: 30 },
  { visit: 5, fromWeek: 34, toWeek: 34 },
  { visit: 6, fromWeek: 36, toWeek: 36 },
  { visit: 7, fromWeek: 38, toWeek: 38 },
  { visit: 8, fromWeek: 40, toWeek: 40 },
];

export function nextAncVisit(gaWeeks: number): AncVisitWindow | null {
  return ANC_VISITS.find((v) => v.toWeek + 1 > gaWeeks) ?? null;
}

export function missedAncVisits(
  gaWeeks: number,
  visitGaWeeks: readonly number[],
  graceWeeks = 2,
): AncVisitWindow[] {
  return ANC_VISITS.filter(
    (v) =>
      v.toWeek + graceWeeks < gaWeeks &&
      !visitGaWeeks.some((w) => w >= v.fromWeek - graceWeeks && w <= v.toWeek + graceWeeks),
  );
}

export type EpdsBand = "LOW" | "MEDIUM" | "HIGH";

export function epdsScore(answers: readonly number[]): { score: number; band: EpdsBand; referToSpecialist: boolean } {
  if (answers.length !== 10 || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    throw new RangeError("EPDS needs 10 answers scored 0-3");
  }
  const score = answers.reduce((s, a) => s + a, 0);
  const band: EpdsBand = score >= 12 ? "HIGH" : score >= 5 ? "MEDIUM" : "LOW";
  return { score, band, referToSpecialist: score >= 10 };
}
