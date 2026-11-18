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
import { getActorContext, requireActor, requireActorContext } from "../middleware/auth";
import { HttpError } from "../http-error";
import { assertCan, assertPatientAccess, visiblePatients } from "../services/access";
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

/** Staff with a district register and move patients only within it. */
function assertOwnDistrict(own: string | null, requested: string): void {
  if (own && own !== requested) {
    throw new HttpError(403, "FORBIDDEN", "You can only register patients in your district");
  }
}

/** Registry endpoints (brief section 12): list, register, and read one patient's record. */
export function patientsRouter(deps: {
  db: Database;
  ruleSet: RuleSet;
  clock: () => Date;
}): Router {
  const router = Router();

  router.get("/patients", async (req, res) => {
    const query = parseInput(PatientListQuery, req.query);
    const actor = query.assigned ? requireActorContext(res) : getActorContext(res);
    const scope = {
      visibility: visiblePatients(actor),
      assignedUserId: query.assigned === "me" ? actor?.id : undefined,
    };
    sendJson(res, PatientListResponse, await listPatients(deps.db, query, deps.clock(), scope));
  });

  router.post("/patients", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "PATIENT_CREATE");
    const actor = requireActor(res);
    const request = parseInput(CreatePatientRequest, req.body);
    assertOwnDistrict(actorContext.district, request.district);
    sendJson(res, PatientDetail, await createPatient(deps.db, request, actor, deps.clock()), 201);
  });

  router.patch("/patients/:id", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "PATIENT_EDIT");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actorContext, id);
    const request = parseInput(UpdatePatientRequest, req.body);
    if (request.district !== undefined) assertOwnDistrict(actorContext.district, request.district);
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
    await assertPatientAccess(deps.db, getActorContext(res), id);
    sendJson(res, PatientDetail, await getPatient(deps.db, id, deps.clock()));
  });

  router.get("/patients/:id/measurements", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, getActorContext(res), id);
    sendJson(res, MeasurementListResponse, await listMeasurements(deps.db, id));
  });

  router.get("/patients/:id/risk", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, getActorContext(res), id);
    sendJson(res, RiskHistoryResponse, await getRiskHistory(deps.db, id));
  });

  return router;
}
