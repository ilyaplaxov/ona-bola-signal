import {
  Alert,
  AlertListQuery,
  AlertListResponse,
  IdParams,
  SubmitMeasurementsRequest,
  SubmitMeasurementsResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { requireActor } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import type { RuleSet } from "../risk-engine";
import { acknowledgeAlert, listAlerts } from "../services/alert.service";
import { submitMeasurements } from "../services/measurement.service";
import { deliverAlerts } from "../services/notification";

/** Write side of the demo flow: measurement → assessment → alert → acknowledgement. */
export function workflowRouter(deps: {
  db: Database;
  ruleSet: RuleSet;
  clock: () => Date;
}): Router {
  const router = Router();

  router.post("/patients/:id/measurements", async (req, res) => {
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    const request = parseInput(SubmitMeasurementsRequest, req.body);
    const outcome = await submitMeasurements(deps.db, deps.ruleSet, {
      patientId: id,
      request,
      actor,
      now: deps.clock(),
    });
    await deliverAlerts(outcome.newAlerts);
    sendJson(res, SubmitMeasurementsResponse, outcome.body, outcome.status);
  });

  router.get("/alerts", async (req, res) => {
    const query = parseInput(AlertListQuery, req.query);
    sendJson(res, AlertListResponse, { items: await listAlerts(deps.db, query) });
  });

  router.patch("/alerts/:id/acknowledge", async (req, res) => {
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    sendJson(res, Alert, await acknowledgeAlert(deps.db, id, actor, deps.clock()));
  });

  return router;
}
