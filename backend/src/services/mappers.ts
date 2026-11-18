import {
  MeasurementReading,
  type AuditEvent,
  type Measurement,
  type RiskAssessment,
  type UserRef,
} from "@ona-bola/shared";
import type {
  auditLogs,
  measurements,
  MeasurementValue,
  riskAssessments,
  users,
} from "../db/schema";

// Database rows → shared contract objects. Timestamps become ISO strings here and nowhere else.

type MeasurementRow = typeof measurements.$inferSelect;
type AssessmentRow = typeof riskAssessments.$inferSelect;
type UserRow = typeof users.$inferSelect;
type AuditRow = typeof auditLogs.$inferSelect;

export function toUserRef(row: Pick<UserRow, "id" | "displayName" | "role">): UserRef {
  return { id: row.id, displayName: row.displayName, role: row.role };
}

/** Splits a reading into the database columns (type, value, unit). */
export function readingToRow(reading: MeasurementReading): {
  type: MeasurementReading["type"];
  value: MeasurementValue;
  unit: string;
} {
  if (reading.type === "BLOOD_PRESSURE") {
    return {
      type: reading.type,
      value: { systolic: reading.systolic, diastolic: reading.diastolic },
      unit: reading.unit,
    };
  }
  return { type: reading.type, value: { value: reading.value }, unit: reading.unit };
}

/** Rebuilds a reading from the database columns and checks it against the contract. */
export function rowToReading(
  row: Pick<MeasurementRow, "type" | "value" | "unit">,
): MeasurementReading {
  return MeasurementReading.parse({ type: row.type, ...row.value, unit: row.unit });
}

export function toMeasurement(row: MeasurementRow, recordedBy: UserRef): Measurement {
  return {
    id: row.id,
    patientId: row.patientId,
    submissionId: row.submissionId,
    measuredAt: row.measuredAt.toISOString(),
    recordedBy,
    source: row.source,
    reading: rowToReading(row),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAssessment(row: AssessmentRow): RiskAssessment {
  return {
    id: row.id,
    patientId: row.patientId,
    zone: row.zone,
    triggeredRuleIds: row.triggeredRuleIds,
    reasons: row.reasons,
    trendFindings: row.trendFindings,
    dataWarnings: row.dataWarnings,
    ruleSetVersion: row.ruleSetVersion,
    ruleSetKind: row.ruleSetKind,
    inputHash: row.inputHash,
    assessedAt: row.assessedAt.toISOString(),
  };
}

export function toAuditEvent(
  row: AuditRow,
  actor: UserRef | null,
  patientReference: string | null,
): AuditEvent {
  return {
    id: row.id,
    actor,
    action: row.action as AuditEvent["action"],
    entityType: row.entityType as AuditEvent["entityType"],
    entityId: row.entityId,
    patientId: row.patientId,
    patientReference,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}
