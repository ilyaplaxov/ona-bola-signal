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
import { eq } from "drizzle-orm";
import { alerts } from "../db/schema";
import { getActorContext, requireActor, requireActorContext } from "../middleware/auth";
import { assertCan, assertPatientAccess, visiblePatients } from "../services/access";
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
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "VISIT_ADD");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actorContext, id);
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
    const visibility = visiblePatients(getActorContext(res));
    sendJson(res, AlertListResponse, { items: await listAlerts(deps.db, query, visibility) });
  });

  router.patch("/alerts/:id/acknowledge", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "ALERT_ACKNOWLEDGE");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    const [alert] = await deps.db
      .select({ patientId: alerts.patientId })
      .from(alerts)
      .where(eq(alerts.id, id))
      .limit(1);
    if (alert) await assertPatientAccess(deps.db, actorContext, alert.patientId);
    sendJson(res, Alert, await acknowledgeAlert(deps.db, id, actor, deps.clock()));
  });

  return router;
}
