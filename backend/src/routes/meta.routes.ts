import {
  AuditListQuery,
  AuditListResponse,
  DashboardStats,
  RuleSetInfo,
  UserListResponse,
  can,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { getActorContext } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import { assertPatientAccess, visiblePatients } from "../services/access";
import type { ActorContext } from "../services/auth.service";
import { toRuleSetInfo, type RuleSet } from "../risk-engine";
import { listAudit, type AuditScope } from "../services/audit.service";
import { countIncoming } from "../services/referral.service";
import { getDashboardStats, listUsers } from "../services/dashboard.service";

/** What a user sees in feeds: events about patients they may see, and their own actions. */
function auditScope(actor: ActorContext | null): AuditScope | undefined {
  if (!actor) return undefined;
  const patients = visiblePatients(actor);
  return patients ? { patients, actorUserId: actor.id } : undefined;
}

/** Dashboard, demo users, audit trail and the active rule set. */
export function metaRouter(deps: { db: Database; ruleSet: RuleSet }): Router {
  const router = Router();
  const ruleSetInfo = toRuleSetInfo(deps.ruleSet);

  router.get("/dashboard/stats", async (_req, res) => {
    const actor = getActorContext(res);
    const stats = await getDashboardStats(deps.db, auditScope(actor));
    const incomingReferrals =
      actor?.role === "SPECIALIST" ? await countIncoming(deps.db, actor) : undefined;
    sendJson(res, DashboardStats, { ...stats, incomingReferrals });
  });

  router.get("/users", async (_req, res) => {
    sendJson(res, UserListResponse, { items: await listUsers(deps.db) });
  });

  router.get("/audit", async (req, res) => {
    const query = parseInput(AuditListQuery, req.query);
    const actor = getActorContext(res);
    if (query.patientId) await assertPatientAccess(deps.db, actor, query.patientId);
    const scope = actor && can(actor.role, "AUDIT_VIEW_ALL") ? undefined : auditScope(actor);
    sendJson(res, AuditListResponse, { items: await listAudit(deps.db, { ...query, scope }) });
  });

  router.get("/ruleset", (_req, res) => {
    sendJson(res, RuleSetInfo, ruleSetInfo);
  });

  return router;
}
