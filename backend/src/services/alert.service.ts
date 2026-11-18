import type { Alert, AlertListQuery, AssessmentReason, UserRef } from "@ona-bola/shared";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { alerts, patients, users } from "../db/schema";
import { HttpError } from "../http-error";
import { ALERT_RECIPIENT_ROLE, type AlertDecision } from "./alert-policy";
import { recordAudit } from "./audit.service";
import { toUserRef } from "./mappers";

type AlertRow = typeof alerts.$inferSelect;

function toAlert(row: AlertRow, patientReference: string, acknowledgedBy: UserRef | null): Alert {
  return {
    id: row.id,
    patientId: row.patientId,
    patientReference,
    riskAssessmentId: row.riskAssessmentId,
    severity: row.severity,
    title: row.title,
    message: row.message,
    triggeredRuleIds: row.triggeredRuleIds,
    recipientRole: row.recipientRole,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    acknowledgedBy,
  };
}

/**
 * Stores an alert and its audit entry. The title and message name the patient by reference only
 * (brief section 5.5: minimal personal data in notification previews).
 */
export async function createAlert(
  tx: DbExecutor,
  args: {
    patient: { id: string; externalReference: string };
    assessmentId: string;
    decision: AlertDecision;
    reasons: AssessmentReason[];
    at: Date;
    id?: string;
  },
): Promise<Alert> {
  const { patient, decision } = args;
  const title = `${decision.severity === "RED" ? "Red" : "Yellow"} zone: ${patient.externalReference}`;
  const message = args.reasons
    .filter((r) => decision.triggeredRuleIds.includes(r.ruleId))
    .map((r) => r.text)
    .join("; ");

  const [row] = await tx
    .insert(alerts)
    .values({
      ...(args.id ? { id: args.id } : {}),
      patientId: patient.id,
      riskAssessmentId: args.assessmentId,
      severity: decision.severity,
      title,
      message: message || title,
      triggeredRuleIds: decision.triggeredRuleIds,
      recipientRole: ALERT_RECIPIENT_ROLE,
      status: "PENDING",
      createdAt: args.at,
    })
    .returning();
  if (!row) throw new Error("Alert insert returned no row");

  await recordAudit(tx, {
    actorUserId: null,
    action: "ALERT_CREATED",
    entityType: "ALERT",
    entityId: row.id,
    patientId: patient.id,
    metadata: { severity: decision.severity, why: decision.why, rules: decision.triggeredRuleIds },
    createdAt: args.at,
  });
  return toAlert(row, patient.externalReference, null);
}

/** Inbox order: pending first, red before yellow, newest first. */
export async function listAlerts(db: DbExecutor, query: AlertListQuery): Promise<Alert[]> {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(alerts.status, query.status));
  if (query.severity) filters.push(eq(alerts.severity, query.severity));
  if (query.patientId) filters.push(eq(alerts.patientId, query.patientId));

  const rows = await db
    .select({
      alert: alerts,
      patientReference: patients.externalReference,
      acknowledgedBy: { id: users.id, displayName: users.displayName, role: users.role },
    })
    .from(alerts)
    .innerJoin(patients, eq(patients.id, alerts.patientId))
    .leftJoin(users, eq(users.id, alerts.acknowledgedBy))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      sql`case when ${alerts.status} = 'PENDING' then 0 else 1 end`,
      sql`case when ${alerts.severity} = 'RED' then 0 else 1 end`,
      desc(alerts.createdAt),
    )
    .limit(200);

  return rows.map((r) =>
    toAlert(r.alert, r.patientReference, r.acknowledgedBy ? toUserRef(r.acknowledgedBy) : null),
  );
}

/**
 * Marks a pending alert as acknowledged by the acting user. Only the alert's recipient role may
 * do it (403), and only once (409).
 */
export async function acknowledgeAlert(
  db: DbExecutor,
  alertId: string,
  actor: UserRef,
  now: Date,
): Promise<Alert> {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ alert: alerts, patientReference: patients.externalReference })
      .from(alerts)
      .innerJoin(patients, eq(patients.id, alerts.patientId))
      .where(eq(alerts.id, alertId))
      .for("update");
    if (!found) throw new HttpError(404, "NOT_FOUND", "Alert not found");
    if (found.alert.recipientRole !== actor.role) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        `Only the ${found.alert.recipientRole} role can acknowledge this alert`,
      );
    }
    if (found.alert.status !== "PENDING") {
      throw new HttpError(409, "CONFLICT", "This alert has already been acknowledged");
    }

    const [updated] = await tx
      .update(alerts)
      .set({ status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedBy: actor.id })
      .where(eq(alerts.id, alertId))
      .returning();
    if (!updated) throw new Error("Alert update returned no row");

    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "ALERT_ACKNOWLEDGED",
      entityType: "ALERT",
      entityId: alertId,
      patientId: updated.patientId,
      metadata: { severity: updated.severity },
      createdAt: now,
    });
    return toAlert(updated, found.patientReference, actor);
  });
}
