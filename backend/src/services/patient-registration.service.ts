import {
  dueDateFromStart,
  gestationalAgeDays,
  pregnancyStart,
  type Alert,
  type CreatePatientRequest,
  type PatientDetail,
  type PregnancyDating,
  type UpdatePatientRequest,
  type UserRef,
} from "@ona-bola/shared";
import { eq } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { patients, riskAssessments, users } from "../db/schema";
import { HttpError } from "../http-error";
import { assess, type RuleSet } from "../risk-engine";
import { recordAudit } from "./audit.service";
import { getPatient } from "./patient.service";
import { buildEngineInput, recordAssessment } from "./risk-assessment.service";

/**
 * Data-entry bound, not a clinical rule: no pregnancy lasts 45 weeks, so an older start date is a
 * typing error (for example the wrong year).
 */
const MAX_PREGNANCY_DAYS = 45 * 7;

function invalid(path: string, message: string): HttpError {
  return new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [{ path, message }]);
}

interface DatingColumns {
  pregnancyStartDate: string | null;
  datingMethod: "LMP" | "ULTRASOUND" | null;
  estimatedDueDate: string | null;
}

/** Start, method and derived due date for the row; checks the dates against today. */
function datingColumns(dating: PregnancyDating | null, now: Date): DatingColumns {
  if (dating === null)
    return { pregnancyStartDate: null, datingMethod: null, estimatedDueDate: null };
  const today = now.toISOString().slice(0, 10);
  const recorded = dating.method === "LMP" ? dating.lmpDate : dating.scanDate;
  const field = dating.method === "LMP" ? "dating.lmpDate" : "dating.scanDate";
  if (recorded > today) throw invalid(field, "The date cannot be in the future");

  const start = pregnancyStart(dating);
  const days = gestationalAgeDays(start, today);
  if (days > MAX_PREGNANCY_DAYS) {
    throw invalid(field, "This gives a pregnancy longer than 45 weeks: check the date");
  }
  return {
    pregnancyStartDate: start,
    datingMethod: dating.method,
    estimatedDueDate: dueDateFromStart(start),
  };
}

async function assertUserExists(db: DbExecutor, id: string): Promise<void> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw invalid("assignedUserId", "Unknown user");
}

/**
 * Registers a synthetic patient. The patient starts NOT_ASSESSED: the first visit (measurement
 * submission) produces the first assessment, as for every other patient. The audit event holds
 * no name or other personal detail.
 */
export async function createPatient(
  db: Database,
  request: CreatePatientRequest,
  actor: UserRef,
  now: Date,
): Promise<PatientDetail> {
  const today = now.toISOString().slice(0, 10);
  if (request.dateOfBirth && request.dateOfBirth > today) {
    throw invalid("dateOfBirth", "Date of birth cannot be in the future");
  }
  if (request.assignedUserId) await assertUserExists(db, request.assignedUserId);
  const dating = request.dating
    ? datingColumns(request.dating, now)
    : {
        pregnancyStartDate: null,
        datingMethod: null,
        estimatedDueDate: request.estimatedDueDate ?? null,
      };

  let patientId: string;
  try {
    patientId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(patients)
        .values({
          externalReference: request.externalReference,
          displayName: request.displayName,
          dateOfBirth: request.dateOfBirth ?? null,
          district: request.district,
          facility: request.facility,
          ...dating,
          riskFactors: request.riskFactors,
          assignedUserId: request.assignedUserId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: patients.id });
      if (!row) throw new Error("Patient insert returned no row");
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: "PATIENT_CREATED",
        entityType: "PATIENT",
        entityId: row.id,
        patientId: row.id,
        metadata: { source: "registry-form", datingMethod: dating.datingMethod },
        createdAt: now,
      });
      return row.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "CONFLICT", "A patient with this reference already exists");
    }
    throw error;
  }
  return getPatient(db, patientId, now);
}

/** Fields whose change can move the zone (age, gestational week, risk factors). */
const ENGINE_FIELDS = new Set(["dateOfBirth", "dating", "riskFactors"]);

/**
 * Edits a patient. The audit event lists the changed field names, never their values. When a
 * field the Risk Engine reads changes and the patient has been assessed, she is re-assessed at
 * once (a "re-check"), so the zone, the reasons and any alert follow the corrected record.
 */
export async function updatePatient(
  db: Database,
  ruleSet: RuleSet,
  args: { patientId: string; request: UpdatePatientRequest; actor: UserRef; now: Date },
): Promise<{ patient: PatientDetail; newAlerts: Alert[] }> {
  const { patientId, request, actor, now } = args;
  const today = now.toISOString().slice(0, 10);
  if (request.dateOfBirth && request.dateOfBirth > today) {
    throw invalid("dateOfBirth", "Date of birth cannot be in the future");
  }
  if (request.assignedUserId) await assertUserExists(db, request.assignedUserId);

  const changes: Partial<typeof patients.$inferInsert> = {};
  const changed: string[] = [];
  const set = <K extends keyof typeof patients.$inferInsert>(
    field: string,
    column: K,
    value: (typeof patients.$inferInsert)[K],
  ) => {
    changes[column] = value;
    changed.push(field);
  };
  if (request.displayName !== undefined) set("displayName", "displayName", request.displayName);
  if (request.dateOfBirth !== undefined) set("dateOfBirth", "dateOfBirth", request.dateOfBirth);
  if (request.district !== undefined) set("district", "district", request.district);
  if (request.facility !== undefined) set("facility", "facility", request.facility);
  if (request.assignedUserId !== undefined) {
    set("assignedUserId", "assignedUserId", request.assignedUserId);
  }
  if (request.riskFactors !== undefined) set("riskFactors", "riskFactors", request.riskFactors);
  if (request.dating !== undefined) {
    Object.assign(changes, datingColumns(request.dating, now));
    changed.push("dating");
  }

  const newAlerts = await db.transaction(async (tx) => {
    const [patient] = await tx
      .select({
        id: patients.id,
        externalReference: patients.externalReference,
        currentRiskZone: patients.currentRiskZone,
        currentAssessmentId: patients.currentAssessmentId,
      })
      .from(patients)
      .where(eq(patients.id, patientId))
      .for("update");
    if (!patient) throw new HttpError(404, "NOT_FOUND", "Patient not found");

    await tx
      .update(patients)
      .set({ ...changes, updatedAt: now })
      .where(eq(patients.id, patientId));
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "PATIENT_UPDATED",
      entityType: "PATIENT",
      entityId: patientId,
      patientId,
      metadata: { fields: changed },
      createdAt: now,
    });

    const [assessed] = await tx
      .select({ id: riskAssessments.id })
      .from(riskAssessments)
      .where(eq(riskAssessments.patientId, patientId))
      .limit(1);
    if (!assessed || !changed.some((f) => ENGINE_FIELDS.has(f))) return [];

    const result = assess(await buildEngineInput(tx, patientId), ruleSet, now);
    const recorded = await recordAssessment(tx, {
      patient,
      result,
      triggerSubmissionId: null,
      at: now,
    });
    return recorded.newAlerts;
  });

  return { patient: await getPatient(db, patientId, now), newAlerts };
}
