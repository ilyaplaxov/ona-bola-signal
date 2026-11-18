import type { DataWarning } from "@ona-bola/shared";
import { daysBetween } from "../domain/pregnancy";
import type { DataQualityRule, Facts, Observation } from "./types";

export interface DataQualityResult {
  warning: DataWarning;
  evidence: Observation[];
}

/**
 * MISSING: the measure has no valid value at all.
 * STALE: the latest reading is older than `staleAfterDays` on `now`.
 * Returns null when the data is fine.
 */
export function checkDataQuality(
  rule: DataQualityRule,
  facts: Facts,
  now: Date,
): DataQualityResult | null {
  const fact = facts.get(rule.measure);

  if (rule.check === "MISSING") {
    if (fact) return null;
    return {
      warning: { code: "MISSING", measure: rule.measure, ruleId: rule.id, text: rule.reason },
      evidence: [],
    };
  }

  if (!fact || fact.measuredAt === null || rule.staleAfterDays === undefined) return null;
  const ageDays = daysBetween(new Date(fact.measuredAt), now);
  if (ageDays <= rule.staleAfterDays) return null;
  return {
    warning: {
      code: "STALE",
      measure: rule.measure,
      ruleId: rule.id,
      text: `${rule.reason} (last reading ${ageDays} days ago)`,
    },
    evidence: [fact],
  };
}
