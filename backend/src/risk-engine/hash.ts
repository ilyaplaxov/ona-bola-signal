import { createHash } from "node:crypto";
import type { EngineInput, RuleSet } from "./types";

/** JSON with object keys sorted at every level and undefined values dropped, so equal data hashes equally. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Fingerprint of everything that determines an assessment: rule-set version, `now`, patient
 * context and measurements. The order of the input measurements does not change it.
 */
export function hashEngineInput(input: EngineInput, ruleSet: RuleSet, now: Date): string {
  const measurements = [...input.measurements].sort(
    (a, b) =>
      (Date.parse(a.measuredAt) || 0) - (Date.parse(b.measuredAt) || 0) || (a.id < b.id ? -1 : 1),
  );
  const canonical = stableStringify({
    ruleSet: { id: ruleSet.id, version: ruleSet.version },
    now: now.toISOString(),
    patient: {
      id: input.patientId,
      dateOfBirth: input.dateOfBirth,
      estimatedDueDate: input.estimatedDueDate,
      riskFactors: input.riskFactors,
    },
    measurements,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
