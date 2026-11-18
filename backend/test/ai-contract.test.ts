import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExplanationOutput, NoteExtractionOutput } from "@ona-bola/shared";
import { describe, expect, it } from "vitest";

// Freeze check for contracts v1: the AI output schemas convert to Claude structured-output formats
// with the pinned Zod and SDK versions, and parse a well-formed reply. No API call is made.
describe("AI output schemas", () => {
  it("NoteExtractionOutput converts to a JSON-schema output format and parses a reply", () => {
    const format = zodOutputFormat(NoteExtractionOutput);
    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({ type: "object" });

    const reply = {
      measuredAt: null,
      bloodPressure: { systolic: 120, diastolic: 80, unitAsWritten: "mmHg" },
      hemoglobin: null,
      proteinuria: null,
      glucose: null,
      missingOrUnclear: ["No haemoglobin value in the note"],
    };
    expect(format.parse(JSON.stringify(reply))).toEqual(reply);
  });

  it("ExplanationOutput converts and gives Claude no zone field to fill", () => {
    const format = zodOutputFormat(ExplanationOutput);
    expect(format.type).toBe("json_schema");
    expect(JSON.stringify(format.schema)).not.toMatch(/zone/i);
  });
});
