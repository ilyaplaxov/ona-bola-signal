import type { CreatePatientRequest, PatientDetail, UserRef } from "@ona-bola/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { patients, users } from "../db/schema";
import { HttpError } from "../http-error";
import { recordAudit } from "./audit.service";
import { getPatient } from "./patient.service";

function invalid(path: string, message: string): HttpError {
  return new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [{ path, message }]);
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
  if (request.assignedUserId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, request.assignedUserId))
      .limit(1);
    if (!user) throw invalid("assignedUserId", "Unknown user");
  }

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
          estimatedDueDate: request.estimatedDueDate ?? null,
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
        metadata: { source: "registry-form" },
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
