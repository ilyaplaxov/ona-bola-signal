import type {
  MeasurementListResponse,
  PatientDetail,
  PatientListQuery,
  PatientListResponse,
  PatientSummary,
  RiskHistoryResponse,
  UserRole,
} from "@ona-bola/shared";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { alerts, measurements, patients, riskAssessments, users } from "../db/schema";
import { ageInYears, gestationalWeek } from "../domain/pregnancy";
import { HttpError } from "../http-error";
import { riskGroupsFor } from "../risk-engine";
import { toAssessment, toMeasurement, toUserRef } from "./mappers";

// Columns shared by the registry list and the patient page. Age and gestational week are derived
// from the stored dates on every read, so they are always current.
const summaryColumns = {
  id: patients.id,
  externalReference: patients.externalReference,
  displayName: patients.displayName,
  district: patients.district,
  facility: patients.facility,
  dateOfBirth: patients.dateOfBirth,
  estimatedDueDate: patients.estimatedDueDate,
  currentRiskZone: patients.currentRiskZone,
  assignedUser: { id: users.id, displayName: users.displayName, role: users.role },
  hasDataWarnings: sql<boolean>`coalesce(jsonb_array_length(${riskAssessments.dataWarnings}) > 0, false)`,
  lastMeasurementAt:
    sql`(select max(${measurements.measuredAt}) from ${measurements} where ${measurements.patientId} = ${patients.id})`.mapWith(
      measurements.measuredAt,
    ),
  openAlertCount:
    sql`(select count(*) from ${alerts} where ${alerts.patientId} = ${patients.id} and ${alerts.status} = 'PENDING')`.mapWith(
      Number,
    ),
};

type SummaryRow = {
  id: string;
  externalReference: string;
  displayName: string;
  district: string;
  facility: string;
  dateOfBirth: string | null;
  estimatedDueDate: string | null;
  currentRiskZone: PatientSummary["currentRiskZone"];
  assignedUser: { id: string; displayName: string; role: UserRole } | null;
  hasDataWarnings: boolean;
  lastMeasurementAt: Date | null;
  openAlertCount: number;
};

function toSummary(row: SummaryRow, now: Date): PatientSummary {
  return {
    id: row.id,
    externalReference: row.externalReference,
    displayName: row.displayName,
    district: row.district,
    facility: row.facility,
    ageYears: ageInYears(row.dateOfBirth, now),
    gestationalWeek: gestationalWeek(row.estimatedDueDate, now),
    estimatedDueDate: row.estimatedDueDate,
    currentRiskZone: row.currentRiskZone,
    hasDataWarnings: row.hasDataWarnings,
    lastMeasurementAt: row.lastMeasurementAt ? row.lastMeasurementAt.toISOString() : null,
    openAlertCount: row.openAlertCount,
    assignedUser: row.assignedUser ? toUserRef(row.assignedUser) : null,
  };
}

/** Escapes % and _ so a search term is matched literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Registry order: Red, Yellow, Not assessed, Green; then by name.
const zoneOrder = sql`case
  when ${patients.currentRiskZone} = 'RED' then 0
  when ${patients.currentRiskZone} = 'YELLOW' then 1
  when ${patients.currentRiskZone} is null then 2
  else 3 end`;

export async function listPatients(
  db: DbExecutor,
  query: PatientListQuery,
  now: Date,
): Promise<PatientListResponse> {
  const filters: SQL[] = [];
  if (query.q) {
    const pattern = likePattern(query.q);
    const match = or(
      ilike(patients.displayName, pattern),
      ilike(patients.externalReference, pattern),
    );
    if (match) filters.push(match);
  }
  if (query.zone === "NOT_ASSESSED") filters.push(isNull(patients.currentRiskZone));
  else if (query.zone) filters.push(eq(patients.currentRiskZone, query.zone));
  if (query.district) filters.push(eq(patients.district, query.district));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ total: sql`count(*)`.mapWith(Number) })
    .from(patients)
    .where(where);

  const rows = await db
    .select(summaryColumns)
    .from(patients)
    .leftJoin(users, eq(users.id, patients.assignedUserId))
    .leftJoin(riskAssessments, eq(riskAssessments.id, patients.currentAssessmentId))
    .where(where)
    .orderBy(zoneOrder, asc(patients.displayName), asc(patients.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    items: rows.map((row) => toSummary(row, now)),
    total: countRow?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPatient(db: DbExecutor, id: string, now: Date): Promise<PatientDetail> {
  const [row] = await db
    .select({
      ...summaryColumns,
      riskFactors: patients.riskFactors,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
      assessment: riskAssessments,
    })
    .from(patients)
    .leftJoin(users, eq(users.id, patients.assignedUserId))
    .leftJoin(riskAssessments, eq(riskAssessments.id, patients.currentAssessmentId))
    .where(eq(patients.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Patient not found");

  // The postpartum-haemorrhage scale reads the latest haemoglobin.
  const [latestHb] = await db
    .select({ value: measurements.value })
    .from(measurements)
    .where(and(eq(measurements.patientId, id), eq(measurements.type, "HEMOGLOBIN")))
    .orderBy(desc(measurements.measuredAt))
    .limit(1);
  const summary = toSummary(row, now);

  return {
    ...summary,
    dateOfBirth: row.dateOfBirth,
    riskFactors: row.riskFactors,
    riskGroups: riskGroupsFor({
      riskFactors: row.riskFactors,
      ageYears: summary.ageYears,
      latestHbGL: latestHb && "value" in latestHb.value ? latestHb.value.value : null,
    }),
    currentAssessment: row.assessment ? toAssessment(row.assessment) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 404 unless the patient exists. */
export async function assertPatientExists(db: DbExecutor, id: string): Promise<void> {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Patient not found");
}

/** Oldest first, ordered by when the value was measured (not when it was entered). */
export async function listMeasurements(
  db: DbExecutor,
  patientId: string,
): Promise<MeasurementListResponse> {
  await assertPatientExists(db, patientId);
  const rows = await db
    .select({
      measurement: measurements,
      recordedBy: { id: users.id, displayName: users.displayName, role: users.role },
    })
    .from(measurements)
    .innerJoin(users, eq(users.id, measurements.recordedBy))
    .where(eq(measurements.patientId, patientId))
    .orderBy(asc(measurements.measuredAt), asc(measurements.type));
  return { items: rows.map((r) => toMeasurement(r.measurement, toUserRef(r.recordedBy))) };
}

/** Every stored assessment, newest first. */
export async function getRiskHistory(
  db: DbExecutor,
  patientId: string,
): Promise<RiskHistoryResponse> {
  await assertPatientExists(db, patientId);
  const rows = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.patientId, patientId))
    .orderBy(desc(riskAssessments.assessedAt), desc(riskAssessments.createdAt));
  const history = rows.map(toAssessment);
  return { latest: history[0] ?? null, history };
}
