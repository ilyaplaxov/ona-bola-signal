import {
  Alert,
  AlertListResponse,
  AiChatResponse,
  AnalyzeNoteResponse,
  ApiErrorBody,
  AuditListResponse,
  DashboardStats,
  ExplainRiskResponse,
  MeasurementListResponse,
  PatientDetail,
  PatientListResponse,
  RiskHistoryResponse,
  RuleSetInfo,
  SubmitMeasurementsResponse,
  UserListResponse,
  DemoAccountsResponse,
  SessionResponse,
  SESSION_COOKIE,
  Referral,
  ReferralListResponse,
  Attachment,
  AttachmentListResponse,
  type NoteExtractionOutput,
} from "@ona-bola/shared";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { DEFAULT_DATABASE_URL } from "../src/config";
import { createDatabase, pingDatabase } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import { resetDatabase } from "../src/db/reset";
import { DEMO_RULE_SET } from "../src/risk-engine";
import {
  AiUnavailableError,
  type AiService,
  type ChatContext,
  type ExplanationFacts,
} from "../src/services/claude.service";
import {
  DEMO_PASSWORD,
  DEMO_PATIENT_REF,
  SEED_PATIENTS,
  SEED_USERS,
  userId,
} from "../src/scripts/seed-data";
import { seedId } from "../src/scripts/seed-ids";
import { seedDatabase } from "../src/scripts/seed";

// Runs against the separate test database (never the demo one). Skipped when it is not reachable,
// for example when Docker is not running. Keep every database test in this one file: the suite
// wipes and reseeds the test database before it starts.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_DATABASE_URL.replace(/\/ona_bola$/, "/ona_bola_test");
const NOW = new Date("2026-11-18T06:00:00Z");

const { pool, db } = createDatabase(TEST_DATABASE_URL);
const reachable = await pingDatabase(pool);
if (!reachable) await pool.end();

describe.skipIf(!reachable)("API on the seeded test database", () => {
  const uploadsDir = mkdtempSync(path.join(tmpdir(), "ona-uploads-"));
  const app = createApp({
    pingDb: () => pingDatabase(pool),
    db,
    ruleSet: DEMO_RULE_SET,
    clock: () => NOW,
    uploadsDir,
  });
  const demoId = seedId(`patient:${DEMO_PATIENT_REF}`);

  beforeAll(async () => {
    await runMigrations(db);
    await resetDatabase(db);
    await seedDatabase(db, DEMO_RULE_SET, NOW);
  });

  afterAll(async () => {
    await pool.end();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  describe("GET /api/patients", () => {
    it("lists every patient, red first", async () => {
      const res = await request(app).get("/api/patients?pageSize=100");
      expect(res.status).toBe(200);
      const body = PatientListResponse.parse(res.body);
      expect(body.total).toBe(SEED_PATIENTS.length);
      const zones = body.items.map((p) => p.currentRiskZone);
      expect(zones.slice(0, 3)).toEqual(["RED", "RED", "RED"]);
      expect(zones.indexOf("GREEN")).toBeGreaterThan(zones.lastIndexOf("YELLOW"));
    });

    it("filters by zone, including patients that were never assessed", async () => {
      const red = PatientListResponse.parse(
        (await request(app).get("/api/patients?zone=RED")).body,
      );
      expect(red.total).toBe(3);
      expect(red.items.every((p) => p.currentRiskZone === "RED")).toBe(true);

      const none = PatientListResponse.parse(
        (await request(app).get("/api/patients?zone=NOT_ASSESSED")).body,
      );
      expect(none.items.map((p) => p.externalReference)).toEqual(["OB-0016"]);
      expect(none.items[0]?.lastMeasurementAt).toBeNull();
    });

    it("searches by reference or name and filters by district", async () => {
      const found = PatientListResponse.parse(
        (await request(app).get("/api/patients?q=demo")).body,
      );
      expect(found.items.map((p) => p.externalReference)).toEqual([DEMO_PATIENT_REF]);

      const district = PatientListResponse.parse(
        (await request(app).get("/api/patients?district=Yunusobod&pageSize=100")).body,
      );
      expect(district.total).toBe(8);
      expect(district.items.every((p) => p.district === "Yunusobod")).toBe(true);
    });

    it("pages results and rejects an unknown zone", async () => {
      const page = PatientListResponse.parse(
        (await request(app).get("/api/patients?page=2&pageSize=10")).body,
      );
      expect(page.items).toHaveLength(10);
      expect(page.page).toBe(2);
      const bad = await request(app).get("/api/patients?zone=PURPLE");
      expect(bad.status).toBe(400);
      expect(ApiErrorBody.parse(bad.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("flags patients whose latest assessment has data warnings", async () => {
      const body = PatientListResponse.parse(
        (await request(app).get("/api/patients?q=OB-0014")).body,
      );
      expect(body.items[0]).toMatchObject({ currentRiskZone: "GREEN", hasDataWarnings: true });
    });
  });

  describe("GET /api/patients/:id and its history", () => {
    it("returns the demo patient with her current assessment and derived values", async () => {
      const res = await request(app).get(`/api/patients/${demoId}`);
      expect(res.status).toBe(200);
      const patient = PatientDetail.parse(res.body);
      expect(patient).toMatchObject({
        externalReference: DEMO_PATIENT_REF,
        currentRiskZone: "GREEN",
        gestationalWeek: 32,
        ageYears: 29,
        hasDataWarnings: false,
      });
      const trend = patient.currentAssessment?.trendFindings.find(
        (f) => f.ruleId === "DEMO-TREND-SYSTOLIC",
      );
      expect(trend?.status).toBe("TRIGGERED");
    });

    it("returns measurements oldest first", async () => {
      const body = MeasurementListResponse.parse(
        (await request(app).get(`/api/patients/${demoId}/measurements`)).body,
      );
      const times = body.items.map((m) => m.measuredAt);
      expect(times).toEqual([...times].sort());
      expect(body.items.some((m) => m.reading.type === "BLOOD_PRESSURE")).toBe(true);
    });

    it("returns the risk history newest first, ending in the current assessment", async () => {
      const [risk, detail] = await Promise.all([
        request(app).get(`/api/patients/${demoId}/risk`),
        request(app).get(`/api/patients/${demoId}`),
      ]);
      const history = RiskHistoryResponse.parse(risk.body);
      expect(history.history).toHaveLength(4);
      expect(history.latest?.id).toBe(PatientDetail.parse(detail.body).currentAssessment?.id);
    });

    it("explains a red patient with rule ids and observed values", async () => {
      const id = seedId("patient:OB-0010");
      const patient = PatientDetail.parse((await request(app).get(`/api/patients/${id}`)).body);
      expect(patient.currentRiskZone).toBe("RED");
      const ids = patient.currentAssessment?.reasons.map((r) => r.ruleId);
      expect(ids).toContain("DEMO-PE-PATTERN");
      expect(patient.currentAssessment?.ruleSetKind).toBe("ILLUSTRATIVE");
    });

    it("reads the same haemoglobin of 107 g/L by the trimester it was taken in", async () => {
      const detail = async (ref: string) =>
        PatientDetail.parse(
          (await request(app).get(`/api/patients/${seedId(`patient:${ref}`)}`)).body,
        );
      const second = await detail("OB-0001");
      expect(second.currentRiskZone).toBe("GREEN");
      const third = await detail("OB-0002");
      expect(third.currentRiskZone).toBe("YELLOW");
      const reason = third.currentAssessment?.reasons.find((r) => r.ruleId === "DEMO-HB-LOW-T3");
      expect(reason?.observed.map((o) => [o.measure, o.value])).toEqual([
        ["HEMOGLOBIN", 107],
        ["PATIENT.gestationalWeek", 28],
      ]);
    });

    it("adds risk-group badges from the anamnesis, and none without one", async () => {
      const detail = async (ref: string) =>
        PatientDetail.parse(
          (await request(app).get(`/api/patients/${seedId(`patient:${ref}`)}`)).body,
        );
      const demo = await detail(DEMO_PATIENT_REF);
      const raised = demo.riskGroups?.filter((g) => g.level !== "LOW");
      expect(raised?.map((g) => [g.scale, g.level])).toEqual([["PREECLAMPSIA", "HIGH"]]);
      expect(raised?.[0]?.matched).toEqual(["NULLIPARITY", "FAMILY_HISTORY_PREECLAMPSIA"]);
      const scar = await detail("OB-0005");
      expect(scar.riskGroups?.find((g) => g.scale === "PPH")?.matched).toEqual(["UTERINE_SCAR"]);
      expect((await detail("OB-0014")).riskGroups).toBeNull();
    });

    it("answers 404 for an unknown patient and 400 for a malformed id", async () => {
      const missing = await request(app).get(`/api/patients/${seedId("nobody")}`);
      expect(missing.status).toBe(404);
      expect(ApiErrorBody.parse(missing.body).error.code).toBe("NOT_FOUND");
      const malformed = await request(app).get("/api/patients/not-a-uuid/measurements");
      expect(malformed.status).toBe(400);
    });
  });

  describe("dashboard, users, audit, rule set and acting user", () => {
    it("counts patients by zone", async () => {
      const stats = DashboardStats.parse((await request(app).get("/api/dashboard/stats")).body);
      expect(stats.zoneCounts).toEqual({ RED: 3, YELLOW: 9, GREEN: 11, NOT_ASSESSED: 1 });
      expect(stats.pendingAlerts).toEqual({ total: 7, RED: 3, YELLOW: 4 });
      expect(stats.recentActivity.length).toBeGreaterThan(0);
    });

    it("lists the demo users, including a specialist", async () => {
      const body = UserListResponse.parse((await request(app).get("/api/users")).body);
      expect(body.items).toHaveLength(SEED_USERS.length);
      expect(body.items.some((u) => u.role === "SPECIALIST")).toBe(true);
    });

    it("returns a patient's audit trail newest first", async () => {
      const body = AuditListResponse.parse(
        (await request(app).get(`/api/audit?patientId=${demoId}&limit=200`)).body,
      );
      const actions = body.items.map((e) => e.action);
      expect(actions[0]).toBe("RISK_ASSESSED");
      expect(actions.at(-1)).toBe("PATIENT_CREATED");
      expect(actions.filter((a) => a === "MEASUREMENTS_ADDED")).toHaveLength(3);
    });

    it("serves the active rule set", async () => {
      const body = RuleSetInfo.parse((await request(app).get("/api/ruleset")).body);
      expect(body).toMatchObject({ version: "demo-0.2", kind: "ILLUSTRATIVE" });
      expect(body.rules).toHaveLength(DEMO_RULE_SET.rules.length);
      expect(body.rules.find((r) => r.id === "DEMO-HB-LOW-T3")).toMatchObject({
        gestationalWeeks: { from: 28 },
        source: { citations: [{ document: "UZ_ANTENATAL_CARE_2025", pages: ["28"] }, {}] },
      });
    });

    it("accepts a known demo user and rejects an unknown one", async () => {
      const known = await request(app)
        .get("/api/users")
        .set("x-demo-user-id", userId("specialist"));
      expect(known.status).toBe(200);
      const unknown = await request(app).get("/api/users").set("x-demo-user-id", seedId("ghost"));
      expect(unknown.status).toBe(401);
      expect(ApiErrorBody.parse(unknown.body).error.code).toBe("ACTOR_REQUIRED");
    });
  });

  // These tests change the data, so they run last (Vitest runs a file's tests in order).
  describe("measurement → assessment → alert → acknowledgement", () => {
    const nurse = userId("nurse-chilonzor");
    const doctor = userId("doctor-chilonzor");
    const specialist = userId("specialist");
    const visit = {
      submissionId: "5f0c2a4e-8b1d-4c6a-9e2f-000000000001",
      measuredAt: "2026-11-18T05:30:00Z",
      measurements: [
        { type: "BLOOD_PRESSURE", systolic: 148, diastolic: 96, unit: "mmHg" },
        { type: "PROTEINURIA", value: 0.6, unit: "g/L" },
      ],
    };
    const submit = (body: object, actor?: string) => {
      const req = request(app).post(`/api/patients/${demoId}/measurements`);
      return (actor ? req.set("x-demo-user-id", actor) : req).send(body);
    };
    const countMeasurements = async () =>
      MeasurementListResponse.parse(
        (await request(app).get(`/api/patients/${demoId}/measurements`)).body,
      ).items.length;
    let alertId = "";

    it("starts from the seeded inbox: pending first, red before yellow", async () => {
      const body = AlertListResponse.parse((await request(app).get("/api/alerts")).body);
      expect(body.items).toHaveLength(10);
      expect(body.items.slice(0, 3).map((a) => `${a.status}:${a.severity}`)).toEqual([
        "PENDING:RED",
        "PENDING:RED",
        "PENDING:RED",
      ]);
      const acknowledged = body.items.filter((a) => a.status === "ACKNOWLEDGED");
      expect(acknowledged).toHaveLength(3);
      expect(acknowledged.every((a) => a.acknowledgedBy?.role === "SPECIALIST")).toBe(true);
    });

    it("refuses a visit without an acting user", async () => {
      const res = await submit(visit);
      expect(res.status).toBe(401);
      expect(ApiErrorBody.parse(res.body).error.code).toBe("ACTOR_REQUIRED");
    });

    it("rejects a measurement time in the future", async () => {
      const res = await submit({ ...visit, measuredAt: "2026-11-19T05:30:00Z" }, nurse);
      expect(res.status).toBe(400);
      expect(ApiErrorBody.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("turns the demo patient red and raises one red alert for the specialist", async () => {
      const res = await submit(visit, nurse);
      expect(res.status).toBe(201);
      const body = SubmitMeasurementsResponse.parse(res.body);
      expect(body).toMatchObject({ previousZone: "GREEN", replayed: false });
      expect(body.assessment.zone).toBe("RED");
      expect(body.assessment.triggeredRuleIds).toEqual([
        "DEMO-BP-HIGH",
        "DEMO-PE-PATTERN",
        "DEMO-PROTEINURIA",
      ]);
      expect(body.measurements.map((m) => m.recordedBy.id)).toEqual([nurse, nurse]);
      expect(body.newAlertIds).toHaveLength(1);
      alertId = body.newAlertIds[0] ?? "";

      const alerts = AlertListResponse.parse(
        (await request(app).get(`/api/alerts?patientId=${demoId}`)).body,
      );
      expect(alerts.items[0]).toMatchObject({
        id: alertId,
        severity: "RED",
        status: "PENDING",
        patientReference: DEMO_PATIENT_REF,
        recipientRole: "SPECIALIST",
        triggeredRuleIds: ["DEMO-PE-PATTERN"],
      });
      expect(alerts.items[0]?.message).not.toContain("Malika");

      const patient = PatientDetail.parse((await request(app).get(`/api/patients/${demoId}`)).body);
      expect(patient).toMatchObject({ currentRiskZone: "RED", openAlertCount: 1 });
    });

    it("returns the first result when the same visit is sent again", async () => {
      const before = await countMeasurements();
      const res = await submit(visit, nurse);
      expect(res.status).toBe(200);
      const body = SubmitMeasurementsResponse.parse(res.body);
      expect(body).toMatchObject({ replayed: true, previousZone: "GREEN", newAlertIds: [alertId] });
      expect(await countMeasurements()).toBe(before);
    });

    it("refuses the same submission id for another patient", async () => {
      const res = await request(app)
        .post(`/api/patients/${seedId("patient:OB-0001")}/measurements`)
        .set("x-demo-user-id", nurse)
        .send(visit);
      expect(res.status).toBe(409);
    });

    it("stays quiet while the patient stays red for the same reason", async () => {
      const res = await submit(
        {
          submissionId: "5f0c2a4e-8b1d-4c6a-9e2f-000000000002",
          measuredAt: "2026-11-18T05:45:00Z",
          measurements: [{ type: "BLOOD_PRESSURE", systolic: 150, diastolic: 97, unit: "mmHg" }],
        },
        nurse,
      );
      expect(res.status).toBe(201);
      const body = SubmitMeasurementsResponse.parse(res.body);
      expect(body).toMatchObject({ previousZone: "RED", newAlertIds: [] });
      expect(body.assessment.zone).toBe("RED");
    });

    it("lets only the specialist acknowledge, and only once", async () => {
      const path = `/api/alerts/${alertId}/acknowledge`;
      const asDoctor = await request(app).patch(path).set("x-demo-user-id", doctor);
      expect(asDoctor.status).toBe(403);
      expect(ApiErrorBody.parse(asDoctor.body).error.code).toBe("FORBIDDEN");

      const asSpecialist = await request(app).patch(path).set("x-demo-user-id", specialist);
      expect(asSpecialist.status).toBe(200);
      expect(Alert.parse(asSpecialist.body)).toMatchObject({
        status: "ACKNOWLEDGED",
        acknowledgedBy: { id: specialist, role: "SPECIALIST" },
      });

      const again = await request(app).patch(path).set("x-demo-user-id", specialist);
      expect(again.status).toBe(409);
      expect(ApiErrorBody.parse(again.body).error.code).toBe("CONFLICT");
    });

    it("records the whole chain in the audit trail, in order", async () => {
      const body = AuditListResponse.parse(
        (await request(app).get(`/api/audit?patientId=${demoId}&limit=6`)).body,
      );
      expect(body.items.map((e) => `${e.action}:${e.actor?.role ?? "SYSTEM"}`)).toEqual([
        "ALERT_ACKNOWLEDGED:SPECIALIST",
        "RISK_ASSESSED:SYSTEM",
        "MEASUREMENTS_ADDED:NURSE",
        "ALERT_CREATED:SYSTEM",
        "RISK_ASSESSED:SYSTEM",
        "MEASUREMENTS_ADDED:NURSE",
      ]);
    });
  });

  describe("Claude endpoints with a fake model (no network, no key)", () => {
    const nurse = userId("nurse-chilonzor");
    const note = "Synthetic: 18.11 09:30, AD 150/95 мм рт. ст., Hb 10.4 g/dL, oqsil 0.4 g/l";
    const extraction: NoteExtractionOutput = {
      measuredAt: "2026-11-18T09:30",
      bloodPressure: { systolic: 150, diastolic: 95, unitAsWritten: "мм рт. ст." },
      hemoglobin: { value: 10.4, unitAsWritten: "g/dL" },
      proteinuria: { value: 0.4, unitAsWritten: "g/l" },
      glucose: null,
      missingOrUnclear: [],
    };
    const factsSeen: ExplanationFacts[] = [];
    const chatsSeen: { context: ChatContext; messages: unknown[] }[] = [];
    let failNext: AiUnavailableError | null = null;
    const fakeAi: AiService = {
      model: "fake-claude",
      async extractNote() {
        if (failNext) {
          const error = failNext;
          failNext = null;
          throw error;
        }
        return { output: extraction, model: "fake-claude" };
      },
      async explainAssessment({ facts }) {
        factsSeen.push(facts);
        return { output: { summary: " Summary. ", keyPoints: ["One", " "] }, model: "fake-claude" };
      },
      async chat({ context, messages }) {
        chatsSeen.push({ context, messages });
        return { output: { answer: " Javob. " }, model: "fake-claude" };
      },
    };
    const aiApp = createApp({
      pingDb: () => pingDatabase(pool),
      db,
      ruleSet: DEMO_RULE_SET,
      clock: () => NOW,
      ai: fakeAi,
    });
    const analyze = (target: typeof app, actor: string | null, patientId = demoId) => {
      const req = request(target).post(`/api/patients/${patientId}/analyze-note`);
      return (actor ? req.set("x-demo-user-id", actor) : req).send({ note, language: "en" });
    };

    it("turns a note into a converted draft and audits it without the note text", async () => {
      const res = await analyze(aiApp, nurse);
      expect(res.status).toBe(200);
      const body = AnalyzeNoteResponse.parse(res.body);
      expect(body.draft).toEqual({
        measuredAt: "2026-11-18T09:30:00+05:00",
        measurements: [
          { type: "BLOOD_PRESSURE", systolic: 150, diastolic: 95, unit: "mmHg" },
          { type: "HEMOGLOBIN", value: 104, unit: "g/L" },
          { type: "PROTEINURIA", value: 0.4, unit: "g/L" },
        ],
      });
      expect(body.warnings).toHaveLength(1);
      expect(body.model).toBe("fake-claude");

      const audit = AuditListResponse.parse(
        (await request(aiApp).get(`/api/audit?patientId=${demoId}&limit=1`)).body,
      );
      expect(audit.items[0]).toMatchObject({
        action: "AI_NOTE_ANALYZED",
        actor: { id: nurse },
        metadata: { model: "fake-claude", noteLength: note.length, warningCount: 1 },
      });
      expect(JSON.stringify(audit.items)).not.toContain("150/95");
    });

    it("saves nothing: the draft only fills the form", async () => {
      const before = MeasurementListResponse.parse(
        (await request(aiApp).get(`/api/patients/${demoId}/measurements`)).body,
      );
      await analyze(aiApp, nurse);
      const after = MeasurementListResponse.parse(
        (await request(aiApp).get(`/api/patients/${demoId}/measurements`)).body,
      );
      expect(after.items).toHaveLength(before.items.length);
    });

    it("answers AI_UNAVAILABLE when AI is off or the call fails", async () => {
      const off = await analyze(app, nurse);
      expect(off.status).toBe(503);
      expect(ApiErrorBody.parse(off.body).error.code).toBe("AI_UNAVAILABLE");

      failNext = new AiUnavailableError("timeout", "no answer in 15 s");
      const failed = await analyze(aiApp, nurse);
      expect(failed.status).toBe(503);
      expect(ApiErrorBody.parse(failed.body).error).toMatchObject({
        code: "AI_UNAVAILABLE",
        details: { reason: "timeout" },
      });
    });

    it("needs an acting user and a known patient", async () => {
      expect((await analyze(aiApp, null)).status).toBe(401);
      expect((await analyze(aiApp, nurse, seedId("no-such-patient"))).status).toBe(404);
    });

    it("explains the current assessment from de-identified facts, once per language", async () => {
      const path = `/api/patients/${demoId}/risk/explain`;
      const first = await request(aiApp).post(path).set("x-demo-user-id", nurse).send({});
      expect(first.status).toBe(200);
      const body = ExplainRiskResponse.parse(first.body);
      expect(body).toMatchObject({ summary: "Summary.", keyPoints: ["One"], model: "fake-claude" });

      const patient = PatientDetail.parse(
        (await request(aiApp).get(`/api/patients/${demoId}`)).body,
      );
      expect(body.assessmentId).toBe(patient.currentAssessment?.id);
      const sent = JSON.stringify(factsSeen[0]);
      expect(factsSeen[0]?.zone).toBe(patient.currentRiskZone);
      for (const personal of [patient.displayName, patient.externalReference, patient.district]) {
        expect(sent).not.toContain(personal);
      }

      const again = await request(aiApp).post(path).set("x-demo-user-id", nurse).send({});
      expect(ExplainRiskResponse.parse(again.body)).toEqual(body);
      expect(factsSeen).toHaveLength(1);
    });

    it("answers a chat question from a de-identified record and audits no text", async () => {
      const question = "Nega zona sariq? Malika haqida";
      const res = await request(aiApp)
        .post(`/api/patients/${demoId}/ai/chat`)
        .set("x-demo-user-id", nurse)
        .send({
          language: "uz",
          messages: [
            { role: "user", content: "Salom" },
            { role: "assistant", content: "Salom, savolingiz?" },
            { role: "user", content: question },
          ],
        });
      expect(res.status).toBe(200);
      expect(AiChatResponse.parse(res.body)).toMatchObject({
        answer: "Javob.",
        model: "fake-claude",
      });

      const seen = chatsSeen.at(-1)!;
      expect(seen.messages).toHaveLength(3);
      expect(seen.context.measurements.length).toBeGreaterThan(0);
      const patient = PatientDetail.parse(
        (await request(aiApp).get(`/api/patients/${demoId}`)).body,
      );
      const sent = JSON.stringify(seen.context);
      for (const personal of [
        patient.displayName,
        patient.externalReference,
        patient.district,
        patient.facility,
        patient.dateOfBirth ?? "no-dob",
      ]) {
        expect(sent).not.toContain(personal);
      }

      const audit = AuditListResponse.parse(
        (await request(aiApp).get(`/api/audit?patientId=${demoId}&limit=1`)).body,
      );
      expect(audit.items[0]).toMatchObject({
        action: "AI_CHAT_ANSWERED",
        metadata: { turns: 2, questionLength: question.length },
      });
      expect(JSON.stringify(audit.items)).not.toContain("Nega zona");
    });

    it("rejects a chat that does not end with the clinician's question", async () => {
      const res = await request(aiApp)
        .post(`/api/patients/${demoId}/ai/chat`)
        .set("x-demo-user-id", nurse)
        .send({ messages: [{ role: "assistant", content: "Hi" }] });
      expect(res.status).toBe(400);
      const off = await request(app)
        .post(`/api/patients/${demoId}/ai/chat`)
        .set("x-demo-user-id", nurse)
        .send({ messages: [{ role: "user", content: "Hi" }] });
      expect(off.status).toBe(503);
    });

    it("refuses to explain a patient who was never assessed", async () => {
      const never = PatientListResponse.parse(
        (await request(aiApp).get("/api/patients?zone=NOT_ASSESSED")).body,
      ).items[0]!;
      const res = await request(aiApp)
        .post(`/api/patients/${never.id}/risk/explain`)
        .set("x-demo-user-id", userId("specialist"))
        .send({ language: "uz" });
      expect(res.status).toBe(409);
      expect(ApiErrorBody.parse(res.body).error.code).toBe("CONFLICT");
    });
  });

  // Last on purpose: it adds a patient, which would change the counts the earlier tests check.
  describe("POST /api/patients (registration)", () => {
    const doctor = userId("doctor-chilonzor");
    const valid = {
      externalReference: "OB-TEST-01",
      displayName: "Test Bemor",
      dateOfBirth: "1998-05-04",
      district: "Chilonzor",
      facility: "Oilaviy poliklinika 12",
      estimatedDueDate: "2027-03-01",
      riskFactors: { previousCesarean: true },
      assignedUserId: userId("doctor-chilonzor"),
    };
    const register = (body: unknown, actor: string | null = doctor) => {
      const req = request(app).post("/api/patients");
      return (actor ? req.set("x-demo-user-id", actor) : req).send(body as object);
    };

    it("registers a patient who starts unassessed, and audits it without the name", async () => {
      const res = await register(valid);
      expect(res.status).toBe(201);
      const patient = PatientDetail.parse(res.body);
      expect(patient).toMatchObject({
        externalReference: "OB-TEST-01",
        currentRiskZone: null,
        currentAssessment: null,
        riskFactors: { previousCesarean: true },
        assignedUser: { id: userId("doctor-chilonzor") },
        gestationalWeek: expect.any(Number),
      });

      const audit = AuditListResponse.parse(
        (await request(app).get(`/api/audit?patientId=${patient.id}`)).body,
      );
      expect(audit.items.map((e) => `${e.action}:${e.actor?.id}`)).toEqual([
        `PATIENT_CREATED:${doctor}`,
      ]);
      expect(JSON.stringify(audit.items)).not.toContain(valid.displayName);
    });

    it("rejects a second patient with the same reference", async () => {
      const res = await register({ ...valid, displayName: "Boshqa" });
      expect(res.status).toBe(409);
      expect(ApiErrorBody.parse(res.body).error.code).toBe("CONFLICT");
    });

    it("needs an acting user and valid fields", async () => {
      expect((await register({ ...valid, externalReference: "OB-TEST-02" }, null)).status).toBe(
        401,
      );
      const cases = [
        { ...valid, externalReference: "OB-TEST-03", district: "" },
        { ...valid, externalReference: "OB-TEST-04", dateOfBirth: "2027-01-01" },
        { ...valid, externalReference: "OB-TEST-05", assignedUserId: seedId("nobody") },
        { ...valid, externalReference: "OB-TEST-06", riskFactors: { smoker: true } },
      ];
      for (const body of cases) {
        const res = await register(body);
        expect(res.status).toBe(400);
        expect(ApiErrorBody.parse(res.body).error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("pregnancy dating and PATCH /api/patients/:id", () => {
    const doctor = userId("doctor-chilonzor");
    const base = {
      displayName: "Sana Bemor",
      district: "Chilonzor",
      facility: "Oilaviy poliklinika 12",
    };
    const register = (body: object) =>
      request(app).post("/api/patients").set("x-demo-user-id", doctor).send(body);
    const update = (id: string, body: object, actor: string | null = doctor) => {
      const req = request(app).patch(`/api/patients/${id}`);
      return (actor ? req.set("x-demo-user-id", actor) : req).send(body);
    };

    it("dates a pregnancy from the last menstrual period and derives the due date", async () => {
      // NOW is 2026-11-18; LMP 2026-08-12 is 98 days earlier: 14 weeks 0 days.
      const res = await register({
        ...base,
        externalReference: "OB-DATE-LMP",
        dating: { method: "LMP", lmpDate: "2026-08-12" },
      });
      expect(res.status).toBe(201);
      expect(PatientDetail.parse(res.body)).toMatchObject({
        pregnancyStartDate: "2026-08-12",
        datingMethod: "LMP",
        estimatedDueDate: "2027-05-19",
        gestationalAgeDays: 98,
        gestationalWeek: 14,
      });
    });

    it("dates a pregnancy from an ultrasound scan", async () => {
      // Scan on 2026-11-01 at 10 weeks 3 days: start 73 days earlier, 2026-08-20.
      const res = await register({
        ...base,
        externalReference: "OB-DATE-UTT",
        dating: { method: "ULTRASOUND", scanDate: "2026-11-01", weeks: 10, days: 3 },
      });
      expect(res.status).toBe(201);
      expect(PatientDetail.parse(res.body)).toMatchObject({
        pregnancyStartDate: "2026-08-20",
        datingMethod: "ULTRASOUND",
        estimatedDueDate: "2027-05-27",
        gestationalAgeDays: 90,
      });
    });

    it("rejects future dates, impossible lengths and dating given twice", async () => {
      const cases = [
        { externalReference: "OB-DATE-X1", dating: { method: "LMP", lmpDate: "2026-12-01" } },
        { externalReference: "OB-DATE-X2", dating: { method: "LMP", lmpDate: "2025-08-01" } },
        {
          externalReference: "OB-DATE-X3",
          dating: { method: "LMP", lmpDate: "2026-08-12" },
          estimatedDueDate: "2027-05-19",
        },
        {
          externalReference: "OB-DATE-X4",
          dating: { method: "ULTRASOUND", scanDate: "2026-11-01", weeks: 10, days: 7 },
        },
      ];
      for (const body of cases) {
        const res = await register({ ...base, ...body });
        expect(res.status).toBe(400);
        expect(ApiErrorBody.parse(res.body).error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("edits a patient and audits only the names of the changed fields", async () => {
      const created = PatientDetail.parse(
        (await register({ ...base, externalReference: "OB-EDIT-01" })).body,
      );
      const res = await update(created.id, {
        displayName: "Yangi Ism",
        dating: { method: "LMP", lmpDate: "2026-06-03" },
      });
      expect(res.status).toBe(200);
      expect(PatientDetail.parse(res.body)).toMatchObject({
        displayName: "Yangi Ism",
        gestationalWeek: 24,
        currentRiskZone: null,
      });
      const audit = AuditListResponse.parse(
        (await request(app).get(`/api/audit?patientId=${created.id}&limit=1`)).body,
      );
      expect(audit.items[0]).toMatchObject({
        action: "PATIENT_UPDATED",
        actor: { id: doctor },
        metadata: { fields: ["displayName", "dating"] },
      });
      expect(JSON.stringify(audit.items)).not.toContain("Yangi Ism");
    });

    it("re-assesses an assessed patient when a risk factor changes", async () => {
      const ob1 = seedId("patient:OB-0001");
      const before = PatientDetail.parse((await request(app).get(`/api/patients/${ob1}`)).body);
      expect(before.currentRiskZone).toBe("GREEN");
      const res = await update(ob1, {
        riskFactors: { ...before.riskFactors, previousCesarean: true },
      });
      expect(res.status).toBe(200);
      const after = PatientDetail.parse(res.body);
      expect(after.currentRiskZone).toBe("YELLOW");
      expect(after.currentAssessment?.triggeredRuleIds).toContain("DEMO-RF-CESAREAN");
    });

    it("needs an acting user, a known patient and something to change", async () => {
      const ob1 = seedId("patient:OB-0001");
      expect((await update(ob1, { displayName: "X" }, null)).status).toBe(401);
      expect((await update(seedId("nobody"), { displayName: "X" })).status).toBe(404);
      expect((await update(ob1, {})).status).toBe(400);
    });
  });

  describe("sign-in (session cookie)", () => {
    const login = (username: string, password: string) =>
      request(app).post("/api/auth/login").send({ username, password });
    const sessionCookie = (res: request.Response): string => {
      const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
      const cookie = raw?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
      if (!cookie) throw new Error("no session cookie");
      return cookie;
    };

    it("lists the demo accounts with the shared password", async () => {
      const body = DemoAccountsResponse.parse(
        (await request(app).get("/api/auth/demo-accounts")).body,
      );
      expect(body.enabled).toBe(true);
      expect(body.password).toBe(DEMO_PASSWORD);
      expect(body.items).toHaveLength(SEED_USERS.length);
      expect(body.items.find((u) => u.username === "yusupova")?.specialty).toBe("ENDOCRINOLOGIST");
    });

    it("rejects a wrong password with INVALID_CREDENTIALS and audits it without the username", async () => {
      const res = await login("karimova", "wrong-password");
      expect(res.status).toBe(401);
      expect(ApiErrorBody.parse(res.body).error.code).toBe("INVALID_CREDENTIALS");
      expect(res.headers["set-cookie"]).toBeUndefined();
      expect((await login("nobody-here", DEMO_PASSWORD)).status).toBe(401);

      const audit = AuditListResponse.parse(
        (await request(app).get("/api/audit?entityType=USER&limit=10")).body,
      );
      const failed = audit.items.filter((e) => e.action === "USER_LOGIN_FAILED");
      expect(failed.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(failed)).not.toContain("nobody-here");
    });

    it("signs in with an httpOnly cookie, acts with it and signs out", async () => {
      const res = await login(" Karimova ", DEMO_PASSWORD);
      expect(res.status).toBe(200);
      const session = SessionResponse.parse(res.body);
      expect(session.user).toMatchObject({
        username: "karimova",
        role: "DOCTOR",
        district: "Chilonzor",
        facility: "Oilaviy poliklinika 12",
      });
      const cookie = sessionCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie.split(";")[0]!);
      expect(me.status).toBe(200);
      expect(SessionResponse.parse(me.body).user.id).toBe(userId("doctor-chilonzor"));

      // The cookie is enough to write: the edit is audited under the signed-in doctor.
      const edit = await request(app)
        .patch(`/api/patients/${demoId}`)
        .set("Cookie", cookie.split(";")[0]!)
        .send({ facility: "Oilaviy poliklinika 12" });
      expect(edit.status).toBe(200);

      const out = await request(app).post("/api/auth/logout").set("Cookie", cookie.split(";")[0]!);
      expect(out.status).toBe(200);
      const after = await request(app).get("/api/auth/me").set("Cookie", cookie.split(";")[0]!);
      expect(after.status).toBe(401);
      expect(ApiErrorBody.parse(after.body).error.code).toBe("ACTOR_REQUIRED");
    });

    it("ignores the demo header when it is switched off", async () => {
      const strict = createApp({
        pingDb: () => pingDatabase(pool),
        db,
        ruleSet: DEMO_RULE_SET,
        clock: () => NOW,
        auth: { allowDemoHeader: false, demoAccounts: { enabled: false, password: null } },
      });
      const me = await request(strict).get("/api/auth/me").set("x-demo-user-id", userId("manager"));
      expect(me.status).toBe(401);
      const accounts = DemoAccountsResponse.parse(
        (await request(strict).get("/api/auth/demo-accounts")).body,
      );
      expect(accounts).toEqual({ enabled: false, password: null, items: [] });
    });

    it("lets a session expire after its shift", async () => {
      const cookie = sessionCookie(await login("saidova", DEMO_PASSWORD)).split(";")[0]!;
      const later = createApp({
        pingDb: () => pingDatabase(pool),
        db,
        ruleSet: DEMO_RULE_SET,
        clock: () => new Date(NOW.getTime() + 13 * 3_600_000),
      });
      expect((await request(later).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    });
  });

  describe("access rules (TEAM_PLAN section 2)", () => {
    const as = (key: string) => ({ "x-demo-user-id": userId(key) });
    const strict = createApp({
      pingDb: () => pingDatabase(pool),
      db,
      ruleSet: DEMO_RULE_SET,
      clock: () => NOW,
      auth: { allowDemoHeader: false },
    });

    it("needs a signed-in user for patient data once the demo header is off", async () => {
      for (const path of [
        "/api/patients",
        `/api/patients/${demoId}`,
        "/api/alerts",
        "/api/audit",
      ]) {
        const res = await request(strict).get(path);
        expect(res.status, path).toBe(401);
      }
      expect((await request(strict).get("/api/ruleset")).status).toBe(200);
      expect((await request(strict).get("/api/health")).status).toBe(200);
    });

    it("shows a district doctor only her district, and the manager everything", async () => {
      const chilonzor = PatientListResponse.parse(
        (await request(app).get("/api/patients?pageSize=100").set(as("doctor-chilonzor"))).body,
      );
      expect(chilonzor.items.length).toBeGreaterThan(0);
      expect(new Set(chilonzor.items.map((p) => p.district))).toEqual(new Set(["Chilonzor"]));

      const all = PatientListResponse.parse(
        (await request(app).get("/api/patients?pageSize=100").set(as("manager"))).body,
      );
      expect(all.total).toBeGreaterThan(chilonzor.total);

      const other = all.items.find((p) => p.district !== "Chilonzor")!;
      const denied = await request(app)
        .get(`/api/patients/${other.id}`)
        .set(as("doctor-chilonzor"));
      expect(denied.status).toBe(403);
      expect(ApiErrorBody.parse(denied.body).error.code).toBe("FORBIDDEN");
    });

    it("lists only the doctor's own patients with assigned=me", async () => {
      const mine = PatientListResponse.parse(
        (
          await request(app)
            .get("/api/patients?assigned=me&pageSize=100")
            .set(as("doctor-chilonzor"))
        ).body,
      );
      expect(mine.items.length).toBeGreaterThan(0);
      for (const p of mine.items) expect(p.assignedUser?.id).toBe(userId("doctor-chilonzor"));
      expect((await request(app).get("/api/patients?assigned=me")).status).toBe(401);
    });

    it("shows a consultant no patients until one is referred to her", async () => {
      const res = await request(app).get("/api/patients").set(as("endocrinologist"));
      expect(PatientListResponse.parse(res.body).total).toBe(0);
      expect(
        (await request(app).get(`/api/patients/${demoId}`).set(as("endocrinologist"))).status,
      ).toBe(403);
    });

    it("keeps the manager read-only and nurses out of registration", async () => {
      const visit = await request(app)
        .post(`/api/patients/${demoId}/measurements`)
        .set(as("manager"))
        .send({
          submissionId: seedId("manager-visit"),
          measuredAt: NOW.toISOString(),
          measurements: [{ type: "HEMOGLOBIN", value: 120, unit: "g/L" }],
        });
      expect(visit.status).toBe(403);
      const register = await request(app).post("/api/patients").set(as("nurse-chilonzor")).send({
        externalReference: "OB-NURSE-1",
        displayName: "X",
        district: "Chilonzor",
        facility: "F",
      });
      expect(register.status).toBe(403);
    });

    it("lets a doctor register only in her own district", async () => {
      const res = await request(app).post("/api/patients").set(as("doctor-chilonzor")).send({
        externalReference: "OB-ELSEWHERE",
        displayName: "X",
        district: "Yunusobod",
        facility: "F",
      });
      expect(res.status).toBe(403);
    });

    it("scopes the dashboard to the user's patients", async () => {
      const doctor = DashboardStats.parse(
        (await request(app).get("/api/dashboard/stats").set(as("doctor-chilonzor"))).body,
      );
      const manager = DashboardStats.parse(
        (await request(app).get("/api/dashboard/stats").set(as("manager"))).body,
      );
      const total = (s: typeof doctor) => Object.values(s.zoneCounts).reduce((a, b) => a + b, 0);
      expect(total(doctor)).toBeLessThan(total(manager));
      expect(doctor.districts?.map((d) => d.district)).toEqual(["Chilonzor"]);
    });
  });

  describe("referrals to consultants", () => {
    const as = (key: string) => ({ "x-demo-user-id": userId(key) });
    const write = (body: object, actor = "doctor-chilonzor") =>
      request(app).post(`/api/patients/${demoId}/referrals`).set(as(actor)).send(body);
    const act = (id: string, body: object, actor: string) =>
      request(app).patch(`/api/referrals/${id}`).set(as(actor)).send(body);
    const reason = "Glyukoza 6,1 mmol/l nahorga: endokrinolog maslahati";

    it("goes from the doctor to the endocrinologist and back with a conclusion", async () => {
      const created = await write({ toSpecialty: "ENDOCRINOLOGIST", reason, urgency: "URGENT" });
      expect(created.status).toBe(201);
      const referral = Referral.parse(created.body);
      expect(referral).toMatchObject({ status: "SENT", toUser: null, urgency: "URGENT" });

      // Now the endocrinologist sees the patient and the referral in her inbox; the cardiologist does not.
      expect(
        (await request(app).get(`/api/patients/${demoId}`).set(as("endocrinologist"))).status,
      ).toBe(200);
      expect(
        (await request(app).get(`/api/patients/${demoId}`).set(as("cardiologist"))).status,
      ).toBe(403);
      const inbox = ReferralListResponse.parse(
        (await request(app).get("/api/referrals?box=incoming").set(as("endocrinologist"))).body,
      );
      expect(inbox.items.map((r) => r.id)).toContain(referral.id);
      const stats = DashboardStats.parse(
        (await request(app).get("/api/dashboard/stats").set(as("endocrinologist"))).body,
      );
      expect(stats.incomingReferrals).toBe(1);

      expect((await act(referral.id, { action: "ACCEPT" }, "cardiologist")).status).toBe(403);
      const accepted = Referral.parse(
        (await act(referral.id, { action: "ACCEPT" }, "endocrinologist")).body,
      );
      expect(accepted.toUser?.id).toBe(userId("endocrinologist"));
      expect((await act(referral.id, { action: "ACCEPT" }, "endocrinologist")).status).toBe(409);

      const concluded = Referral.parse(
        (
          await act(
            referral.id,
            {
              action: "CONCLUDE",
              conclusion: "GSD tasdiqlanmadi. Parhez, 2 haftadan keyin glyukoza.",
            },
            "endocrinologist",
          )
        ).body,
      );
      expect(concluded.status).toBe("CONCLUDED");
      expect(concluded.conclusion).toContain("GSD");

      // Only the author closes it.
      expect((await act(referral.id, { action: "CLOSE" }, "doctor-yunusobod")).status).toBe(403);
      const closed = Referral.parse(
        (await act(referral.id, { action: "CLOSE" }, "doctor-chilonzor")).body,
      );
      expect(closed.status).toBe("CLOSED");
      expect(
        (await request(app).get(`/api/patients/${demoId}`).set(as("endocrinologist"))).status,
      ).toBe(403);

      // The audit log has the steps, never the reason or the conclusion.
      const audit = AuditListResponse.parse(
        (await request(app).get(`/api/audit?entityType=REFERRAL&entityId=${referral.id}`)).body,
      );
      expect(audit.items.map((e) => e.action).sort()).toEqual([
        "REFERRAL_CREATED",
        "REFERRAL_UPDATED",
        "REFERRAL_UPDATED",
        "REFERRAL_UPDATED",
      ]);
      expect(JSON.stringify(audit.items)).not.toContain("Glyukoza");
      expect(JSON.stringify(audit.items)).not.toContain("GSD");
    });

    it("lets the author cancel, and a named consultant must match the specialty", async () => {
      const wrong = await write({
        toSpecialty: "CARDIOLOGIST",
        toUserId: userId("endocrinologist"),
        reason,
      });
      expect(wrong.status).toBe(400);

      const r = Referral.parse(
        (await write({ toSpecialty: "CARDIOLOGIST", reason: "AQB 150/95" })).body,
      );
      expect(r.urgency).toBe("ROUTINE");
      expect((await act(r.id, { action: "CANCEL" }, "cardiologist")).status).toBe(403);
      expect(
        Referral.parse((await act(r.id, { action: "CANCEL" }, "doctor-chilonzor")).body).status,
      ).toBe("CANCELLED");
      expect((await act(r.id, { action: "ACCEPT" }, "cardiologist")).status).toBe(409);
    });

    it("keeps nurses and managers from writing referrals", async () => {
      expect((await write({ toSpecialty: "THERAPIST", reason }, "nurse-chilonzor")).status).toBe(
        403,
      );
      expect((await write({ toSpecialty: "THERAPIST", reason }, "manager")).status).toBe(403);
    });

    it("shows the doctor's outgoing referrals and the open count on the patient", async () => {
      Referral.parse((await write({ toSpecialty: "NEPHROLOGIST", reason: "Proteinuriya" })).body);
      const out = ReferralListResponse.parse(
        (await request(app).get("/api/referrals?box=outgoing").set(as("doctor-chilonzor"))).body,
      );
      expect(out.items.length).toBeGreaterThanOrEqual(3);
      const patient = PatientDetail.parse((await request(app).get(`/api/patients/${demoId}`)).body);
      expect(patient.openReferralCount).toBe(1);
    });
  });

  describe("patient files (attachments)", () => {
    const as = (key: string) => ({ "x-demo-user-id": userId(key) });
    const pdf = Buffer.from("%PDF-1.4\n% synthetic ultrasound report\n%%EOF\n");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const upload = (
      file: Buffer,
      name: string,
      fields: Record<string, string>,
      actor = "nurse-chilonzor",
    ) => {
      let req = request(app).post(`/api/patients/${demoId}/attachments`).set(as(actor));
      for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
      return req.attach("file", file, name);
    };

    it("stores an ultrasound report, lists it and serves it back inline", async () => {
      const res = await upload(pdf, "UZI 22 hafta (Sinov).pdf", {
        kind: "ULTRASOUND",
        description: "22 hafta",
      });
      expect(res.status).toBe(201);
      const attachment = Attachment.parse(res.body);
      expect(attachment).toMatchObject({
        kind: "ULTRASOUND",
        contentType: "application/pdf",
        fileName: "UZI 22 hafta (Sinov).pdf",
        sizeBytes: pdf.length,
        uploadedBy: { id: userId("nurse-chilonzor") },
      });

      const list = AttachmentListResponse.parse(
        (await request(app).get(`/api/patients/${demoId}/attachments`).set(as("doctor-chilonzor")))
          .body,
      );
      expect(list.items[0]?.id).toBe(attachment.id);

      const file = await request(app)
        .get(`/api/attachments/${attachment.id}/file`)
        .set(as("doctor-chilonzor"))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      expect(file.status).toBe(200);
      expect(file.headers["content-type"]).toBe("application/pdf");
      expect(file.headers["content-disposition"]).toMatch(/^inline;/);
      expect(file.headers["x-content-type-options"]).toBe("nosniff");
      expect(Buffer.compare(file.body as Buffer, pdf)).toBe(0);

      // Another district's doctor cannot read it; the audit has no file name.
      expect(
        (
          await request(app)
            .get(`/api/attachments/${attachment.id}/file`)
            .set(as("doctor-yunusobod"))
        ).status,
      ).toBe(403);
      const audit = AuditListResponse.parse(
        (await request(app).get(`/api/audit?entityType=ATTACHMENT&entityId=${attachment.id}`)).body,
      );
      expect(audit.items[0]?.metadata).toMatchObject({
        kind: "ULTRASOUND",
        contentType: "application/pdf",
      });
      expect(JSON.stringify(audit.items)).not.toContain("Sinov");
    });

    it("decides the type from the bytes, not the name", async () => {
      const fake = await upload(Buffer.from("MZ executable"), "report.pdf", { kind: "OTHER" });
      expect(fake.status).toBe(415);
      const image = Attachment.parse(
        (await upload(png, "photo.bin", { kind: "LAB_RESULTS" })).body,
      );
      expect(image.contentType).toBe("image/png");
    });

    it("rejects files over 10 MB, a missing file and the manager", async () => {
      const big = Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]);
      expect((await upload(big, "big.pdf", { kind: "OTHER" })).status).toBe(413);
      const none = await request(app)
        .post(`/api/patients/${demoId}/attachments`)
        .set(as("nurse-chilonzor"))
        .field("kind", "OTHER");
      expect(none.status).toBe(400);
      expect((await upload(pdf, "m.pdf", { kind: "OTHER" }, "manager")).status).toBe(403);
    });

    it("attaches a consultant's conclusion file to the referral", async () => {
      const r = Referral.parse(
        (
          await request(app)
            .post(`/api/patients/${demoId}/referrals`)
            .set(as("doctor-chilonzor"))
            .send({ toSpecialty: "CARDIOLOGIST", reason: "AQB" })
        ).body,
      );
      const file = Attachment.parse(
        (
          await upload(
            pdf,
            "EKG xulosa.pdf",
            { kind: "SPECIALIST_CONCLUSION", referralId: r.id },
            "cardiologist",
          )
        ).body,
      );
      expect(file.referralId).toBe(r.id);

      const otherPatient = PatientListResponse.parse(
        (await request(app).get("/api/patients?pageSize=100")).body,
      ).items.find((p) => p.id !== demoId)!;
      const wrong = await request(app)
        .patch(`/api/referrals/${r.id}`)
        .set(as("cardiologist"))
        .send({ action: "CONCLUDE", conclusion: "Norma", attachmentIds: [seedId("not-a-file")] });
      expect(wrong.status).toBe(400);
      expect(otherPatient).toBeDefined();

      const done = Referral.parse(
        (
          await request(app)
            .patch(`/api/referrals/${r.id}`)
            .set(as("cardiologist"))
            .send({ action: "CONCLUDE", conclusion: "EKG: norma", attachmentIds: [file.id] })
        ).body,
      );
      expect(done.conclusionAttachmentIds).toEqual([file.id]);
    });
  });
});
