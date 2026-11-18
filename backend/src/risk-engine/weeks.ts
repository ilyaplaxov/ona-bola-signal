import type { GestationalWeeks } from "@ona-bola/shared";

/**
 * True when `week` lies in the range (from ≤ week < to, either end open).
 * `{ unknown: true }` matches only an unknown week; a range with ends never matches an unknown one.
 */
export function inWeeks(range: GestationalWeeks, week: number | null): boolean {
  if ("unknown" in range) return week === null;
  if (week === null) return false;
  return (
    (range.from === undefined || week >= range.from) && (range.to === undefined || week < range.to)
  );
}

/** English wording for rule descriptions: "in weeks 14–27 of pregnancy", "from week 28 of pregnancy". */
export function describeWeeks(range: GestationalWeeks): string {
  if ("unknown" in range) return "while the week of pregnancy is unknown";
  if (range.from !== undefined && range.to !== undefined) {
    return `in weeks ${range.from}–${range.to - 1} of pregnancy`;
  }
  if (range.to !== undefined) return `before week ${range.to} of pregnancy`;
  return `from week ${range.from ?? 0} of pregnancy`;
}
