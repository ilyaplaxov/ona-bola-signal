import {
  HandleSignalRequest,
  IdParams,
  PatientSignal,
  RedeemSignalCodeRequest,
  RedeemSignalCodeResponse,
  SendSignalRequest,
  SendSignalResponse,
  SignalLinkResponse,
  SignalListQuery,
  SignalListResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { HttpError } from "../http-error";
import { getActorContext, requireActorContext } from "../middleware/auth";
import { rateLimiter } from "../middleware/rate-limit";
import { parseInput, sendJson } from "../middleware/validate";
import { assertCan, assertPatientAccess, visiblePatients } from "../services/access";
import {
  bindingForWebToken,
  handleSignal,
  issueLinkCode,
  listSignals,
  receiveSignal,
  redeemLinkCode,
} from "../services/signal.service";

export interface SignalRouteDeps {
  db: Database;
  clock: () => Date;
  /** The bot's @username once known (null without a bot), for t.me links. */
  botUsername: () => string | null;
}

/** Staff side: issue link codes, list signals, record what was done. */
export function signalsRouter(deps: SignalRouteDeps): Router {
  const router = Router();

  router.post("/patients/:id/signal-link", async (req, res) => {
    const actor = requireActorContext(res);
    assertCan(actor, "SIGNAL_LINK");
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actor, id);
    const link = await issueLinkCode(deps.db, {
      patientId: id,
      actor,
      now: deps.clock(),
      botUsername: deps.botUsername(),
    });
    sendJson(res, SignalLinkResponse, link, 201);
  });

  router.get("/signals", async (req, res) => {
    const query = parseInput(SignalListQuery, req.query);
    const actor = getActorContext(res);
    if (query.patientId) await assertPatientAccess(deps.db, actor, query.patientId);
    const items = await listSignals(deps.db, query, visiblePatients(actor), deps.clock());
    sendJson(res, SignalListResponse, { items });
  });

  router.patch("/signals/:id", async (req, res) => {
    const actor = requireActorContext(res);
    assertCan(actor, "SIGNAL_HANDLE");
    const { id } = parseInput(IdParams, req.params);
    const request = parseInput(HandleSignalRequest, req.body);
    const [existing] = await listSignals(deps.db, { id }, undefined, deps.clock());
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Signal not found");
    await assertPatientAccess(deps.db, actor, existing.patientId);
    await handleSignal(deps.db, { signalId: id, request, actor, now: deps.clock() });
    const [updated] = await listSignals(deps.db, { id }, undefined, deps.clock());
    if (!updated) throw new HttpError(404, "NOT_FOUND", "Signal not found");
    sendJson(res, PatientSignal, updated);
  });

  return router;
}

/** The patient's /signal page: no sign-in, a code to link, then a device token. */
export function publicSignalRouter(deps: Omit<SignalRouteDeps, "botUsername">): Router {
  const router = Router();
  const redeemLimit = rateLimiter({ limit: 10, windowMs: 10 * 60_000, clock: deps.clock });

  router.post("/public/signal/redeem", async (req, res) => {
    redeemLimit.check(req, "redeem");
    const body = parseInput(RedeemSignalCodeRequest, req.body);
    const result = await redeemLinkCode(deps.db, {
      code: body.code,
      channel: "WEB",
      language: body.language,
      now: deps.clock(),
    });
    if (!result?.webToken) throw new HttpError(404, "NOT_FOUND", "The code is wrong or expired");
    sendJson(res, RedeemSignalCodeResponse, { token: result.webToken }, 201);
  });

  router.post("/public/signal", async (req, res) => {
    const body = parseInput(SendSignalRequest, req.body);
    const binding = await bindingForWebToken(deps.db, body.token);
    if (!binding) throw new HttpError(401, "ACTOR_REQUIRED", "This device is not linked");
    const now = deps.clock();
    const result = await receiveSignal(deps.db, { binding, kind: body.kind, now });
    sendJson(res, SendSignalResponse, {
      instruction: result.instruction,
      receivedAt: now.toISOString(),
    });
  });

  return router;
}
