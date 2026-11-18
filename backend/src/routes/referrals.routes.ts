import {
  CreateReferralRequest,
  IdParams,
  Referral,
  ReferralActionRequest,
  ReferralListQuery,
  ReferralListResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database, DbExecutor } from "../db/client";
import { getActorContext, requireActorContext } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import { assertCan, assertPatientAccess } from "../services/access";
import { actOnReferral, createReferral, listReferrals } from "../services/referral.service";

/** Referrals to consultants: write one, list inbox / outbox, move it through its statuses. */
export function referralsRouter(deps: {
  db: Database;
  clock: () => Date;
  checkAttachments?: (tx: DbExecutor, patientId: string, ids: string[]) => Promise<void>;
}): Router {
  const router = Router();

  router.post("/patients/:id/referrals", async (req, res) => {
    const actor = requireActorContext(res);
    assertCan(actor, "REFERRAL_CREATE");
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actor, id);
    const request = parseInput(CreateReferralRequest, req.body);
    const referral = await createReferral(deps.db, {
      patientId: id,
      request,
      actor,
      now: deps.clock(),
    });
    sendJson(res, Referral, referral, 201);
  });

  router.get("/referrals", async (req, res) => {
    const query = parseInput(ReferralListQuery, req.query);
    const actor = getActorContext(res);
    if (query.patientId) await assertPatientAccess(deps.db, actor, query.patientId);
    sendJson(res, ReferralListResponse, { items: await listReferrals(deps.db, query, actor) });
  });

  router.patch("/referrals/:id", async (req, res) => {
    const actor = requireActorContext(res);
    const { id } = parseInput(IdParams, req.params);
    const request = parseInput(ReferralActionRequest, req.body);
    if (request.action === "ACCEPT" || request.action === "CONCLUDE") {
      assertCan(actor, "REFERRAL_RESPOND");
    }
    const referral = await actOnReferral(deps.db, {
      referralId: id,
      request,
      actor,
      now: deps.clock(),
      checkAttachments: deps.checkAttachments,
    });
    sendJson(res, Referral, referral);
  });

  return router;
}
