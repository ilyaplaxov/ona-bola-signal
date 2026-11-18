import type {
  Alert,
  AssessmentResult,
  MeasurementReading,
  RiskAssessment,
  RiskZone,
} from "@ona-bola/shared";
import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { alerts, measurements, patients, riskAssessments } from "../db/schema";
import type { EngineInput } from "../risk-engine";
import { decideAlert } from "./alert-policy";
import { createAlert } from "./alert.service";
import { recordAudit } from "./audit.service";
import { toAssessment } from "./mappers";

/** The patient fields the pipeline needs, read before the new assessment is stored. */
export interface PatientState {
  id: string;
  externalReference: string;
  currentRiskZone: RiskZone | null;
  currentAssessmentId: string | null;
}

/** Everything the Risk Engine needs about one patient, straight from the database. */
export async function buildEngineInput(tx: DbExecutor, patientId: string): Promise<EngineInput> {
  const [patient] = await tx
    .select({
      dateOfBirth: patients.dateOfBirth,
      estimatedDueDate: patients.estimatedDueDate,
      riskFactors: patients.riskFactors,
    })
    .from(patients)
    .where(eq(patients.id, patientId));
  if (!patient) throw new Error(`Patient ${patientId} not found`);

  const rows = await tx
    .select({
      id: measurements.id,
      type: measurements.type,
      value: measurements.value,
      unit: measurements.unit,
      measuredAt: measurements.measuredAt,
    })
    .from(measurements)
    .where(eq(measurements.patientId, patientId));

  return {
    patientId,
    ...patient,
    // Passed as stored: the engine validates every reading and reports bad ones as data warnings.
    measurements: rows.map((r) => ({
      id: r.id,
      measuredAt: r.measuredAt.toISOString(),
      reading: { type: r.type, ...r.value, unit: r.unit } as MeasurementReading,
    })),
  };
}

export interface RecordedAssessment {
  assessment: RiskAssessment;
  previousZone: RiskZone | null;
  newAlerts: Alert[];
}

/**
 * Stores a Risk Engine result: the assessment, the patient's current zone, the alert the policy
 * asks for, and the audit entries. Call it inside the transaction that wrote the new data.
 * Used by the live API and by the seed script, so both follow exactly the same rules.
 */
export async function recordAssessment(
  tx: DbExecutor,
  args: {
    patient: PatientState;
    result: AssessmentResult;
    triggerSubmissionId: string | null;
    at: Date;
    ids?: { assessment?: string; alert?: string };
  },
): Promise<RecordedAssessment> {
  const { patient, result } = args;

  let previousRedRuleIds: string[] = [];
  if (patient.currentAssessmentId) {
    const [previous] = await tx
      .select({ reasons: riskAssessments.reasons })
      .from(riskAssessments)
      .where(eq(riskAssessments.id, patient.currentAssessmentId));
    previousRedRuleIds = (previous?.reasons ?? [])
      .filter((r) => r.zone === "RED")
      .map((r) => r.ruleId);
  }

  const [row] = await tx
    .insert(riskAssessments)
    .values({
      ...(args.ids?.assessment ? { id: args.ids.assessment } : {}),
      ...result,
      triggerSubmissionId: args.triggerSubmissionId,
      assessedAt: new Date(result.assessedAt),
      createdAt: args.at,
    })
    .returning();
  if (!row) throw new Error("Assessment insert returned no row");

  await tx
    .update(patients)
    .set({ currentRiskZone: result.zone, currentAssessmentId: row.id, updatedAt: args.at })
    .where(eq(patients.id, patient.id));

  await recordAudit(tx, {
    actorUserId: null,
    action: "RISK_ASSESSED",
    entityType: "RISK_ASSESSMENT",
    entityId: row.id,
    patientId: patient.id,
    metadata: {
      zone: result.zone,
      previousZone: patient.currentRiskZone,
      ruleSetVersion: result.ruleSetVersion,
      trigger: args.triggerSubmissionId ? "measurements" : "re-check",
    },
    createdAt: args.at,
  });

  const pending = await tx
    .select({ severity: alerts.severity, triggeredRuleIds: alerts.triggeredRuleIds })
    .from(alerts)
    .where(and(eq(alerts.patientId, patient.id), eq(alerts.status, "PENDING")));

  const decision = decideAlert({
    previousZone: patient.currentRiskZone,
    previousRedRuleIds,
    zone: result.zone,
    reasons: result.reasons,
    pending,
  });

  const newAlerts: Alert[] = [];
  if (decision) {
    newAlerts.push(
      await createAlert(tx, {
        patient,
        assessmentId: row.id,
        decision,
        reasons: result.reasons,
        at: args.at,
        ...(args.ids?.alert ? { id: args.ids.alert } : {}),
      }),
    );
  }

  return { assessment: toAssessment(row), previousZone: patient.currentRiskZone, newAlerts };
}
