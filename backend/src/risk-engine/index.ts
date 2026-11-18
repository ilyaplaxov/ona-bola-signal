// Deterministic Risk Engine: the only place where a risk zone is decided.
// Pure functions only. The backend loads data, calls assess() and stores the result.
export { assess, matchCondition } from "./evaluate";
export { describeRule, getRuleSet, measuresOf, toRuleSetInfo, validateRuleSet } from "./ruleset";
export type { RuleSetName } from "./ruleset";
export { assessRiskGroups, riskGroupsFor } from "./risk-groups";
export type { RiskProfile } from "./risk-groups";
export { DEMO_RULE_SET } from "./rules/demo-rules";
export { VALIDATED_RULE_SET } from "./rules/validated-rules";
export type {
  Condition,
  DataQualityRule,
  EngineInput,
  EngineMeasurement,
  Rule,
  RuleSet,
  ThresholdRule,
  TrendRule,
} from "./types";
