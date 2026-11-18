import type { Condition, Measure, Rule, RuleSet, WeeksRange, Zone } from "./demo-rules.ts";

export type VisitValues = Partial<Record<Measure, number>>;

export interface ReferenceResult {
  zone: Zone;
  triggered: { id: string; zone: Zone; reason: string }[];
}

const RANK: Record<Zone, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

function inWeeks(range: WeeksRange | undefined, gaWeeks: number): boolean {
  if (!range) return true;
  if (range.from !== undefined && gaWeeks < range.from) return false;
  if (range.to !== undefined && gaWeeks >= range.to) return false;
  return true;
}

function holds(c: Condition, values: VisitValues): boolean {
  const v = values[c.measure];
  if (v === undefined) return false;
  switch (c.op) {
    case ">=":
      return v >= c.value;
    case ">":
      return v > c.value;
    case "<":
      return v < c.value;
    case "<=":
      return v <= c.value;
  }
}

type PointRule = Extract<Rule, { kind: "threshold" | "all" }>;

function isPointRule(r: Rule): r is PointRule {
  return r.kind === "threshold" || r.kind === "all";
}

function fires(rule: PointRule, values: VisitValues, gaWeeks: number): boolean {
  if (!inWeeks(rule.gestationalWeeks, gaWeeks)) return false;
  return rule.kind === "threshold" ? holds(rule, values) : rule.conditions.every((c) => holds(c, values));
}

export interface DatedValue {
  measure: Measure;
  value: number;
  measuredAt: Date;
}

export function staleWarnings(history: readonly DatedValue[], gaWeeksNow: number, now: Date, ruleSet: RuleSet): string[] {
  return ruleSet.rules
    .filter((r): r is Extract<Rule, { kind: "missing" }> => r.kind === "missing")
    .filter((r) => inWeeks(r.gestationalWeeks, gaWeeksNow))
    .filter((r) => {
      const times = history.filter((h) => h.measure === r.measure).map((h) => h.measuredAt.getTime());
      if (times.length === 0) return true;
      return (now.getTime() - Math.max(...times)) / 86_400_000 > r.staleAfterDays;
    })
    .map((r) => r.id);
}

export function assessVisit(values: VisitValues, gaWeeks: number, ruleSet: RuleSet): ReferenceResult {
  const triggered = ruleSet.rules
    .filter(isPointRule)
    .filter((r) => fires(r, values, gaWeeks))
    .map((r) => ({ id: r.id, zone: r.zone, reason: r.reason.en }));
  const zone = triggered.reduce<Zone>((z, t) => (RANK[t.zone] > RANK[z] ? t.zone : z), "GREEN");
  return { zone, triggered };
}
