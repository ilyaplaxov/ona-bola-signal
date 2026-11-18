import { describe, expect, it } from "vitest";
import { decideAlert, type AlertPolicyInput } from "../src/services/alert-policy";

const base: AlertPolicyInput = {
  previousZone: "GREEN",
  previousRedRuleIds: [],
  zone: "GREEN",
  reasons: [],
  pending: [],
};
const red = (ruleId: string) => ({ ruleId, zone: "RED" as const });
const yellow = (ruleId: string) => ({ ruleId, zone: "YELLOW" as const });

describe("alert policy", () => {
  it("never alerts on GREEN", () => {
    expect(decideAlert({ ...base, previousZone: "RED" })).toBeNull();
  });

  it("alerts when the zone gets worse, naming only the rules that decided the zone", () => {
    expect(
      decideAlert({
        ...base,
        zone: "RED",
        reasons: [yellow("BP-HIGH"), red("PE"), yellow("PROT")],
      }),
    ).toEqual({ severity: "RED", triggeredRuleIds: ["PE"], why: "ZONE_WORSENED" });
    expect(decideAlert({ ...base, zone: "YELLOW", reasons: [yellow("HB-LOW")] })).toMatchObject({
      severity: "YELLOW",
    });
  });

  it("alerts on a first assessment only when it is RED", () => {
    const first = { ...base, previousZone: null };
    expect(decideAlert({ ...first, zone: "YELLOW", reasons: [yellow("RF-CS")] })).toBeNull();
    expect(decideAlert({ ...first, zone: "RED", reasons: [red("HB-SEVERE")] })).toMatchObject({
      severity: "RED",
    });
  });

  it("stays quiet while a patient stays red for the same reason", () => {
    const input = {
      ...base,
      previousZone: "RED" as const,
      previousRedRuleIds: ["PE"],
      zone: "RED" as const,
      reasons: [red("PE")],
    };
    expect(decideAlert(input)).toBeNull();
  });

  it("alerts when a red patient gets a new red reason", () => {
    const input = {
      ...base,
      previousZone: "RED" as const,
      previousRedRuleIds: ["HB-SEVERE"],
      zone: "RED" as const,
      reasons: [red("HB-SEVERE"), red("BP-SEVERE")],
    };
    expect(decideAlert(input)).toEqual({
      severity: "RED",
      triggeredRuleIds: ["BP-SEVERE"],
      why: "NEW_RED_RULE",
    });
  });

  it("does not duplicate an alert that is still pending", () => {
    const input = {
      ...base,
      zone: "YELLOW" as const,
      reasons: [yellow("BP-HIGH")],
      pending: [{ severity: "YELLOW" as const, triggeredRuleIds: ["BP-HIGH"] }],
    };
    expect(decideAlert(input)).toBeNull();
    const higher = {
      ...input,
      pending: [{ severity: "RED" as const, triggeredRuleIds: ["BP-HIGH"] }],
    };
    expect(decideAlert(higher)).toBeNull();
  });
});
