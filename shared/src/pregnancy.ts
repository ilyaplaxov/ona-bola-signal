import { z } from "zod";
import { IsoDate } from "./common";

// How the start of the pregnancy is recorded at registration. Clinicians date a pregnancy from the
// first day of the last menstrual period (LMP) or from an ultrasound scan (gestational age on the
// scan date); the estimated due date is derived from that, never typed in.

export const DatingMethod = z.enum(["LMP", "ULTRASOUND"]);
export type DatingMethod = z.infer<typeof DatingMethod>;

export const PregnancyDating = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("LMP"),
    /** First day of the last menstrual period. */
    lmpDate: IsoDate,
  }),
  z.object({
    method: z.literal("ULTRASOUND"),
    scanDate: IsoDate,
    /** Gestational age on the scan date, as written in the scan report. */
    weeks: z.number().int().min(0).max(44),
    days: z.number().int().min(0).max(6),
  }),
]);
export type PregnancyDating = z.infer<typeof PregnancyDating>;

/** Days from the dating start (LMP-equivalent) to the estimated due date (Naegele's rule). */
export const PREGNANCY_DAYS = 280;

const DAY_MS = 86_400_000;

function toUtc(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(isoDate: string, days: number): string {
  return toIso(toUtc(isoDate) + days * DAY_MS);
}

/** The LMP-equivalent start date of the pregnancy for either dating method. */
export function pregnancyStart(dating: PregnancyDating): string {
  if (dating.method === "LMP") return dating.lmpDate;
  return addDays(dating.scanDate, -(dating.weeks * 7 + dating.days));
}

/** Estimated due date: start + 280 days. */
export function dueDateFromStart(start: string): string {
  return addDays(start, PREGNANCY_DAYS);
}

/** Start date back-calculated from a due date (for records that only have a due date). */
export function startFromDueDate(dueDate: string): string {
  return addDays(dueDate, -PREGNANCY_DAYS);
}

/** Days of pregnancy completed on `today` ("YYYY-MM-DD"); negative when the start is in the future. */
export function gestationalAgeDays(start: string, today: string): number {
  return Math.round((toUtc(today) - toUtc(start)) / DAY_MS);
}
