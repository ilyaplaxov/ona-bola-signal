import {
  AssessmentResult,
  MeasurementReading,
  ZONE_ORDER,
  type AssessmentReason,
  type DataWarning,
  type ElevatedZone,
  type GestationalWeeks,
  type RiskZone,
  type TrendFinding,
} from "@ona-bola/shared";
import { ageInYears, gestationalWeek } from "../domain/pregnancy";
import { checkDataQuality } from "./data-quality";
import { hashEngineInput } from "./hash";
import { formatValue, MEASURE_INFO, PRIMARY_MEASURE, valuesOf } from "./measures";
import { evaluateTrend } from "./trend-detector";
import { inWeeks } from "./weeks";
import type {
  Comparison,
  Condition,
  EngineInput,
  Facts,
  Observation,
  Rule,
  RuleSet,
  ValidMeasurement,
} from "./types";

/** Readings dated later than `now` by more than this are treated as data errors. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/**
 * The deterministic Risk Engine. A pure function: no database, network or clock access.
 * The same input, rule set and `now` always give the same assessment (and the same inputHash).
 * The zone is the highest zone among triggered rules, GREEN when none triggered; every
 * non-GREEN zone therefore comes with at least one reason. The result is checked against the
 * shared AssessmentResult contract before it is returned.
 */
export function assess(input: EngineInput, ruleSet: RuleSet, now: Date): AssessmentResult {
  const dataWarnings: DataWarning[] = [];
  const measurements = prepareMeasurements(input, now, dataWarnings);
  const facts = collectFacts(input, measurements, now);
  const weekToday = gestationalWeek(input.estimatedDueDate, now);
  const reasons: AssessmentReason[] = [];
  const trendFindings: TrendFinding[] = [];

  for (const rule of ruleSet.rules) {
    switch (rule.kind) {
      case "THRESHOLD": {
        const evidence = matchCondition(rule.when, facts);
        if (!evidence) break;
        const weeks = rule.gestationalWeeks
          ? weeksOfEvidence(rule.gestationalWeeks, evidence, input.estimatedDueDate, now)
          : [];
        if (weeks) reasons.push(toReason(rule, rule.zone, [...evidence, ...weeks]));
        break;
      }
      case "TREND": {
        const result = evaluateTrend(rule, measurements);
        trendFindings.push(result.finding);
        if (result.triggered && rule.zone) reasons.push(toReason(rule, rule.zone, result.evidence));
        break;
      }
      case "DATA_QUALITY": {
        if (rule.gestationalWeeks && !inWeeks(rule.gestationalWeeks, weekToday)) break;
        const result = checkDataQuality(rule, facts, now);
        if (result) {
          dataWarnings.push(result.warning);
          if (rule.zone) reasons.push(toReason(rule, rule.zone, result.evidence));
        }
        break;
      }
    }
  }

  return AssessmentResult.parse({
    patientId: input.patientId,
    zone: highestZone(reasons),
    triggeredRuleIds: reasons.map((r) => r.ruleId),
    reasons,
    trendFindings,
    dataWarnings,
    ruleSetVersion: ruleSet.version,
    ruleSetKind: ruleSet.kind,
    inputHash: hashEngineInput(input, ruleSet, now),
    assessedAt: now.toISOString(),
  });
}

/** Validates readings and drops the unusable ones with a warning. Returns them oldest first. */
function prepareMeasurements(
  input: EngineInput,
  now: Date,
  warnings: DataWarning[],
): ValidMeasurement[] {
  const valid: ValidMeasurement[] = [];
  for (const m of input.measurements) {
    const measure = PRIMARY_MEASURE[m.reading.type];
    if (measure === undefined) throw new Error(`Unknown measurement type in ${m.id}`);
    const label = MEASURE_INFO[measure].label;

    const parsed = MeasurementReading.safeParse(m.reading);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? "invalid value";
      warnings.push({
        code: "IMPLAUSIBLE",
        measure,
        ruleId: null,
        text: `A ${label} reading was ignored: ${issue}`,
      });
      continue;
    }
    const measuredAt = new Date(m.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) {
      warnings.push({
        code: "IMPLAUSIBLE",
        measure,
        ruleId: null,
        text: `A ${label} reading without a valid date was ignored`,
      });
      continue;
    }
    if (measuredAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      warnings.push({
        code: "IMPLAUSIBLE",
        measure,
        ruleId: null,
        text: `A ${label} reading dated in the future was ignored`,
      });
      continue;
    }
    valid.push({ id: m.id, measuredAt, reading: parsed.data });
  }
  return valid.sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime() || (a.id < b.id ? -1 : 1),
  );
}

/** Latest value per measure plus patient-level facts (age, gestational week, risk factors). */
function collectFacts(input: EngineInput, measurements: ValidMeasurement[], now: Date): Facts {
  const facts: Facts = new Map();
  // Oldest first, so each later reading overwrites the earlier value of the same measure.
  for (const m of measurements) {
    for (const [measure, value] of valuesOf(m.reading)) {
      facts.set(measure, {
        measure,
        value,
        measuredAt: m.measuredAt.toISOString(),
        measurementId: m.id,
      });
    }
  }

  const patientFact = (
    measure: Observation["measure"],
    value: number | boolean | null | undefined,
  ) => {
    if (value !== null && value !== undefined) {
      facts.set(measure, { measure, value, measuredAt: null, measurementId: null });
    }
  };
  patientFact("PATIENT.age", ageInYears(input.dateOfBirth, now));
  patientFact("PATIENT.gestationalWeek", gestationalWeek(input.estimatedDueDate, now));
  patientFact("RISK_FACTOR.previousCesarean", input.riskFactors.previousCesarean);
  patientFact("RISK_FACTOR.gestationalDiabetes", input.riskFactors.gestationalDiabetes);
  return facts;
}

/** The observations that satisfy the condition, or null when it does not hold. */
export function matchCondition(condition: Condition, facts: Facts): Observation[] | null {
  if ("all" in condition) {
    const evidence: Observation[] = [];
    for (const part of condition.all) {
      const matched = matchCondition(part, facts);
      if (!matched) return null;
      evidence.push(...matched);
    }
    return evidence;
  }
  if ("any" in condition) {
    let matchedAny = false;
    const evidence: Observation[] = [];
    for (const part of condition.any) {
      const matched = matchCondition(part, facts);
      if (matched) {
        matchedAny = true;
        evidence.push(...matched);
      }
    }
    return matchedAny ? evidence : null;
  }
  if ("factor" in condition) {
    const fact = facts.get(condition.factor);
    return fact && fact.value === condition.is ? [fact] : null;
  }
  const fact = facts.get(condition.measure);
  if (!fact || typeof fact.value !== "number") return null;
  return compare(fact.value, condition.op, condition.value) ? [fact] : null;
}

/**
 * For a rule limited to some weeks of pregnancy: the week on the date of each reading behind the
 * match (today's week for patient-level facts), returned as extra evidence so the reason shows it.
 * Null when any of those weeks is outside the range, so the rule does not fire. A lab value is thus
 * read against the norm of the week it was taken in, and a re-check later in pregnancy does not
 * change the meaning of an old reading.
 */
function weeksOfEvidence(
  range: GestationalWeeks,
  evidence: Observation[],
  estimatedDueDate: string | null,
  now: Date,
): Observation[] | null {
  const weeks: Observation[] = [];
  const dates = evidence.length > 0 ? evidence.map((o) => o.measuredAt) : [null];
  for (const measuredAt of dates) {
    const week = gestationalWeek(
      estimatedDueDate,
      measuredAt === null ? now : new Date(measuredAt),
    );
    if (!inWeeks(range, week)) return null;
    if (week !== null) {
      weeks.push({
        measure: "PATIENT.gestationalWeek",
        value: week,
        measuredAt,
        measurementId: null,
      });
    }
  }
  return weeks;
}

function compare(actual: number, op: Comparison, limit: number): boolean {
  switch (op) {
    case ">=":
      return actual >= limit;
    case ">":
      return actual > limit;
    case "<=":
      return actual <= limit;
    case "<":
      return actual < limit;
  }
}

function toReason(rule: Rule, zone: ElevatedZone, evidence: Observation[]): AssessmentReason {
  const seen = new Set<string>();
  const unique = evidence.filter((o) => {
    const key = `${o.measure}|${o.measurementId ?? ""}|${o.measuredAt ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const details = unique
    .map((o) => `${MEASURE_INFO[o.measure].label}: ${formatValue(o.measure, o.value)}`)
    .join("; ");
  return {
    ruleId: rule.id,
    zone,
    text: details ? `${rule.reason} (${details})` : rule.reason,
    measurementIds: [...new Set(unique.flatMap((o) => (o.measurementId ? [o.measurementId] : [])))],
    observed: unique.map((o) => ({
      measure: o.measure,
      value: o.value,
      unit: typeof o.value === "number" ? MEASURE_INFO[o.measure].unit : null,
      measuredAt: o.measuredAt,
    })),
  };
}

function highestZone(reasons: AssessmentReason[]): RiskZone {
  let zone: RiskZone = "GREEN";
  for (const reason of reasons) {
    if (ZONE_ORDER[reason.zone] > ZONE_ORDER[zone]) zone = reason.zone;
  }
  return zone;
}
