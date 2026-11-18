import type { RuleSet } from "../types";

// Clinically validated rules: each with a cited source (protocol, order number, page) and reviewed by a
// named clinician, recorded in docs/RULES_PROVENANCE.md. Empty until the domain mentor confirms them.
// Select it with RULE_SET=validated once it has rules.
export const VALIDATED_RULE_SET: RuleSet = {
  id: "validated",
  version: "validated-0.0",
  kind: "VALIDATED",
  rules: [],
};
