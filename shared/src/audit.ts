import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { UserRef } from "./user";

export const AuditAction = z.enum([
  "PATIENT_CREATED",
  "PATIENT_UPDATED",
  "MEASUREMENTS_ADDED",
  "RISK_ASSESSED",
  "ALERT_CREATED",
  "ALERT_ACKNOWLEDGED",
  "RULE_SET_LOADED",
  "AI_NOTE_ANALYZED",
  "AI_EXPLANATION_GENERATED",
  "AI_CHAT_ANSWERED",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const AuditEntityType = z.enum([
  "PATIENT",
  "MEASUREMENT_SUBMISSION",
  "RISK_ASSESSMENT",
  "ALERT",
  "RULE_SET",
]);
export type AuditEntityType = z.infer<typeof AuditEntityType>;

/** Append-only record of an important action. */
export const AuditEvent = z.object({
  id: Uuid,
  /** null means the system, for example the rule set loading at startup. */
  actor: UserRef.nullable(),
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: z.string().min(1),
  /** Set on every patient-related event, so a patient's timeline is one query. */
  patientId: Uuid.nullable(),
  /** The patient's short reference (never the name), for activity feeds. */
  patientReference: z.string().min(1).nullable(),
  /** Minimal structured context. Never names, free-text notes or other personal details. */
  metadata: z.record(z.string(), z.unknown()),
  createdAt: IsoDateTime,
});
export type AuditEvent = z.infer<typeof AuditEvent>;
