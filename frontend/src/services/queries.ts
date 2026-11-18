import {
  Alert,
  AlertListResponse,
  AnalyzeNoteResponse,
  DashboardStats,
  ExplainRiskResponse,
  HealthResponse,
  MeasurementListResponse,
  PatientDetail,
  PatientListResponse,
  RiskHistoryResponse,
  RuleSetInfo,
  SubmitMeasurementsResponse,
  UserListResponse,
  type AlertStatus,
  type AnalyzeNoteRequest,
  type CreatePatientRequest,
  type ExplainRiskRequest,
  type SubmitMeasurementsRequest,
  type ZoneFilter,
} from "@ona-bola/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
