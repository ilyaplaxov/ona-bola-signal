import type { Database, DbExecutor } from "../db/client";
import { measurements, patients, users } from "../db/schema";
import { PREGNANCY_DAYS } from "../domain/pregnancy";
import { assess, type RuleSet } from "../risk-engine";
import { acknowledgeAlert } from "../services/alert.service";
import { recordAudit, recordRuleSetLoaded } from "../services/audit.service";
import { readingToRow } from "../services/mappers";
import {
  buildEngineInput,
  recordAssessment,
  type PatientState,
} from "../services/risk-assessment.service";
import {
  districtOf,
  riskFactorsFor,
  SEED_PATIENTS,
  SEED_USERS,
  userId,
  visitsFor,
  type SeedPatient,
} from "./seed-data";
import { seedId } from "./seed-ids";

const DAY_MS = 86_400_000;

/** Seeded alerts older than this were already acknowledged by the specialist, a day after they came in. */
const ACKNOWLEDGED_AFTER_DAYS = 10;

export interface SeedSummary {
  users: number;
  patients: number;
  measurements: number;
  assessments: number;
  alerts: number;
}

/** 10:00 Tashkent time (05:00 UTC), `days` days before `now`. */
function visitTime(now: Date, days: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 5, 0, 0),
  );
}

/** YYYY-MM-DD for `now` shifted by `days`. */
function isoDay(now: Date, days: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

/**
 * Loads the synthetic demo data into an empty database by replaying each patient's visits through
 * the same code the API uses: store the readings, run the Risk Engine on the full history, record
 * the assessment, apply the alert policy. A final re-check assesses each patient as of `now`, so
 * stale data shows up. Old alerts are marked acknowledged by the specialist, so the inbox holds a
 * realistic mix. Deterministic ids: the same patient keeps the same id across resets.
 */
export async function seedDatabase(
  db: Database,
  ruleSet: RuleSet,
  now: Date,
): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    await tx.insert(users).values(
      SEED_USERS.map((u) => ({
        id: userId(u.key),
        displayName: u.displayName,
        role: u.role,
        district: u.district,
      })),
    );
    // The rule set "loads" before the first patient is registered, so the audit trail reads in order.
    await recordRuleSetLoaded(tx, ruleSet, new Date(now.getTime() - 121 * DAY_MS));

    const summary: SeedSummary = {
      users: SEED_USERS.length,
      patients: 0,
      measurements: 0,
      assessments: 0,
      alerts: 0,
    };
    for (const [index, patient] of SEED_PATIENTS.entries()) {
      const counts = await seedPatient(tx, ruleSet, now, patient, index);
      summary.patients += 1;
      summary.measurements += counts.measurements;
      summary.assessments += counts.assessments;
      summary.alerts += counts.alerts;
    }
    return summary;
  });
}

async function seedPatient(
  tx: DbExecutor,
  ruleSet: RuleSet,
  now: Date,
  p: SeedPatient,
  index: number,
): Promise<{ measurements: number; assessments: number; alerts: number }> {
  const district = districtOf(p);
  const patientId = seedId(`patient:${p.ref}`);
  const registeredAt = new Date(now.getTime() - 120 * DAY_MS);
  const specialist = SEED_USERS.find((u) => u.role === "SPECIALIST");
  if (!specialist) throw new Error("Seed data needs a specialist");

  await tx.insert(patients).values({
    id: patientId,
    externalReference: p.ref,
    displayName: p.displayName,
    district: district.name,
    facility: district.facility,
    assignedUserId: userId(district.doctor),
    dateOfBirth: isoDay(now, -(p.ageYears * 365 + Math.floor(p.ageYears / 4) + 40)),
    estimatedDueDate: isoDay(now, PREGNANCY_DAYS - p.week * 7 - 3),
    riskFactors: riskFactorsFor(p),
    createdAt: registeredAt,
    updatedAt: registeredAt,
  });
  await recordAudit(tx, {
    actorUserId: userId(district.doctor),
    action: "PATIENT_CREATED",
    entityType: "PATIENT",
    entityId: patientId,
    patientId,
    metadata: { source: "seed" },
    createdAt: registeredAt,
  });

  let state: PatientState = {
    id: patientId,
    externalReference: p.ref,
    currentRiskZone: null,
    currentAssessmentId: null,
  };
  const counts = { measurements: 0, assessments: 0, alerts: 0 };

  const assessAt = async (key: string, at: Date, triggerSubmissionId: string | null) => {
    const result = assess(await buildEngineInput(tx, patientId), ruleSet, at);
    const recorded = await recordAssessment(tx, {
      patient: state,
      result,
      triggerSubmissionId,
      at,
      ids: {
        assessment: seedId(`assessment:${p.ref}:${key}`),
        alert: seedId(`alert:${p.ref}:${key}`),
      },
    });
    state = { ...state, currentRiskZone: result.zone, currentAssessmentId: recorded.assessment.id };
    counts.assessments += 1;
    for (const alert of recorded.newAlerts) {
      counts.alerts += 1;
      if (now.getTime() - at.getTime() > ACKNOWLEDGED_AFTER_DAYS * DAY_MS) {
        await acknowledgeAlert(
          tx,
          alert.id,
          {
            id: userId(specialist.key),
            displayName: specialist.displayName,
            role: specialist.role,
          },
          new Date(at.getTime() + DAY_MS),
        );
      }
    }
  };

  for (const [visitIndex, visit] of visitsFor(p, index).entries()) {
    const submissionId = seedId(`submission:${p.ref}:${visitIndex}`);
    const measuredAt = visitTime(now, visit.daysAgo);
    await tx.insert(measurements).values(
      visit.readings.map((reading) => ({
        id: seedId(`measurement:${p.ref}:${visitIndex}:${reading.type}`),
        patientId,
        submissionId,
        ...readingToRow(reading),
        measuredAt,
        recordedBy: userId(district.recorder),
        source: "DEMO_SEED" as const,
        createdAt: measuredAt,
      })),
    );
    counts.measurements += visit.readings.length;
    await recordAudit(tx, {
      actorUserId: userId(district.recorder),
      action: "MEASUREMENTS_ADDED",
      entityType: "MEASUREMENT_SUBMISSION",
      entityId: submissionId,
      patientId,
      metadata: { source: "seed", types: visit.readings.map((r) => r.type) },
      createdAt: measuredAt,
    });
    await assessAt(
      `visit-${visitIndex}`,
      new Date(measuredAt.getTime() + 30 * 60_000),
      submissionId,
    );
  }

  // A patient with no visits stays "not assessed" on purpose.
  if (counts.measurements > 0) await assessAt("re-check", now, null);
  return counts;
}
