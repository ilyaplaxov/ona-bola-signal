import Anthropic from "@anthropic-ai/sdk";
import type { NoteExtractionOutput } from "@ona-bola/shared";
import { describe, expect, it } from "vitest";
import {
  AiUnavailableError,
  aiServiceFromConfig,
  createClaudeService,
  tashkentTime,
  type ExplanationFacts,
} from "../src/services/claude.service";

// No network and no API key: a fake client stands in for the SDK and records each request.

const NOW = new Date("2026-11-18T06:00:00Z");

const extraction: NoteExtractionOutput = {
  measuredAt: "2026-11-18T09:30:00+05:00",
  bloodPressure: { systolic: 148, diastolic: 96, unitAsWritten: "mmHg" },
  hemoglobin: null,
  proteinuria: { value: 0.6, unitAsWritten: "g/l" },
  glucose: null,
  missingOrUnclear: [],
};

const facts: ExplanationFacts = {
  zone: "RED",
  ruleSetVersion: "demo-0.1",
  ruleSetKind: "ILLUSTRATIVE",
  gestationalWeek: 32,
  reasons: [
    {
      ruleId: "DEMO-BP-SEVERE",
      zone: "RED",
      text: "Blood pressure at or above 160/110 mmHg",
      observed: [],
    },
  ],
  trendFindings: [],
  dataWarnings: [],
};

type Reply = { stop_reason?: string; content?: unknown[]; model?: string; stop_details?: unknown };

/** A stand-in for the SDK client: returns `reply` (or throws it) and keeps the request params. */
function fakeClient(reply: Reply | Error) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          requests.push(params);
          if (reply instanceof Error) throw reply;
          return {
            model: "claude-opus-5-5",
            stop_reason: "end_turn",
            stop_details: null,
            content: [],
            ...reply,
          };
        },
      },
    },
  };
  return { client: client as unknown as Pick<Anthropic, "beta">, requests };
}

const text = (value: unknown) => ({
  type: "text",
  text: typeof value === "string" ? value : JSON.stringify(value),
});

const reasonOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiUnavailableError);
  return (error as AiUnavailableError).reason;
};

describe("Claude service", () => {
  it("asks for structured output at low effort with the refusal fallback on", async () => {
    const { client, requests } = fakeClient({
      content: [{ type: "thinking", thinking: "", signature: "x" }, text(extraction)],
    });
    const ai = createClaudeService({ client, model: "claude-opus-5-5" });
    const result = await ai.extractNote({
      note: "AD 148/96, oqsil 0.6 g/l",
      language: "uz",
      now: NOW,
    });

    expect(result).toEqual({ output: extraction, model: "claude-opus-5-5" });
    const params = requests[0]!;
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(params.system).toContain("Uzbek (Latin script)");
    expect(params.system).toContain("Never estimate, calculate or convert a value");
    const [message] = params.messages as { role: string; content: string }[];
    expect(message?.content).toContain("<note>\nAD 148/96, oqsil 0.6 g/l\n</note>");
    expect(message?.content).toContain("Current time in Tashkent: 2026-11-18T11:00:00+05:00");
  });

  it("gives Claude no zone field to fill in either task", async () => {
    const { client, requests } = fakeClient({
      content: [text({ summary: "Qizil zona.", keyPoints: ["Bosim yuqori"] })],
    });
    const ai = createClaudeService({ client, model: "m" });
    await ai.explainAssessment({ facts, language: "uz" });
    const format = (requests[0]!.output_config as { format: { schema: unknown } }).format;
    expect(JSON.stringify(format.schema)).not.toMatch(/zone/i);
    expect(requests[0]!.system).toContain("The zone is final");
  });

  it("uses the answer of the model that finished after a fallback", async () => {
    const { client } = fakeClient({
      model: "claude-opus-5",
      content: [
        text('{"summ'),
        { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
        text({ summary: "Explained.", keyPoints: [] }),
      ],
    });
    const ai = createClaudeService({ client, model: "claude-opus-5-5" });
    const result = await ai.explainAssessment({ facts, language: "en" });
    expect(result).toEqual({
      output: { summary: "Explained.", keyPoints: [] },
      model: "claude-opus-5",
    });
  });

  it("reports refusals, cut-off replies and replies that do not fit the schema", async () => {
    const ask = (reply: Reply) =>
      createClaudeService({ ...fakeClient(reply), model: "m" }).extractNote({
        note: "n",
        language: "en",
        now: NOW,
      });
    expect(await reasonOf(ask({ stop_reason: "refusal", stop_details: { category: "bio" } }))).toBe(
      "refusal",
    );
    expect(await reasonOf(ask({ stop_reason: "max_tokens", content: [text('{"a"')] }))).toBe(
      "max_tokens",
    );
    expect(await reasonOf(ask({ content: [text("Sorry, no JSON here")] }))).toBe("unparseable");
    expect(await reasonOf(ask({ content: [text({ bloodPressure: "high" })] }))).toBe("unparseable");
  });

  it("treats an empty explanation as unusable", async () => {
    const { client } = fakeClient({ content: [text({ summary: "  ", keyPoints: [] })] });
    const ai = createClaudeService({ client, model: "m" });
    expect(await reasonOf(ai.explainAssessment({ facts, language: "en" }))).toBe("unparseable");
  });

  it("maps SDK errors to reasons and lets programming errors through", async () => {
    const fail = (error: Error) =>
      createClaudeService({ ...fakeClient(error), model: "m" }).explainAssessment({
        facts,
        language: "en",
      });
    expect(await reasonOf(fail(new Anthropic.APIConnectionTimeoutError()))).toBe("timeout");
    expect(await reasonOf(fail(new Anthropic.APIConnectionError({ message: "offline" })))).toBe(
      "connection",
    );
    await expect(fail(new TypeError("bug"))).rejects.toThrow(TypeError);
  });
});

describe("Claude chat", () => {
  const context = {
    ageYears: 29,
    gestationalAgeDays: 224,
    riskFactors: { parity: 0 },
    riskGroups: null,
    assessment: facts,
    measurements: [],
  };

  it("sends the conversation as is, with the record in the system prompt", async () => {
    const { client, requests } = fakeClient({ content: [text({ answer: "Javob" })] });
    const ai = createClaudeService({ client, model: "m" });
    const messages = [
      { role: "user" as const, content: "Nega qizil?" },
      { role: "assistant" as const, content: "Bosim yuqori." },
      { role: "user" as const, content: "Qaysi qiymat?" },
    ];
    const result = await ai.chat({ context, messages, language: "ru" });
    expect(result.output.answer).toBe("Javob");
    expect(requests[0]!.messages).toEqual(messages);
    const system = requests[0]!.system as string;
    expect(system).toContain("<record>");
    expect(system).toContain("Russian");
    expect(system).toContain("Never assign, change or question a zone");
    expect(system).toContain("Never name, repeat or add details to medicines");
    const format = (requests[0]!.output_config as { format: { schema: unknown } }).format;
    expect(JSON.stringify(format.schema)).not.toMatch(/zone/i);
  });

  it("treats an empty answer as unusable", async () => {
    const { client } = fakeClient({ content: [text({ answer: " " })] });
    const ai = createClaudeService({ client, model: "m" });
    const messages = [{ role: "user" as const, content: "?" }];
    expect(await reasonOf(ai.chat({ context, messages, language: "uz" }))).toBe("unparseable");
  });
});

describe("aiServiceFromConfig", () => {
  const base = { CLAUDE_MODEL: "claude-opus-5-5", CLAUDE_TIMEOUT_MS: 15_000 };

  it("stays off unless AI_ENABLED is true and a key is set", () => {
    expect(
      aiServiceFromConfig({ ...base, AI_ENABLED: false, ANTHROPIC_API_KEY: "k" }).ai,
    ).toBeNull();
    const noKey = aiServiceFromConfig({ ...base, AI_ENABLED: true, ANTHROPIC_API_KEY: undefined });
    expect(noKey.ai).toBeNull();
    expect(noKey.status).toContain("ANTHROPIC_API_KEY is empty");
  });

  it("builds the service without calling the API", () => {
    const on = aiServiceFromConfig({ ...base, AI_ENABLED: true, ANTHROPIC_API_KEY: "sk-test" });
    expect(on.ai?.model).toBe("claude-opus-5-5");
    expect(on.status).toContain("refusal fallback on");
  });
});

describe("tashkentTime", () => {
  it("shows the wall-clock time in Tashkent with its offset", () => {
    expect(tashkentTime(new Date("2026-11-17T19:05:09Z"))).toBe("2026-11-18T00:05:09+05:00");
  });
});
