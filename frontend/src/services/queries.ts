import {
  AiChatResponse,
  Alert,
  AlertListResponse,
  AnalyzeDocumentResponse,
  AnalyzeNoteResponse,
  Attachment,
  AttachmentListResponse,
  DashboardStats,
  DimedStatusResponse,
  ExplainRiskResponse,
  HealthResponse,
  MeasurementListResponse,
  PatientDetail,
  PatientListResponse,
  PatientSignal,
  RedeemSignalCodeResponse,
  Referral,
  ReferralListResponse,
  RiskHistoryResponse,
  RuleSetInfo,
  SignalLinkResponse,
  SendSignalResponse,
  SignalListResponse,
  SubmitMeasurementsResponse,
  UserListResponse,
  type AiChatRequest,
  type AlertStatus,
  type AnalyzeNoteRequest,
  type AttachmentKind,
  type CreatePatientRequest,
  type CreateReferralRequest,
  type ReferralActionRequest,
  type ReferralListQuery,
  type ReferralStatus,
  type SignalKind,
  type SignalStatus,
  type UpdatePatientRequest,
  type ExplainRiskRequest,
  type SubmitMeasurementsRequest,
  type ZoneFilter,
} from "@ona-bola/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Lang } from "../i18n/strings";
import { requestJson, sendJson } from "./api";

/** Lists that should update without a manual refresh (brief: alerts appear on their own). */
const LIVE_MS = 5_000;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const useHealth = () =>
  useQuery({
    queryKey: ["health"],
    queryFn: () => requestJson("/api/health", HealthResponse),
    refetchInterval: 10_000,
  });

export const useUsers = () =>
  useQuery({
    queryKey: ["users"],
    queryFn: () => requestJson("/api/users", UserListResponse),
    staleTime: Infinity,
  });

export const useRuleSet = () =>
  useQuery({
    queryKey: ["ruleset"],
    queryFn: () => requestJson("/api/ruleset", RuleSetInfo),
    staleTime: Infinity,
  });

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => requestJson("/api/dashboard/stats", DashboardStats),
    refetchInterval: LIVE_MS,
  });

export function usePatients(filters: {
  q?: string;
  zone?: ZoneFilter;
  district?: string;
  assigned?: "me";
}) {
  return useQuery({
    queryKey: ["patients", filters],
    queryFn: () =>
      requestJson(`/api/patients${query({ ...filters, pageSize: 100 })}`, PatientListResponse),
    refetchInterval: LIVE_MS,
  });
}

export const usePatient = (id: string) =>
  useQuery({
    queryKey: ["patient", id],
    queryFn: () => requestJson(`/api/patients/${id}`, PatientDetail),
    refetchInterval: LIVE_MS,
  });

export const useMeasurements = (id: string) =>
  useQuery({
    queryKey: ["measurements", id],
    queryFn: () => requestJson(`/api/patients/${id}/measurements`, MeasurementListResponse),
  });

export const useRiskHistory = (id: string) =>
  useQuery({
    queryKey: ["risk", id],
    queryFn: () => requestJson(`/api/patients/${id}/risk`, RiskHistoryResponse),
  });

export function useAlerts(filters: { status?: AlertStatus; patientId?: string }) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => requestJson(`/api/alerts${query(filters)}`, AlertListResponse),
    refetchInterval: LIVE_MS,
  });
}

/** Saves one visit; on success every list refreshes, so the new zone and alert show at once. */
export function useSubmitMeasurements(patientId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitMeasurementsRequest) =>
      sendJson(`/api/patients/${patientId}/measurements`, SubmitMeasurementsResponse, body, "POST"),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useAcknowledgeAlert() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      sendJson(`/api/alerts/${alertId}/acknowledge`, Alert, undefined, "PATCH"),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Registers a synthetic patient; the registry and dashboard refresh on success. */
export function useCreatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePatientRequest) =>
      sendJson("/api/patients", PatientDetail, body, "POST"),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Edits a patient; the server re-assesses her when the dating or risk factors change. */
export function useUpdatePatient(patientId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePatientRequest) =>
      sendJson(`/api/patients/${patientId}`, PatientDetail, body, "PATCH"),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Claude reads a note into a draft for the form. Nothing is saved, so nothing refreshes. */
export const useAnalyzeNote = (patientId: string) =>
  useMutation({
    mutationFn: (body: AnalyzeNoteRequest) =>
      sendJson(`/api/patients/${patientId}/analyze-note`, AnalyzeNoteResponse, body, "POST"),
  });

/** Claude explains the current assessment in the chosen language. It never changes the zone. */
export const useExplainRisk = (patientId: string) =>
  useMutation({
    mutationFn: (body: ExplainRiskRequest) =>
      sendJson(`/api/patients/${patientId}/risk/explain`, ExplainRiskResponse, body, "POST"),
  });

/** true when the server has the Claude features turned on. */
export const useAiEnabled = (): boolean => useHealth().data?.aiEnabled === true;

/** One chat turn about a patient; the conversation lives in the browser. */
export const useAiChat = (patientId: string) =>
  useMutation({
    mutationFn: (body: AiChatRequest) =>
      sendJson(`/api/patients/${patientId}/ai/chat`, AiChatResponse, body, "POST"),
  });

// ---------------------------------------------------------------------------------------------
// Referrals, documents, DIMED status, patient signals (TEAM_PLAN items 3, 6, 7, 8).
// ---------------------------------------------------------------------------------------------

export function useReferrals(filters: {
  box?: ReferralListQuery["box"];
  status?: ReferralStatus;
  patientId?: string;
  enabled?: boolean;
}) {
  const box = filters.box ?? "all";
  return useQuery({
    queryKey: ["referrals", box, filters.status, filters.patientId],
    enabled: filters.enabled !== false,
    queryFn: () =>
      requestJson(
        `/api/referrals${query({ box, status: filters.status, patientId: filters.patientId })}`,
        ReferralListResponse,
      ),
    refetchInterval: LIVE_MS,
  });
}

export function useCreateReferral(patientId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReferralRequest) =>
      sendJson(`/api/patients/${patientId}/referrals`, Referral, body, "POST"),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** One action per call: accept, conclude, close or cancel. */
export function useUpdateReferral() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReferralActionRequest }) =>
      sendJson(`/api/referrals/${id}`, Referral, body, "PATCH"),
    onSuccess: () => client.invalidateQueries(),
  });
}

export const useAttachments = (patientId: string) =>
  useQuery({
    queryKey: ["attachments", patientId],
    queryFn: () => requestJson(`/api/patients/${patientId}/attachments`, AttachmentListResponse),
    refetchInterval: LIVE_MS,
  });

/**
 * Multipart upload (shared/src/attachment.ts): the file plus its type and an optional note.
 * 413: over 10 MB; 415: not a PDF, JPG, PNG or DICOM (the server checks the content, not the name).
 */
export function useUploadAttachment(patientId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      kind,
      description,
      referralId,
    }: {
      file: File;
      kind: AttachmentKind;
      description?: string | undefined;
      referralId?: string | undefined;
    }) => {
      const form = new FormData();
      form.set("kind", kind);
      if (description?.trim()) form.set("description", description.trim());
      if (referralId) form.set("referralId", referralId);
      form.set("file", file); // the file goes last so the text fields are read first
      return requestJson(`/api/patients/${patientId}/attachments`, Attachment, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Claude reads an uploaded report into a draft; nothing is saved until the doctor confirms it. */
export const useAnalyzeDocument = () =>
  useMutation({
    mutationFn: ({ id, language }: { id: string; language: Lang }) =>
      sendJson(`/api/attachments/${id}/analyze`, AnalyzeDocumentResponse, { language }, "POST"),
  });

/** DIMED delivery status of a patient's records (mode OFF, STUB or LIVE). */
export const useDimed = (patientId: string) =>
  useQuery({
    queryKey: ["dimed", patientId],
    queryFn: () => requestJson(`/api/patients/${patientId}/dimed`, DimedStatusResponse),
    refetchInterval: LIVE_MS,
  });

export const useSignals = (filters: { status?: SignalStatus; patientId?: string } = {}) =>
  useQuery({
    queryKey: ["signals", filters],
    queryFn: () => requestJson(`/api/signals${query(filters)}`, SignalListResponse),
    refetchInterval: LIVE_MS,
  });

/** Mark what was done about a patient's signal: contacted, called in, sent to hospital. */
export function useHandleSignal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<SignalStatus, "NEW"> }) =>
      sendJson(`/api/signals/${id}`, PatientSignal, { status }, "PATCH"),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** One-time code (and Telegram / website links) that connects a patient to the signal channel. */
export function useIssueSignalLink(patientId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sendJson(`/api/patients/${patientId}/signal-link`, SignalLinkResponse, undefined, "POST"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["patient", patientId] }),
  });
}

/** /signal page, no sign-in: the patient enters the code and agrees. */
export const redeemSignalCode = (code: string, language: Lang) =>
  sendJson(
    "/api/public/signal/redeem",
    RedeemSignalCodeResponse,
    { code, consent: true, language },
    "POST",
  );

/** /signal page: one tap on a sign. Returns what the patient is told at once. */
export const sendPatientSignal = (token: string, kind: SignalKind) =>
  sendJson("/api/public/signal", SendSignalResponse, { token, kind }, "POST");

/** Numbers for the header badges and the dashboard cards, from the server's dashboard stats. */
export function useInboxCounts() {
  const stats = useDashboard().data;
  return {
    newSignals: stats?.newSignals?.total ?? 0,
    escalatedSignals: stats?.newSignals?.escalated ?? 0,
    incomingReferrals: stats?.incomingReferrals ?? 0,
  };
}
