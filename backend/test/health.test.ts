import { ApiErrorBody, HealthResponse } from "@ona-bola/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createDatabase } from "../src/db/client";
import { DEMO_RULE_SET } from "../src/risk-engine";
import type { AiService } from "../src/services/claude.service";

// These tests never reach a database: the pool connects lazily and no route here queries it.
const { db } = createDatabase("postgres://nobody:nothing@127.0.0.1:9/none");
const appWith = (pingDb: () => Promise<boolean>) =>
  createApp({ pingDb, db, ruleSet: DEMO_RULE_SET });

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const res = await request(appWith(async () => true)).get("/api/health");
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(res.body)).toMatchObject({
      status: "ok",
      db: "up",
      aiEnabled: false,
    });
  });

  it("reports whether the AI features are on", async () => {
    const ai: AiService = {
      model: "fake",
      extractNote: () => Promise.reject(new Error("not called")),
      explainAssessment: () => Promise.reject(new Error("not called")),
      chat: () => Promise.reject(new Error("not called")),
    };
    const app = createApp({ pingDb: async () => true, db, ruleSet: DEMO_RULE_SET, ai });
    const res = await request(app).get("/api/health");
    expect(HealthResponse.parse(res.body).aiEnabled).toBe(true);
  });

  it("reports degraded when the database does not answer", async () => {
    const res = await request(appWith(async () => false)).get("/api/health");
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(res.body)).toMatchObject({ status: "degraded", db: "down" });
  });
});

describe("error responses", () => {
  const app = appWith(async () => true);

  it("uses the shared error shape for unknown API routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(ApiErrorBody.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("answers a malformed JSON body with VALIDATION_FAILED", async () => {
    const res = await request(app)
      .post("/api/does-not-exist")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(ApiErrorBody.parse(res.body).error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an acting-user header that is not a user id", async () => {
    const res = await request(app).get("/api/ruleset").set("x-demo-user-id", "not-a-uuid");
    expect(res.status).toBe(401);
    expect(ApiErrorBody.parse(res.body).error.code).toBe("ACTOR_REQUIRED");
  });
});
