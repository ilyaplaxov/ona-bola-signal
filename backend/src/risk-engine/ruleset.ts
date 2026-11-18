import { GestationalWeeks, RuleSetInfo, RuleSource, type MeasureKey } from "@ona-bola/shared";
import { formatValue, MEASURE_INFO } from "./measures";
import { DEMO_RULE_SET } from "./rules/demo-rules";
import { VALIDATED_RULE_SET } from "./rules/validated-rules";
import type { Condition, Rule, RuleSet } from "./types";
import { describeWeeks } from "./weeks";

export type RuleSetName = "demo" | "validated";

/** The rule set the API uses, chosen with RULE_SET. Fails loudly on an empty or invalid set. */
export function getRuleSet(name: RuleSetName): RuleSet {
  const ruleSet = name === "validated" ? VALIDATED_RULE_SET : DEMO_RULE_SET;
  if (ruleSet.rules.length === 0) {
    throw new Error(`Rule set "${name}" has no rules yet. Use RULE_SET=demo until it is filled.`);
  }
  const problems = validateRuleSet(ruleSet);
  if (problems.length > 0) {
    throw new Error(`Rule set "${name}" is invalid:\n- ${problems.join("\n- ")}`);
  }
  return ruleSet;
}

/** Structural checks for a rule set. Returns an empty list when it is fine. */
export function validateRuleSet(ruleSet: RuleSet): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const rule of ruleSet.rules) {
    if (seen.has(rule.id)) problems.push(`duplicate rule id ${rule.id}`);
    seen.add(rule.id);
    if (ruleSet.kind === "ILLUSTRATIVE" && !rule.id.startsWith("DEMO-")) {
      problems.push(`${rule.id}: illustrative rule ids start with DEMO-`);
    }
    if (ruleSet.kind === "VALIDATED" && rule.source.status !== "VALIDATED") {
      problems.push(`${rule.id}: a validated rule set holds only validated rules`);
    }
    if (!RuleSource.safeParse(rule.source).success) {
      problems.push(`${rule.id}: a validated rule needs a source reference`);
    }
    if (
      rule.kind !== "TREND" &&
      rule.gestationalWeeks !== undefined &&
      !GestationalWeeks.safeParse(rule.gestationalWeeks).success
    ) {
      problems.push(`${rule.id}: a week range needs whole weeks, at least one end and from < to`);
    }
    if (rule.kind === "THRESHOLD" && hasEmptyGroup(rule.when)) {
      problems.push(`${rule.id}: empty "all" or "any" group`);
    }
    if (rule.kind === "TREND" && (!Number.isInteger(rule.minReadings) || rule.minReadings < 2)) {
      problems.push(`${rule.id}: a trend needs a whole number of at least 2 readings`);
    }
    if (
      rule.kind === "DATA_QUALITY" &&
      rule.check === "STALE" &&
      !(rule.staleAfterDays !== undefined && rule.staleAfterDays > 0)
    ) {
      problems.push(`${rule.id}: a STALE check needs staleAfterDays`);
    }
  }
  return problems;
}

function hasEmptyGroup(condition: Condition): boolean {
  if ("all" in condition) return condition.all.length === 0 || condition.all.some(hasEmptyGroup);
  if ("any" in condition) return condition.any.length === 0 || condition.any.some(hasEmptyGroup);
  return false;
}

/** Every input a rule reads, in first-use order. A week range adds the gestational week. */
export function measuresOf(rule: Rule): MeasureKey[] {
  const found: MeasureKey[] = [];
  const add = (key: MeasureKey) => {
    if (!found.includes(key)) found.push(key);
  };
  const walk = (c: Condition): void => {
    if ("all" in c) c.all.forEach(walk);
    else if ("any" in c) c.any.forEach(walk);
    else add("factor" in c ? c.factor : c.measure);
  };
  if (rule.kind === "THRESHOLD") walk(rule.when);
  else add(rule.measure);
  if (rule.kind !== "TREND" && rule.gestationalWeeks) add("PATIENT.gestationalWeek");
  return found;
}

const OP_TEXT = { ">=": "≥", ">": ">", "<=": "≤", "<": "<" } as const;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** `parent` is the connector of the enclosing group; brackets appear only where they change the meaning. */
function describeCondition(condition: Condition, parent: "and" | "or" | null): string {
  if ("all" in condition || "any" in condition) {
    const parts = "all" in condition ? condition.all : condition.any;
    const connector = "all" in condition ? "and" : "or";
    const text = parts.map((p) => describeCondition(p, connector)).join(` ${connector} `);
    return parent !== null && parent !== connector && parts.length > 1 ? `(${text})` : text;
  }
  if ("factor" in condition) {
    return `${MEASURE_INFO[condition.factor].label} recorded as ${condition.is ? "yes" : "no"}`;
  }
  return `${MEASURE_INFO[condition.measure].label} ${OP_TEXT[condition.op]} ${formatValue(condition.measure, condition.value)}`;
}

/** Plain-language description of a rule, generated from its definition so it cannot drift. */
export function describeRule(rule: Rule): string {
  switch (rule.kind) {
    case "THRESHOLD": {
      const condition = capitalize(describeCondition(rule.when, null));
      if (!rule.gestationalWeeks) return condition;
      const weeks = describeWeeks(rule.gestationalWeeks);
      return "unknown" in rule.gestationalWeeks
        ? `${condition}, ${weeks}`
        : `${condition}, for a reading taken ${weeks}`;
    }
    case "TREND": {
      const label = MEASURE_INFO[rule.measure].label;
      const by =
        rule.minChange === undefined
          ? ""
          : ` by at least ${formatValue(rule.measure, rule.minChange)}`;
      const effect = rule.zone ? "" : "; reported only";
      return `${capitalize(label)} ${rule.direction === "RISING" ? "rising" : "falling"} across ${rule.minReadings} consecutive readings${by}${effect}`;
    }
    case "DATA_QUALITY": {
      const label = capitalize(MEASURE_INFO[rule.measure].label);
      const effect = rule.zone ? "" : "; warning only";
      const weeks = rule.gestationalWeeks ? `, ${describeWeeks(rule.gestationalWeeks)}` : "";
      return rule.check === "MISSING"
        ? `${label} not recorded${weeks}${effect}`
        : `${label}: latest reading older than ${rule.staleAfterDays} days${weeks}${effect}`;
    }
  }
}

/** The rule set as the API shows it (GET /api/ruleset). */
export function toRuleSetInfo(ruleSet: RuleSet): RuleSetInfo {
  return RuleSetInfo.parse({
    id: ruleSet.id,
    version: ruleSet.version,
    kind: ruleSet.kind,
    rules: ruleSet.rules.map((rule) => ({
      id: rule.id,
      kind: rule.kind,
      measures: measuresOf(rule),
      zone: rule.zone,
      description: describeRule(rule),
      source: rule.source,
      ...(rule.kind !== "TREND" && rule.gestationalWeeks
        ? { gestationalWeeks: rule.gestationalWeeks }
        : {}),
    })),
  });
}
