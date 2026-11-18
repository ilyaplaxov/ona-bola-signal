import {
  AiChatRequest,
  AnalyzeDocumentRequest,
  AnalyzeDocumentResponse,
  AiChatResponse,
  AnalyzeNoteRequest,
  AnalyzeNoteResponse,
  ExplainRiskRequest,
  ExplainRiskResponse,
  IdParams,
  type RiskAssessment,
} from "@ona-bola/shared";
import { Router } from "express";
import type { Database } from "../db/client";
import { HttpError } from "../http-error";
import { requireActor, requireActorContext } from "../middleware/auth";
import { assertCan, assertPatientAccess } from "../services/access";
import { parseInput, sendJson } from "../middleware/validate";
import { recordAudit } from "../services/audit.service";
import {
  AiUnavailableError,
  type AiService,
  type ChatContext,
  type DocumentContentType,
  type ExplanationFacts,
  tashkentTime,
} from "../services/claude.service";
import { toNoteDraft, toUltrasoundDating } from "../services/note-draft";
import {
  getAttachment,
  readAttachmentFile,
  type AttachmentStore,
} from "../services/attachment.service";
import { getPatient, listMeasurements } from "../services/patient.service";

/** Explanations kept in memory. An assessment never changes, so its explanation can be reused. */
const EXPLANATION_CACHE_SIZE = 200;

/** Only the engine's output and the gestational week go to Claude (no name, reference or district). */
export function toExplanationFacts(
  assessment: RiskAssessment,
  gestationalWeek: number | null,
): ExplanationFacts {
  return {
    zone: assessment.zone,
    ruleSetVersion: assessment.ruleSetVersion,
    ruleSetKind: assessment.ruleSetKind,
    gestationalWeek,
    reasons: assessment.reasons.map(({ ruleId, zone, text, observed }) => ({
      ruleId,
      zone,
      text,
      observed,
    })),
    trendFindings: assessment.trendFindings
      .filter((t) => t.status === "TRIGGERED")
      .map(({ ruleId, measure, status, text }) => ({ ruleId, measure, status, text })),
    dataWarnings: assessment.dataWarnings.map(({ code, measure, text }) => ({
      code,
      measure,
      text,
    })),
  };
}

/**
 * Claude endpoints. They answer 503 AI_UNAVAILABLE when AI is off or the call fails, and the
 * clinician carries on by hand: the zone, the alerts and the form never depend on Claude.
 */
export function aiRouter(deps: {
  db: Database;
  ai: AiService | null;
  clock: () => Date;
  store: AttachmentStore;
}): Router {
  const router = Router();
  const explanations = new Map<string, ExplainRiskResponse>();

  function requireAi(): AiService {
    if (!deps.ai) {
      throw new HttpError(503, "AI_UNAVAILABLE", "AI features are turned off on this server");
    }
    return deps.ai;
  }

  async function callAi<T>(task: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      // The message names the failure only; it never contains the note or the model's reply.
      console.warn(`${task}: ${error.message}`);
      throw new HttpError(503, "AI_UNAVAILABLE", "AI is not available right now", {
        reason: error.reason,
      });
    }
  }

  router.post("/patients/:id/analyze-note", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "AI_USE");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actorContext, id);
    const body = parseInput(AnalyzeNoteRequest, req.body);
    const ai = requireAi();

    const now = deps.clock();
    const result = await callAi("Note analysis", () =>
      ai.extractNote({ note: body.note, language: body.language, now }),
    );
    const { draft, warnings } = toNoteDraft(result.output, { language: body.language, now });

    await recordAudit(deps.db, {
      actorUserId: actor.id,
      action: "AI_NOTE_ANALYZED",
      entityType: "PATIENT",
      entityId: id,
      patientId: id,
      // Never the note itself: only its length and what the draft contains.
      metadata: {
        model: result.model,
        language: body.language,
        noteLength: body.note.length,
        draftTypes: draft.measurements.map((m) => m.type),
        warningCount: warnings.length,
      },
      createdAt: now,
    });
    sendJson(res, AnalyzeNoteResponse, { draft, warnings, model: result.model });
  });

  router.post("/patients/:id/risk/explain", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "AI_USE");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actorContext, id);
    const body = parseInput(ExplainRiskRequest, req.body ?? {});
    const ai = requireAi();
    const now = deps.clock();
    const patient = await getPatient(deps.db, id, now);
    const assessment = patient.currentAssessment;
    if (!assessment) {
      throw new HttpError(409, "CONFLICT", "This patient has no risk assessment to explain yet");
    }

    const key = `${assessment.id}:${body.language}`;
    const cached = explanations.get(key);
    if (cached) {
      sendJson(res, ExplainRiskResponse, cached);
      return;
    }

    const facts = toExplanationFacts(assessment, patient.gestationalWeek);
    const result = await callAi("Risk explanation", () =>
      ai.explainAssessment({ facts, language: body.language }),
    );
    const response: ExplainRiskResponse = {
      assessmentId: assessment.id,
      summary: result.output.summary.trim(),
      keyPoints: result.output.keyPoints.map((p) => p.trim()).filter((p) => p !== ""),
      model: result.model,
      generatedAt: now.toISOString(),
    };

    await recordAudit(deps.db, {
      actorUserId: actor.id,
      action: "AI_EXPLANATION_GENERATED",
      entityType: "RISK_ASSESSMENT",
      entityId: assessment.id,
      patientId: id,
      metadata: { model: result.model, language: body.language, zone: assessment.zone },
      createdAt: now,
    });
    if (explanations.size >= EXPLANATION_CACHE_SIZE) explanations.clear();
    explanations.set(key, response);
    sendJson(res, ExplainRiskResponse, response);
  });

  router.post("/patients/:id/ai/chat", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "AI_USE");
    const actor = requireActor(res);
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actorContext, id);
    const body = parseInput(AiChatRequest, req.body);
    const ai = requireAi();
    const now = deps.clock();
    const patient = await getPatient(deps.db, id, now);
    const history = await listMeasurements(deps.db, id);

    // De-identified: no name, reference, district, facility or date of birth.
    const context: ChatContext = {
      ageYears: patient.ageYears,
      gestationalAgeDays: patient.gestationalAgeDays,
      riskFactors: patient.riskFactors,
      riskGroups: patient.riskGroups ?? null,
      assessment: patient.currentAssessment
        ? toExplanationFacts(patient.currentAssessment, patient.gestationalWeek)
        : null,
      measurements: history.items.map((m) => ({
        measuredAt: m.measuredAt,
        reading: { ...m.reading },
      })),
    };
    const result = await callAi("Chat", () =>
      ai.chat({ context, messages: body.messages, language: body.language }),
    );

    await recordAudit(deps.db, {
      actorUserId: actor.id,
      action: "AI_CHAT_ANSWERED",
      entityType: "PATIENT",
      entityId: id,
      patientId: id,
      // Never the question or the answer: only the model, language and size of the exchange.
      metadata: {
        model: result.model,
        language: body.language,
        turns: Math.ceil(body.messages.length / 2),
        questionLength: body.messages.at(-1)?.content.length ?? 0,
      },
      createdAt: now,
    });
    sendJson(res, AiChatResponse, {
      answer: result.output.answer.trim(),
      model: result.model,
      generatedAt: now.toISOString(),
    });
  });

  router.post("/attachments/:id/analyze", async (req, res) => {
    const actorContext = requireActorContext(res);
    assertCan(actorContext, "AI_USE");
    const { id } = parseInput(IdParams, req.params);
    const meta = await getAttachment(deps.db, id);
    await assertPatientAccess(deps.db, actorContext, meta.patientId);
    const body = parseInput(AnalyzeDocumentRequest, req.body ?? {});
    if (meta.contentType === "application/dicom") {
      throw new HttpError(415, "VALIDATION_FAILED", "AI reads PDF and image reports, not DICOM");
    }
    const ai = requireAi();
    const { bytes } = await readAttachmentFile(deps.db, deps.store, id);

    const now = deps.clock();
    const result = await callAi("Document analysis", () =>
      ai.extractDocument({
        document: {
          contentType: meta.contentType as DocumentContentType,
          base64: bytes.toString("base64"),
        },
        kind: meta.kind,
        language: body.language,
        now,
      }),
    );
    const { draft, warnings } = toNoteDraft(result.output, { language: body.language, now });
    const dating = toUltrasoundDating(result.output.ultrasoundDating, {
      language: body.language,
      today: tashkentTime(now).slice(0, 10),
    });

    await recordAudit(deps.db, {
      actorUserId: actorContext.id,
      action: "AI_DOCUMENT_ANALYZED",
      entityType: "ATTACHMENT",
      entityId: id,
      patientId: meta.patientId,
      // Never the document or its text: only what kind of draft came out.
      metadata: {
        model: result.model,
        language: body.language,
        kind: meta.kind,
        contentType: meta.contentType,
        draftTypes: draft.measurements.map((m) => m.type),
        hasDating: dating.dating !== null,
        warningCount: warnings.length + dating.warnings.length,
      },
      createdAt: now,
    });
    sendJson(res, AnalyzeDocumentResponse, {
      draft,
      dating: dating.dating,
      warnings: [...warnings, ...dating.warnings],
      model: result.model,
    });
  });

  return router;
}
