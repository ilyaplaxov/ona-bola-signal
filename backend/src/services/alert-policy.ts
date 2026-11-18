import { ZONE_ORDER, type ElevatedZone, type RiskZone } from "@ona-bola/shared";

// Default alert policy (docs/DECISIONS.md, decision 7). To confirm with the domain mentor: who
// receives which alerts, and when. Pure function, so it is easy to test and to change in one place.

/** Role that receives alerts. Its label lives in the UI; "OvaBMU" is not expanded until confirmed. */
export const ALERT_RECIPIENT_ROLE = "SPECIALIST" as const;

export interface PendingAlertSummary {
  severity: ElevatedZone;
  triggeredRuleIds: string[];
}

export interface AlertDecision {
  severity: ElevatedZone;
  /** The rules that decided the alert's severity. */
  triggeredRuleIds: string[];
  why: "ZONE_WORSENED" | "NEW_RED_RULE";
}

export interface AlertPolicyInput {
  /** Zone before this assessment; null when the patient had never been assessed. */
  previousZone: RiskZone | null;
  /** Red rules that fired in the previous assessment. */
  previousRedRuleIds: string[];
  zone: RiskZone;
  reasons: { ruleId: string; zone: ElevatedZone }[];
  /** Alerts for this patient that nobody has acknowledged yet. */
  pending: PendingAlertSummary[];
}

/**
 * - The zone got worse (GREEN → YELLOW, YELLOW → RED, GREEN → RED): alert at the new zone.
 *   A first assessment alerts only when it is RED, so registering a patient with a risk factor
 *   does not flood the inbox.
 * - The zone stayed RED but a Red rule fired that did not fire last time: alert for those rules.
 * - No duplicates: nothing new when a pending alert of the same or higher severity already
 *   covers every deciding rule.
 * - GREEN never alerts.
 */
export function decideAlert(input: AlertPolicyInput): AlertDecision | null {
  const { previousZone, zone, reasons, pending } = input;
  if (zone === "GREEN") return null;

  const deciding = reasons.filter((r) => r.zone === zone).map((r) => r.ruleId);
  const covered = (ruleId: string) =>
    pending.some(
      (alert) =>
        ZONE_ORDER[alert.severity] >= ZONE_ORDER[zone] && alert.triggeredRuleIds.includes(ruleId),
    );

  const worsened =
    previousZone === null ? zone === "RED" : ZONE_ORDER[zone] > ZONE_ORDER[previousZone];
  if (worsened) {
    return deciding.every(covered)
      ? null
      : { severity: zone, triggeredRuleIds: deciding, why: "ZONE_WORSENED" };
  }

  if (zone === "RED") {
    const fresh = deciding.filter(
      (ruleId) => !input.previousRedRuleIds.includes(ruleId) && !covered(ruleId),
    );
    if (fresh.length > 0) return { severity: "RED", triggeredRuleIds: fresh, why: "NEW_RED_RULE" };
  }
  return null;
}
