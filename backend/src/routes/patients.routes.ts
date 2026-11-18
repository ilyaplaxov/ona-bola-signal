import {
  CreatePatientRequest,
  IdParams,
  UpdatePatientRequest,
  MeasurementListResponse,
  PatientDetail,
  PatientListQuery,
  PatientListResponse,
  RiskHistoryResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { requireActor } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import { deliverAlerts } from "../services/notification";
import { createPatient, updatePatient } from "../services/patient-registration.service";
import type { RuleSet } from "../risk-engine";
import {
  getPatient,
  getRiskHistory,
  listMeasurements,
  listPatients,
} from "../services/patient.service";

/** Registry endpoints (brief section 12): list, register, and read one patient's record. */
export function patientsRouter(deps: {
  db: Database;
  ruleSet: RuleSet;
  clock: () => Date;
}): Router {
  const router = Router();

  router.get("/patients", async (req, res) => {
    const query = parseInput(PatientListQuery, req.query);
    sendJson(res, PatientListResponse, await listPatients(deps.db, query, deps.clock()));
  });

  router.post("/patients", async (req, res) => {
    const actor = requireActor(res);
    const request = parseInput(CreatePatientRequest, req.body);
    sendJson(res, PatientDetail, await createPatient(deps.db, request, actor, deps.clock()), 201);
  });

  router.patch("/patients/:id", async (req, res) => {
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    const request = parseInput(UpdatePatientRequest, req.body);
    const outcome = await updatePatient(deps.db, deps.ruleSet, {
      patientId: id,
      request,
      actor,
      now: deps.clock(),
    });
    await deliverAlerts(outcome.newAlerts);
    sendJson(res, PatientDetail, outcome.patient);
  });

  router.get("/patients/:id", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    sendJson(res, PatientDetail, await getPatient(deps.db, id, deps.clock()));
  });

  router.get("/patients/:id/measurements", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    sendJson(res, MeasurementListResponse, await listMeasurements(deps.db, id));
  });

  router.get("/patients/:id/risk", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    sendJson(res, RiskHistoryResponse, await getRiskHistory(deps.db, id));
  });

  return router;
}
