import {
  CreatePatientRequest,
  IdParams,
  MeasurementListResponse,
  PatientDetail,
  PatientListQuery,
  PatientListResponse,
  RiskHistoryResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { requireActor } from "../middleware/demo-actor";
import { parseInput, sendJson } from "../middleware/validate";
import { createPatient } from "../services/patient-registration.service";
import {
  getPatient,
  getRiskHistory,
  listMeasurements,
  listPatients,
} from "../services/patient.service";

/** Registry endpoints (brief section 12): list, register, and read one patient's record. */
export function patientsRouter(deps: { db: Database; clock: () => Date }): Router {
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
