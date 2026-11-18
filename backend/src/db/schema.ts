import type {
  AssessmentReason,
  AttachmentContentType,
  AttachmentKind,
  DimedRecordType,
  DimedSyncStatus,
  Language,
  SignalChannel,
  SignalKind,
  SignalStatus,
  DataWarning,
  RiskFactors,
  ReferralStatus,
  ReferralUrgency,
  Specialty,
  TrendFinding,
} from "@ona-bola/shared";
import {
  bigserial,
  date,
  index,
  integer,
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

/** Staff accounts. username and passwordHash are null for accounts that cannot sign in. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull(),
  district: text("district"),
  /** Lower-case login name. */
  username: text("username").unique(),
  /** scrypt$N$r$p$salt$hash (base64url); see services/password.ts. */
  passwordHash: text("password_hash"),
  /** Consultant specialty (shared Specialty); null for obstetric staff, the alert recipient, managers. */
  specialty: text("specialty").$type<Specialty>(),
  facility: text("facility"),
  createdAt: createdAt(),
});

/** Sign-in sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable(
  "sessions",
  {
    /** hex SHA-256 of the session token. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

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
    /** LMP-equivalent start of the pregnancy, when it was dated at registration (migration 0002). */
    pregnancyStartDate: date("pregnancy_start_date"),
    /** "LMP" or "ULTRASOUND"; null for records created with a due date only. */
    datingMethod: text("dating_method").$type<"LMP" | "ULTRASOUND">(),
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

/** Referral to a consultant (shared Referral). The reason and conclusion never go to the audit log. */
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id),
    toSpecialty: text("to_specialty").$type<Specialty>().notNull(),
    /** A named consultant, or who accepted it; null while any consultant of the specialty may take it. */
    toUserId: uuid("to_user_id").references(() => users.id),
    reason: text("reason").notNull(),
    urgency: text("urgency").$type<ReferralUrgency>().notNull(),
    status: text("status").$type<ReferralStatus>().notNull(),
    conclusion: text("conclusion"),
    conclusionAttachmentIds: jsonb("conclusion_attachment_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    concludedAt: timestamp("concluded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("referrals_patient_idx").on(t.patientId),
    index("referrals_inbox_idx").on(t.toSpecialty, t.status),
    index("referrals_to_user_idx").on(t.toUserId),
  ],
);

/** Files attached to a patient. The bytes live on disk (UPLOADS_DIR) under storage_key, never the file name. */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: text("kind").$type<AttachmentKind>().notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").$type<AttachmentContentType>().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    description: text("description"),
    referralId: uuid("referral_id").references(() => referrals.id, { onDelete: "set null" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    uploadedAt: createdAt(),
  },
  (t) => [index("attachments_patient_idx").on(t.patientId, t.uploadedAt)],
);

/** One-time codes a clinician gives a patient to link the bot or the web page. Only a hash is stored. */
export const signalLinkCodes = pgTable(
  "signal_link_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull().unique(),
    issuedBy: uuid("issued_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("signal_link_codes_patient_idx").on(t.patientId)],
);

/**
 * A patient's linked device: a Telegram chat or a web-page token (hash only). Revoked when the
 * same chat links another patient. Holds no name or phone number.
 */
export const signalBindings = pgTable(
  "signal_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    channel: text("channel").$type<SignalChannel>().notNull(),
    telegramChatId: text("telegram_chat_id"),
    webTokenHash: text("web_token_hash").unique(),
    language: text("language").$type<Language>().notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("signal_bindings_patient_idx").on(t.patientId),
    index("signal_bindings_chat_idx").on(t.telegramChatId),
  ],
);

/** Signals sent by patients. Buttons only: there is no free text to store. */
export const patientSignals = pgTable(
  "patient_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    bindingId: uuid("binding_id").references(() => signalBindings.id, { onDelete: "set null" }),
    kind: text("kind").$type<SignalKind>().notNull(),
    channel: text("channel").$type<SignalChannel>().notNull(),
    status: text("status").$type<SignalStatus>().notNull(),
    createdAt: createdAt(),
    handledBy: uuid("handled_by").references(() => users.id),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [
    index("patient_signals_status_idx").on(t.status, t.createdAt),
    index("patient_signals_patient_idx").on(t.patientId),
  ],
);

/**
 * Outbox of records for DIMED (mentor items 1, 8). Written in the same transaction as the record,
 * so nothing is lost; a sender delivers each row and records the result. No payload is stored: the
 * sender builds it from the record when it sends.
 */
export const dimedOutbox = pgTable(
  "dimed_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    recordType: text("record_type").$type<DimedRecordType>().notNull(),
    recordId: text("record_id").notNull(),
    status: text("status").$type<DimedSyncStatus>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("dimed_outbox_due_idx").on(t.status, t.nextAttemptAt),
    index("dimed_outbox_patient_idx").on(t.patientId, t.createdAt),
    uniqueIndex("dimed_outbox_record_idx").on(t.recordType, t.recordId),
  ],
);
