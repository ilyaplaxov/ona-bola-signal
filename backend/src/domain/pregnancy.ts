// Derived patient values shared by the Risk Engine and the API. Pure functions of their inputs.

const DAY_MS = 86_400_000;

/** Length of a pregnancy from the first day of the last period to the estimated due date. */
export const PREGNANCY_DAYS = 280;

/** Parses "YYYY-MM-DD" as midnight UTC, so results never depend on the server's time zone. */
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole years between the date of birth and `now`, or null when the date is unknown. */
export function ageInYears(dateOfBirth: string | null, now: Date): number | null {
  if (dateOfBirth === null) return null;
  const birth = parseIsoDate(dateOfBirth);
  if (!birth) return null;
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 ? years : null;
}

/**
 * Completed weeks of pregnancy on `now`, counted back from the estimated due date (280 days).
 * Null when the due date is unknown or lies more than 280 days ahead.
 */
export function gestationalWeek(estimatedDueDate: string | null, now: Date): number | null {
  if (estimatedDueDate === null) return null;
  const due = parseIsoDate(estimatedDueDate);
  if (!due) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysPregnant = PREGNANCY_DAYS - Math.round((due.getTime() - today) / DAY_MS);
  return daysPregnant >= 0 ? Math.floor(daysPregnant / 7) : null;
}

/** Whole days between two instants (rounded down). */
export function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}
