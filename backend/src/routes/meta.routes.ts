import {
  AuditListQuery,
  AuditListResponse,
  DashboardStats,
  RuleSetInfo,
  UserListResponse,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { parseInput, sendJson } from "../middleware/validate";
import { toRuleSetInfo, type RuleSet } from "../risk-engine";
import { listAudit } from "../services/audit.service";
import { getDashboardStats, listUsers } from "../services/dashboard.service";

/** Dashboard, demo users, audit trail and the active rule set. */
export function metaRouter(deps: { db: Database; ruleSet: RuleSet }): Router {
  const router = Router();
  const ruleSetInfo = toRuleSetInfo(deps.ruleSet);

  router.get("/dashboard/stats", async (_req, res) => {
    sendJson(res, DashboardStats, await getDashboardStats(deps.db));
  });

  router.get("/users", async (_req, res) => {
    sendJson(res, UserListResponse, { items: await listUsers(deps.db) });
  });

  router.get("/audit", async (req, res) => {
    const query = parseInput(AuditListQuery, req.query);
    sendJson(res, AuditListResponse, { items: await listAudit(deps.db, query) });
  });

  router.get("/ruleset", (_req, res) => {
    sendJson(res, RuleSetInfo, ruleSetInfo);
  });

  return router;
}
