import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { MeasureKey } from "./measurement";
import { ElevatedZone, RiskZone, ZONE_ORDER } from "./zones";

/** ILLUSTRATIVE: team-chosen demo rules. VALIDATED: cited source plus clinician review. */
export const RuleSetKind = z.enum(["ILLUSTRATIVE", "VALIDATED"]);
export type RuleSetKind = z.infer<typeof RuleSetKind>;

/** A value the engine looked at when a rule fired, so the UI can word the reason in any language. */
export const ObservedValue = z.object({
  measure: MeasureKey,
  value: z.union([z.number(), z.boolean()]),
  /** Unit of a numeric value; null for yes/no risk factors. */
  unit: z.string().min(1).nullable(),
  /** When the value was measured; null for patient-level values such as age or a recorded risk factor. */
  measuredAt: IsoDateTime.nullable(),
});
export type ObservedValue = z.infer<typeof ObservedValue>;

/** Why the zone is what it is: one entry per triggered rule. */
export const AssessmentReason = z.object({
  ruleId: z.string().min(1),
  zone: ElevatedZone,
  /** English sentence for the API and logs. The UI can build its own wording from ruleId and observed. */
  text: z.string().min(1),
  /** Measurements that triggered the rule. Empty for patient-level factors such as age. */
  measurementIds: z.array(Uuid),
  /** The values that made the rule fire. */
  observed: z.array(ObservedValue),
});
export type AssessmentReason = z.infer<typeof AssessmentReason>;

export const TrendStatus = z.enum(["TRIGGERED", "NOT_TRIGGERED", "INSUFFICIENT_HISTORY"]);
export type TrendStatus = z.infer<typeof TrendStatus>;

export const TrendFinding = z.object({
  ruleId: z.string().min(1),
  measure: MeasureKey,
  status: TrendStatus,
  text: z.string().min(1),
});
export type TrendFinding = z.infer<typeof TrendFinding>;

/** Missing, stale or implausible data is reported, never treated as normal (brief section 17). */
export const DataWarningCode = z.enum(["MISSING", "STALE", "IMPLAUSIBLE"]);
export type DataWarningCode = z.infer<typeof DataWarningCode>;

export const DataWarning = z.object({
  code: DataWarningCode,
  measure: MeasureKey,
  text: z.string().min(1),
  /** The data-quality rule that produced the warning, if any. */
  ruleId: z.string().min(1).nullable(),
});
export type DataWarning = z.infer<typeof DataWarning>;

const assessmentFields = {
  patientId: Uuid,
  zone: RiskZone,
  triggeredRuleIds: z.array(z.string().min(1)),
  reasons: z.array(AssessmentReason),
  trendFindings: z.array(TrendFinding),
  dataWarnings: z.array(DataWarning),
  ruleSetVersion: z.string().min(1),
  ruleSetKind: RuleSetKind,
  /** Hash of the canonicalised engine input. Equal input and rule-set version give an equal result. */
  inputHash: z.string().min(1),
  assessedAt: IsoDateTime,
};

type ExplainableAssessment = {
  zone: RiskZone;
  triggeredRuleIds: string[];
  reasons: { ruleId: string; zone: ElevatedZone }[];
};

/**
 * Checks that a zone is explained (brief section 5.4: never display a zone without a reason):
 * the zone equals the highest zone among the reasons (GREEN when there are none), and
 * triggeredRuleIds lists exactly the rules that have reasons.
 * Returns an empty list when the assessment is consistent.
 */
export function zoneExplanationProblems(
  a: ExplainableAssessment,
): { path: string[]; message: string }[] {
  const problems: { path: string[]; message: string }[] = [];

  let highest: RiskZone = "GREEN";
  for (const reason of a.reasons) {
    if (ZONE_ORDER[reason.zone] > ZONE_ORDER[highest]) highest = reason.zone;
  }
  if (a.zone !== highest) {
    problems.push({
      path: ["zone"],
      message: `Zone ${a.zone} must equal the highest reason zone (${highest})`,
    });
  }

  const reasonIds = new Set(a.reasons.map((r) => r.ruleId));
  const triggered = new Set(a.triggeredRuleIds);
  const sameSet =
    reasonIds.size === triggered.size && [...reasonIds].every((id) => triggered.has(id));
  if (!sameSet || triggered.size !== a.triggeredRuleIds.length) {
    problems.push({
      path: ["triggeredRuleIds"],
      message: "triggeredRuleIds must list each rule that has a reason, once",
    });
  }

  return problems;
}

function explained<T extends ExplainableAssessment>(a: T, ctx: z.RefinementCtx<T>): void {
  for (const problem of zoneExplanationProblems(a)) {
    ctx.addIssue({ code: "custom", path: problem.path, message: problem.message });
  }
}

/** Risk Engine output before it is stored (no id yet). */
export const AssessmentResult = z.object(assessmentFields).superRefine(explained);
export type AssessmentResult = z.infer<typeof AssessmentResult>;

/** A stored assessment, as returned by the API. */
export const RiskAssessment = z.object({ id: Uuid, ...assessmentFields }).superRefine(explained);
export type RiskAssessment = z.infer<typeof RiskAssessment>;
