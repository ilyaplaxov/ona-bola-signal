import { z } from "zod";
import { Alert, AlertStatus } from "./alert";
import {
  AnalyzeDocumentRequest,
  AnalyzeDocumentResponse,
  Attachment,
  AttachmentListResponse,
} from "./attachment";
import { DemoAccountsResponse, LoginRequest, SessionResponse } from "./auth";
import { DimedStatusResponse } from "./dimed";
import {
  HandleSignalRequest,
  PatientSignal,
  RedeemSignalCodeRequest,
  RedeemSignalCodeResponse,
  SendSignalRequest,
  SendSignalResponse,
  SignalListQuery,
  SignalListResponse,
  SignalLinkResponse,
} from "./patient-signal";
import {
  CreateReferralRequest,
  Referral,
  ReferralActionRequest,
  ReferralListQuery,
  ReferralListResponse,
} from "./referral";
import { RiskAssessment } from "./assessment";
import { AuditEntityType, AuditEvent } from "./audit";
import { IsoDate, IsoDateTime, Language, Uuid } from "./common";
import { Measurement, MeasurementReading, MeasurementType } from "./measurement";
import { PatientDetail, PatientSummary, RiskFactors } from "./patient";
import { PregnancyDating } from "./pregnancy";
import { RuleSetInfo } from "./ruleset";
import { User } from "./user";
import { ElevatedZone, RiskZone, ZoneFilter } from "./zones";

/**
 * Header carrying the acting demo user's id. Superseded by the session cookie (SESSION_COOKIE);
 * the server accepts it only when DEMO_ACTOR_HEADER_ENABLED is on (tests, old e2e).
 */
export const DEMO_ACTOR_HEADER = "x-demo-user-id";

const Count = z.number().int().nonnegative();

// ---------- Errors: every non-2xx response has this body ----------

export const ErrorCode = z.enum([
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "ACTOR_REQUIRED",
  /** Wrong username or password (401). */
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "AI_UNAVAILABLE",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** For VALIDATION_FAILED: a list of { path, message }. */
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const IdParams = z.object({ id: Uuid });
export type IdParams = z.infer<typeof IdParams>;

// ---------- Health ----------

export const HealthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  db: z.enum(["up", "down"]),
  /** true when the Claude endpoints can answer (AI_ENABLED and a key on the server). */
  aiEnabled: z.boolean(),
  time: IsoDateTime,
});
export type HealthResponse = z.infer<typeof HealthResponse>;

// ---------- Dashboard ----------

export const DashboardStats = z.object({
  zoneCounts: z.object({ GREEN: Count, YELLOW: Count, RED: Count, NOT_ASSESSED: Count }),
  pendingAlerts: z.object({ total: Count, YELLOW: Count, RED: Count }),
  recentActivity: z.array(AuditEvent),
  /** Patient signals still NEW, and how many of them are past the escalation time. */
  newSignals: z.object({ total: Count, escalated: Count }).optional(),
  /** Referrals waiting for the signed-in consultant (status SENT, addressed to them or their specialty). */
  incomingReferrals: Count.optional(),
  /** Zone counts and pending alerts per district, for the district overview. Sorted by name. */
  districts: z
    .array(
      z.object({
        district: z.string().min(1),
        zoneCounts: z.object({ GREEN: Count, YELLOW: Count, RED: Count, NOT_ASSESSED: Count }),
        pendingAlerts: Count,
      }),
    )
    .optional(),
});
export type DashboardStats = z.infer<typeof DashboardStats>;

// ---------- Patients ----------

export const PatientListQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  /** "me": only patients assigned to the signed-in user ("My patients"). */
  assigned: z.literal("me").optional(),
  zone: ZoneFilter.optional(),
  district: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PatientListQuery = z.infer<typeof PatientListQuery>;

export const PatientListResponse = z.object({
  items: z.array(PatientSummary),
  total: Count,
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type PatientListResponse = z.infer<typeof PatientListResponse>;

export const CreatePatientRequest = z
  .object({
    externalReference: z.string().trim().min(1).max(32),
    displayName: z.string().trim().min(1).max(120),
    dateOfBirth: IsoDate.optional(),
    district: z.string().trim().min(1).max(80),
    facility: z.string().trim().min(1).max(120),
    /** Preferred: how the pregnancy is dated (LMP or ultrasound). The due date is derived from it. */
    dating: PregnancyDating.optional(),
    /** Kept for API clients that only know a due date. Not allowed together with `dating`. */
    estimatedDueDate: IsoDate.optional(),
    riskFactors: RiskFactors.default({}),
    assignedUserId: Uuid.optional(),
  })
  .refine((b) => !(b.dating && b.estimatedDueDate), {
    message: "Give either the pregnancy dating or a due date, not both",
    path: ["estimatedDueDate"],
  });
export type CreatePatientRequest = z.infer<typeof CreatePatientRequest>;

/**
 * PATCH /api/patients/:id. Every field is optional; null clears a clearable field. The reference
 * never changes (alerts and the audit log refer to it). `riskFactors` replaces the whole object.
 */
export const UpdatePatientRequest = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    dateOfBirth: IsoDate.nullable().optional(),
    district: z.string().trim().min(1).max(80).optional(),
    facility: z.string().trim().min(1).max(120).optional(),
    dating: PregnancyDating.nullable().optional(),
    riskFactors: RiskFactors.optional(),
    assignedUserId: Uuid.nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Nothing to update",
  });
export type UpdatePatientRequest = z.infer<typeof UpdatePatientRequest>;

// ---------- Measurements ----------

export const MeasurementListResponse = z.object({
  /** Ordered by measuredAt, oldest first. */
  items: z.array(Measurement),
});
export type MeasurementListResponse = z.infer<typeof MeasurementListResponse>;

/** One visit: one or more readings, at most one per type, producing exactly one assessment. */
export const SubmitMeasurementsRequest = z
  .object({
    /** Generated by the form once per visit. Re-sending the same id returns the first result. */
    submissionId: Uuid,
    measuredAt: IsoDateTime,
    /** AI_ASSISTED when the form was prefilled by analyze-note and then reviewed by the clinician. */
    source: z.enum(["MANUAL", "AI_ASSISTED"]).default("MANUAL"),
    measurements: z.array(MeasurementReading).min(1).max(MeasurementType.options.length),
  })
  .refine((b) => new Set(b.measurements.map((m) => m.type)).size === b.measurements.length, {
    message: "Each measurement type may appear only once per visit",
    path: ["measurements"],
  });
export type SubmitMeasurementsRequest = z.infer<typeof SubmitMeasurementsRequest>;

export const SubmitMeasurementsResponse = z.object({
  measurements: z.array(Measurement),
  assessment: RiskAssessment,
  previousZone: RiskZone.nullable(),
  newAlertIds: z.array(Uuid),
  /** true when this submissionId was already processed and the stored result is returned (HTTP 200). */
  replayed: z.boolean(),
});
export type SubmitMeasurementsResponse = z.infer<typeof SubmitMeasurementsResponse>;

// ---------- Risk ----------

export const RiskHistoryResponse = z.object({
  latest: RiskAssessment.nullable(),
  /** Newest first. */
  history: z.array(RiskAssessment),
});
export type RiskHistoryResponse = z.infer<typeof RiskHistoryResponse>;

// ---------- Alerts ----------

export const AlertListQuery = z.object({
  status: AlertStatus.optional(),
  severity: ElevatedZone.optional(),
  patientId: Uuid.optional(),
});
export type AlertListQuery = z.infer<typeof AlertListQuery>;

export const AlertListResponse = z.object({ items: z.array(Alert) });
export type AlertListResponse = z.infer<typeof AlertListResponse>;

// ---------- Audit ----------

export const AuditListQuery = z.object({
  patientId: Uuid.optional(),
  entityType: AuditEntityType.optional(),
  entityId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditListQuery = z.infer<typeof AuditListQuery>;

export const AuditListResponse = z.object({
  /** Newest first. */
  items: z.array(AuditEvent),
});
export type AuditListResponse = z.infer<typeof AuditListResponse>;

// ---------- Users ----------

export const UserListResponse = z.object({ items: z.array(User) });
export type UserListResponse = z.infer<typeof UserListResponse>;

// ---------- AI (phase 5, behind AI_ENABLED) ----------

export const AnalyzeNoteRequest = z.object({
  /** Synthetic note text only. */
  note: z.string().trim().min(1).max(4000),
  language: Language.default("uz"),
});
export type AnalyzeNoteRequest = z.infer<typeof AnalyzeNoteRequest>;

export const AnalyzeNoteResponse = z.object({
  /** Draft for the measurement form. Nothing is saved until the clinician submits the form. */
  draft: z.object({
    measuredAt: IsoDateTime.nullable(),
    measurements: z.array(MeasurementReading),
  }),
  /** Values that were left out (unknown unit, failed checks) and things to verify. */
  warnings: z.array(z.string()),
  model: z.string().min(1),
});
export type AnalyzeNoteResponse = z.infer<typeof AnalyzeNoteResponse>;

export const ExplainRiskRequest = z.object({ language: Language.default("uz") });
export type ExplainRiskRequest = z.infer<typeof ExplainRiskRequest>;

export const ExplainRiskResponse = z.object({
  assessmentId: Uuid,
  summary: z.string().min(1),
  keyPoints: z.array(z.string()),
  model: z.string().min(1),
  generatedAt: IsoDateTime,
});
export type ExplainRiskResponse = z.infer<typeof ExplainRiskResponse>;

/** One message of the clinician's chat about a patient. The browser keeps the conversation. */
export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const AiChatRequest = z
  .object({
    /** The whole conversation so far, oldest first, ending with the clinician's new question. */
    messages: z.array(ChatMessage).min(1).max(12),
    language: Language.default("uz"),
  })
  .refine((b) => b.messages.every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant")), {
    message: "Messages must alternate, starting and ending with the clinician",
    path: ["messages"],
  })
  .refine((b) => b.messages.length % 2 === 1, {
    message: "The last message must be the clinician's question",
    path: ["messages"],
  });
export type AiChatRequest = z.infer<typeof AiChatRequest>;

export const AiChatResponse = z.object({
  answer: z.string().min(1),
  model: z.string().min(1),
  generatedAt: IsoDateTime,
});
export type AiChatResponse = z.infer<typeof AiChatResponse>;

// ---------- Endpoint catalogue: the single list of routes both sides build against ----------

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface EndpointDef {
  method: HttpMethod;
  path: `/api/${string}`;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  response: z.ZodType;
}

/** Plain acknowledgement for actions with nothing to return. */
export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

export const endpoints = {
  health: { method: "GET", path: "/api/health", response: HealthResponse },

  // Auth: the session is an httpOnly cookie (SESSION_COOKIE).
  login: { method: "POST", path: "/api/auth/login", body: LoginRequest, response: SessionResponse },
  logout: { method: "POST", path: "/api/auth/logout", response: OkResponse },
  /** 401 ACTOR_REQUIRED when nobody is signed in. */
  me: { method: "GET", path: "/api/auth/me", response: SessionResponse },
  demoAccounts: { method: "GET", path: "/api/auth/demo-accounts", response: DemoAccountsResponse },

  dashboardStats: { method: "GET", path: "/api/dashboard/stats", response: DashboardStats },
  listPatients: {
    method: "GET",
    path: "/api/patients",
    query: PatientListQuery,
    response: PatientListResponse,
  },
  createPatient: {
    method: "POST",
    path: "/api/patients",
    body: CreatePatientRequest,
    response: PatientDetail,
  },
  updatePatient: {
    method: "PATCH",
    path: "/api/patients/:id",
    params: IdParams,
    body: UpdatePatientRequest,
    response: PatientDetail,
  },
  getPatient: {
    method: "GET",
    path: "/api/patients/:id",
    params: IdParams,
    response: PatientDetail,
  },
  listMeasurements: {
    method: "GET",
    path: "/api/patients/:id/measurements",
    params: IdParams,
    response: MeasurementListResponse,
  },
  submitMeasurements: {
    method: "POST",
    path: "/api/patients/:id/measurements",
    params: IdParams,
    body: SubmitMeasurementsRequest,
    response: SubmitMeasurementsResponse,
  },
  getRisk: {
    method: "GET",
    path: "/api/patients/:id/risk",
    params: IdParams,
    response: RiskHistoryResponse,
  },
  analyzeNote: {
    method: "POST",
    path: "/api/patients/:id/analyze-note",
    params: IdParams,
    body: AnalyzeNoteRequest,
    response: AnalyzeNoteResponse,
  },
  explainRisk: {
    method: "POST",
    path: "/api/patients/:id/risk/explain",
    params: IdParams,
    body: ExplainRiskRequest,
    response: ExplainRiskResponse,
  },
  aiChat: {
    method: "POST",
    path: "/api/patients/:id/ai/chat",
    params: IdParams,
    body: AiChatRequest,
    response: AiChatResponse,
  },
  // Referrals
  createReferral: {
    method: "POST",
    path: "/api/patients/:id/referrals",
    params: IdParams,
    body: CreateReferralRequest,
    response: Referral,
  },
  listReferrals: {
    method: "GET",
    path: "/api/referrals",
    query: ReferralListQuery,
    response: ReferralListResponse,
  },
  updateReferral: {
    method: "PATCH",
    path: "/api/referrals/:id",
    params: IdParams,
    body: ReferralActionRequest,
    response: Referral,
  },

  // Attachments. Upload (multipart) is POST /api/patients/:id/attachments, see attachment.ts.
  listAttachments: {
    method: "GET",
    path: "/api/patients/:id/attachments",
    params: IdParams,
    response: AttachmentListResponse,
  },
  getAttachment: {
    method: "GET",
    path: "/api/attachments/:id",
    params: IdParams,
    response: Attachment,
  },
  analyzeDocument: {
    method: "POST",
    path: "/api/attachments/:id/analyze",
    params: IdParams,
    body: AnalyzeDocumentRequest,
    response: AnalyzeDocumentResponse,
  },

  // DIMED delivery status for one patient
  dimedStatus: {
    method: "GET",
    path: "/api/patients/:id/dimed",
    params: IdParams,
    response: DimedStatusResponse,
  },

  // Patient signals: staff side
  issueSignalLink: {
    method: "POST",
    path: "/api/patients/:id/signal-link",
    params: IdParams,
    response: SignalLinkResponse,
  },
  listSignals: {
    method: "GET",
    path: "/api/signals",
    query: SignalListQuery,
    response: SignalListResponse,
  },
  handleSignal: {
    method: "PATCH",
    path: "/api/signals/:id",
    params: IdParams,
    body: HandleSignalRequest,
    response: PatientSignal,
  },

  // Patient signals: the patient's web page, no sign-in
  redeemSignalCode: {
    method: "POST",
    path: "/api/public/signal/redeem",
    body: RedeemSignalCodeRequest,
    response: RedeemSignalCodeResponse,
  },
  sendSignal: {
    method: "POST",
    path: "/api/public/signal",
    body: SendSignalRequest,
    response: SendSignalResponse,
  },

  listAlerts: {
    method: "GET",
    path: "/api/alerts",
    query: AlertListQuery,
    response: AlertListResponse,
  },
  acknowledgeAlert: {
    method: "PATCH",
    path: "/api/alerts/:id/acknowledge",
    params: IdParams,
    response: Alert,
  },
  listAudit: {
    method: "GET",
    path: "/api/audit",
    query: AuditListQuery,
    response: AuditListResponse,
  },
  getRuleSet: { method: "GET", path: "/api/ruleset", response: RuleSetInfo },
  listUsers: { method: "GET", path: "/api/users", response: UserListResponse },
} as const satisfies Record<string, EndpointDef>;
