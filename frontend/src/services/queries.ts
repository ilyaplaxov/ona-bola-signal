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
  type CurrentUser,
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
import { useCurrentUser } from "../app/auth";
import type { Lang } from "../i18n/strings";
import { ApiError, isMissingRoute, requestJson, sendJson } from "./api";
import { tempAttachments, tempReferrals, tempSignals } from "./temp-api";

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

export function usePatients(filters: { q?: string; zone?: ZoneFilter; district?: string }) {
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
//
// TEMP(api): each call goes to the real endpoint (shared/src/api.ts). Only when the server has no
// such route yet ("No route for ...") does the in-browser stand-in in temp-api.ts answer instead.
// Delete `orTemp` and temp-api.ts once participant 1's endpoints are live.
// ---------------------------------------------------------------------------------------------

async function orTemp<T>(real: () => Promise<T>, temp: () => T): Promise<T> {
  try {
    return await real();
  } catch (error) {
    if (isMissingRoute(error)) return temp();
    throw error;
  }
}

function need(me: CurrentUser | null): CurrentUser {
  if (!me) throw new ApiError(401, "ACTOR_REQUIRED", "Sign in first");
  return me;
}

export function useReferrals(filters: {
  box?: ReferralListQuery["box"];
  status?: ReferralStatus;
  patientId?: string;
  enabled?: boolean;
}) {
  const me = useCurrentUser();
  const box = filters.box ?? "all";
  return useQuery({
    queryKey: ["referrals", box, filters.status, filters.patientId, me?.id],
    enabled: me !== null && filters.enabled !== false,
    queryFn: () =>
      orTemp(
        () =>
          requestJson(
            `/api/referrals${query({ box, status: filters.status, patientId: filters.patientId })}`,
            ReferralListResponse,
          ),
        () => ({
          items: tempReferrals.list(
            {
              box,
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.patientId ? { patientId: filters.patientId } : {}),
            },
            need(me),
          ),
        }),
      ),
    refetchInterval: LIVE_MS,
  });
}

export function useCreateReferral(patientId: string, patientReference: string) {
  const client = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: (body: CreateReferralRequest) =>
      orTemp(
        () => sendJson(`/api/patients/${patientId}/referrals`, Referral, body, "POST"),
        () => tempReferrals.create(patientId, patientReference, body, need(me)),
      ),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** One action per call: accept, conclude, close or cancel. */
export function useUpdateReferral() {
  const client = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReferralActionRequest }) =>
      orTemp(
        () => sendJson(`/api/referrals/${id}`, Referral, body, "PATCH"),
        () => tempReferrals.act(id, body, need(me)),
      ),
    onSuccess: () => client.invalidateQueries(),
  });
}

export const useAttachments = (patientId: string) =>
  useQuery({
    queryKey: ["attachments", patientId],
    queryFn: () =>
      orTemp(
        () => requestJson(`/api/patients/${patientId}/attachments`, AttachmentListResponse),
        () => ({ items: tempAttachments.list(patientId) }),
      ),
    refetchInterval: LIVE_MS,
  });

/** Multipart upload (shared/src/attachment.ts): the file plus its type and an optional note. */
export function useUploadAttachment(patientId: string) {
  const client = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: ({
      file,
      kind,
      description,
    }: {
      file: File;
      kind: AttachmentKind;
      description?: string | undefined;
    }) =>
      orTemp(
        () => {
          const form = new FormData();
          form.set("file", file);
          form.set("kind", kind);
          if (description?.trim()) form.set("description", description.trim());
          return requestJson(`/api/patients/${patientId}/attachments`, Attachment, {
            method: "POST",
            body: form,
          });
        },
        () => tempAttachments.upload(patientId, file, { kind, description }, need(me)),
      ),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** Claude reads an uploaded report into a draft; nothing is saved (no stand-in: AI needs the server). */
export const useAnalyzeDocument = () =>
  useMutation({
    mutationFn: ({ id, language }: { id: string; language: Lang }) =>
      sendJson(`/api/attachments/${id}/analyze`, AnalyzeDocumentResponse, { language }, "POST"),
  });

/** DIMED delivery status of a patient's records; mode OFF with no items while the server lacks it. */
export const useDimed = (patientId: string) =>
  useQuery({
    queryKey: ["dimed", patientId],
    queryFn: () =>
      orTemp(
        () => requestJson(`/api/patients/${patientId}/dimed`, DimedStatusResponse),
        () => ({ mode: "OFF" as const, items: [] }),
      ),
    refetchInterval: LIVE_MS,
  });

export const useSignals = (
  filters: { status?: SignalStatus; patientId?: string },
  enabled = true,
) =>
  useQuery({
    queryKey: ["signals", filters],
    enabled,
    queryFn: () =>
      orTemp(
        () => requestJson(`/api/signals${query(filters)}`, SignalListResponse),
        () => ({ items: tempSignals.list(filters) }),
      ),
    refetchInterval: LIVE_MS,
  });

/**
 * Numbers for the header badges and the dashboard: the server's own counts (DashboardStats.newSignals
 * and incomingReferrals) once it sends them; until then (TEMP) they are counted from the lists.
 */
export function useInboxCounts() {
  const stats = useDashboard().data;
  const fromServer = stats?.newSignals !== undefined;
  const wait = stats === undefined || fromServer;
  const signals = useSignals({ status: "NEW" }, !wait);
  const referrals = useReferrals({ box: "incoming", status: "SENT", enabled: !wait });
  if (stats && fromServer) {
    return {
      newSignals: stats.newSignals?.total ?? 0,
      escalatedSignals: stats.newSignals?.escalated ?? 0,
      incomingReferrals: stats.incomingReferrals ?? 0,
    };
  }
  return {
    newSignals: signals.data?.items.length ?? 0,
    escalatedSignals: signals.data?.items.filter((x) => x.escalated).length ?? 0,
    incomingReferrals: referrals.data?.items.length ?? 0,
  };
}

/** Mark what was done about a patient's signal: contacted, called in, sent to hospital. */
export function useHandleSignal() {
  const client = useQueryClient();
  const me = useCurrentUser();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<SignalStatus, "NEW"> }) =>
      orTemp(
        () => sendJson(`/api/signals/${id}`, PatientSignal, { status }, "PATCH"),
        () => tempSignals.handle(id, status, need(me)),
      ),
    onSuccess: () => client.invalidateQueries(),
  });
}

/** One-time code (and Telegram / website links) that connects a patient to the signal channel. */
export function useIssueSignalLink(patientId: string, patientReference: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      orTemp(
        () =>
          sendJson(`/api/patients/${patientId}/signal-link`, SignalLinkResponse, undefined, "POST"),
        () => tempSignals.issueLink(patientId, patientReference),
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["patient", patientId] }),
  });
}

/** Whether the web page of this patient is connected: the server's flag, or the stand-in's. */
export const tempSignalLinked = (patientId: string): boolean => tempSignals.isLinked(patientId);

/** /signal page, no sign-in: the patient enters the code and agrees. */
export const redeemSignalCode = (code: string, language: Lang) =>
  orTemp(
    () =>
      sendJson(
        "/api/public/signal/redeem",
        RedeemSignalCodeResponse,
        { code, consent: true, language },
        "POST",
      ),
    () => tempSignals.redeem(code),
  );

/** /signal page: one tap on a sign. Returns what the patient is told at once. */
export const sendPatientSignal = (token: string, kind: SignalKind) =>
  orTemp(
    () => sendJson("/api/public/signal", SendSignalResponse, { token, kind }, "POST"),
    () => tempSignals.send(token, kind),
  );
