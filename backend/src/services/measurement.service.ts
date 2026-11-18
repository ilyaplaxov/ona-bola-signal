import {
  RiskZone,
  type Alert,
  type SubmitMeasurementsRequest,
  type SubmitMeasurementsResponse,
  type UserRef,
} from "@ona-bola/shared";
import { and, asc, eq } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { isUniqueViolation } from "../db/errors";
import { alerts, auditLogs, measurements, patients, riskAssessments, users } from "../db/schema";
import { HttpError } from "../http-error";
import { assess, type RuleSet } from "../risk-engine";
import { recordAudit } from "./audit.service";
import { readingToRow, toAssessment, toMeasurement, toUserRef } from "./mappers";
import { buildEngineInput, recordAssessment } from "./risk-assessment.service";

/** Measurements dated later than the server clock by more than this are rejected. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export interface SubmissionOutcome {
  /** 201 for a new submission, 200 when the same submission id was already processed. */
  status: 201 | 200;
  body: SubmitMeasurementsResponse;
  newAlerts: Alert[];
}

/**
 * One visit: validate → store the readings → run the Risk Engine on the full history → store the
 * assessment and the patient's zone → alert policy → audit. Everything happens in one transaction,
 * so a failure leaves nothing half-saved. Re-sending the same submissionId returns the first
 * result instead of storing the visit twice (brief section 5.3).
 */
export async function submitMeasurements(
  db: Database,
  ruleSet: RuleSet,
  args: { patientId: string; request: SubmitMeasurementsRequest; actor: UserRef; now: Date },
): Promise<SubmissionOutcome> {
  const { patientId, request, actor, now } = args;
  if (Date.parse(request.measuredAt) > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new HttpError(400, "VALIDATION_FAILED", "The measurement time is in the future", [
      { path: "measuredAt", message: "Must not be later than now" },
    ]);
  }

  const earlier = await loadSubmission(db, request.submissionId);
  if (earlier) return replay(earlier, patientId);

  try {
    return await db.transaction(async (tx) => {
      // Locking the patient row serialises concurrent visits for the same patient.
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

      const measuredAt = new Date(request.measuredAt);
      const stored = await tx
        .insert(measurements)
        .values(
          request.measurements.map((reading) => ({
            patientId,
            submissionId: request.submissionId,
            ...readingToRow(reading),
            measuredAt,
            recordedBy: actor.id,
            source: request.source,
            createdAt: now,
          })),
        )
        .returning();

      await recordAudit(tx, {
        actorUserId: actor.id,
        action: "MEASUREMENTS_ADDED",
        entityType: "MEASUREMENT_SUBMISSION",
        entityId: request.submissionId,
        patientId,
        metadata: { types: request.measurements.map((m) => m.type), source: request.source },
        createdAt: now,
      });

      const result = assess(await buildEngineInput(tx, patientId), ruleSet, now);
      const recorded = await recordAssessment(tx, {
        patient,
        result,
        triggerSubmissionId: request.submissionId,
        at: now,
      });

      return {
        status: 201,
        newAlerts: recorded.newAlerts,
        body: {
          measurements: stored.map((row) => toMeasurement(row, actor)),
          assessment: recorded.assessment,
          previousZone: recorded.previousZone,
          newAlertIds: recorded.newAlerts.map((a) => a.id),
          replayed: false,
        },
      };
    });
  } catch (error) {
    // Two identical submissions raced: the loser hits the unique key and gets the winner's result.
    if (isUniqueViolation(error)) {
      const winner = await loadSubmission(db, request.submissionId);
      if (winner) return replay(winner, patientId);
    }
    throw error;
  }
}

interface StoredSubmission {
  patientId: string;
  body: SubmitMeasurementsResponse;
}

function replay(stored: StoredSubmission, patientId: string): SubmissionOutcome {
  if (stored.patientId !== patientId) {
    throw new HttpError(409, "CONFLICT", "This submission id belongs to another patient");
  }
  return { status: 200, body: stored.body, newAlerts: [] };
}

/** Rebuilds the response of an already processed submission, or null if it is new. */
async function loadSubmission(
  db: DbExecutor,
  submissionId: string,
): Promise<StoredSubmission | null> {
  const rows = await db
    .select({
      measurement: measurements,
      recordedBy: { id: users.id, displayName: users.displayName, role: users.role },
    })
    .from(measurements)
    .innerJoin(users, eq(users.id, measurements.recordedBy))
    .where(eq(measurements.submissionId, submissionId))
    .orderBy(asc(measurements.type));
  const first = rows[0];
  if (!first) return null;
  const patientId = first.measurement.patientId;

  const [assessment] = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.triggerSubmissionId, submissionId));
  if (!assessment) throw new Error(`Submission ${submissionId} has no assessment`);

  // The zone before this assessment was recorded in its audit entry when it was stored.
  const [audit] = await db
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "RISK_ASSESSED"),
        eq(auditLogs.entityType, "RISK_ASSESSMENT"),
        eq(auditLogs.entityId, assessment.id),
      ),
    )
    .limit(1);
  const previousZone = RiskZone.nullable()
    .catch(null)
    .parse(audit?.metadata.previousZone ?? null);

  const alertRows = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(eq(alerts.riskAssessmentId, assessment.id));

  return {
    patientId,
    body: {
      measurements: rows.map((r) => toMeasurement(r.measurement, toUserRef(r.recordedBy))),
      assessment: toAssessment(assessment),
      previousZone,
      newAlertIds: alertRows.map((a) => a.id),
      replayed: true,
    },
  };
}
