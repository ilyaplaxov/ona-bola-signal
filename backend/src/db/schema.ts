import type { AssessmentReason, DataWarning, RiskFactors, TrendFinding } from "@ona-bola/shared";
import {
  bigserial,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Drizzle table definitions (brief section 11, with the changes recorded in docs/DECISIONS.md).
// After changing this file run `npm run db:generate -- --name <change>` and commit the new SQL file.
// Never edit a migration that is already merged.

export const userRole = pgEnum("user_role", ["DOCTOR", "NURSE", "SPECIALIST", "MANAGER"]);
export const riskZone = pgEnum("risk_zone", ["GREEN", "YELLOW", "RED"]);
export const alertSeverity = pgEnum("alert_severity", ["YELLOW", "RED"]);
export const alertStatus = pgEnum("alert_status", ["PENDING", "ACKNOWLEDGED", "RESOLVED"]);
export const measurementType = pgEnum("measurement_type", [
  "BLOOD_PRESSURE",
  "HEMOGLOBIN",
  "PROTEINURIA",
  "GLUCOSE",
]);
export const measurementSource = pgEnum("measurement_source", [
  "MANUAL",
  "AI_ASSISTED",
  "DEMO_SEED",
]);
export const ruleSetKind = pgEnum("rule_set_kind", ["ILLUSTRATIVE", "VALIDATED"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Demo actors chosen with the role switcher. No passwords. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull(),
  district: text("district"),
  createdAt: createdAt(),
});

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalReference: text("external_reference").notNull().unique(),
    displayName: text("display_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    district: text("district").notNull(),
    facility: text("facility").notNull(),
    /** The gestational week is derived from this when read, so it never goes stale. */
    estimatedDueDate: date("estimated_due_date"),
    riskFactors: jsonb("risk_factors").$type<RiskFactors>().notNull().default({}),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Cached copy of the latest assessment's zone; null means "not assessed". */
    currentRiskZone: riskZone("current_risk_zone"),
    currentAssessmentId: uuid("current_assessment_id").references(
      (): AnyPgColumn => riskAssessments.id,
      { onDelete: "set null" },
    ),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("patients_district_idx").on(t.district),
    index("patients_current_zone_idx").on(t.currentRiskZone),
  ],
);

/** Value stored for one reading: blood pressure keeps both numbers, the others one value. */
export type MeasurementValue = { systolic: number; diastolic: number } | { value: number };

export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** One visit (one form submission) shares a submission id; a retry reuses it. */
    submissionId: uuid("submission_id").notNull(),
    type: measurementType("type").notNull(),
    value: jsonb("value").$type<MeasurementValue>().notNull(),
    unit: text("unit").notNull(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    source: measurementSource("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("measurements_submission_type_uq").on(t.submissionId, t.type),
    index("measurements_patient_time_idx").on(t.patientId, t.measuredAt),
  ],
);

/** Insert-only history of Risk Engine results. */
export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** The visit that triggered the assessment; null for a re-check without new data. */
    triggerSubmissionId: uuid("trigger_submission_id").unique(),
    zone: riskZone("zone").notNull(),
    triggeredRuleIds: jsonb("triggered_rule_ids").$type<string[]>().notNull(),
    reasons: jsonb("reasons").$type<AssessmentReason[]>().notNull(),
    trendFindings: jsonb("trend_findings").$type<TrendFinding[]>().notNull(),
    dataWarnings: jsonb("data_warnings").$type<DataWarning[]>().notNull(),
    ruleSetVersion: text("rule_set_version").notNull(),
    ruleSetKind: ruleSetKind("rule_set_kind").notNull(),
    inputHash: text("input_hash").notNull(),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("risk_assessments_patient_time_idx").on(t.patientId, t.assessedAt)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    riskAssessmentId: uuid("risk_assessment_id")
      .notNull()
      .references(() => riskAssessments.id, { onDelete: "cascade" }),
    severity: alertSeverity("severity").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    triggeredRuleIds: jsonb("triggered_rule_ids").$type<string[]>().notNull(),
    recipientRole: userRole("recipient_role").notNull(),
    status: alertStatus("status").notNull().default("PENDING"),
    createdAt: createdAt(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  },
  (t) => [
    index("alerts_status_created_idx").on(t.status, t.createdAt),
    index("alerts_patient_idx").on(t.patientId),
  ],
);

/** Append-only audit trail. No update or delete route exists. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null means the system. */
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    /**
     * Insertion order. Events written in one transaction share a timestamp, so lists sort by
     * (created_at, seq) to show them in the order they happened. Added in migration 0001.
     */
    seq: bigserial("seq", { mode: "number" }).notNull(),
  },
  (t) => [
    index("audit_logs_patient_time_idx").on(t.patientId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);
