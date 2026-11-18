import type { HealthResponse } from "@ona-bola/shared";
import { Router } from "express";

/** GET /api/health: API liveness, database reachability and whether AI features are on. */
export function healthRouter(deps: { pingDb: () => Promise<boolean>; aiEnabled: boolean }): Router {
  const router = Router();
  router.get("/health", async (_req, res) => {
    const dbUp = await deps.pingDb();
    const body: HealthResponse = {
      status: dbUp ? "ok" : "degraded",
      db: dbUp ? "up" : "down",
      aiEnabled: deps.aiEnabled,
      time: new Date().toISOString(),
    };
    res.json(body);
  });
  return router;
}
