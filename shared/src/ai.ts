import { z } from "zod";

// Structured outputs requested from Claude (phase 5). They are kept flat and permissive so they
// convert to the JSON-schema subset that structured outputs support. The backend then converts
// units in code and validates every value with MeasurementReading before anything reaches the form.
// Claude never returns or changes a zone: none of these schemas has a zone field.

const ExtractedValue = z.object({
  value: z.number(),
  /** Unit exactly as written in the note, or null if none was written. Converted in code, never by the model. */
  unitAsWritten: z.string().nullable(),
});

/** What Claude returns for POST /api/patients/:id/analyze-note. */
export const NoteExtractionOutput = z.object({
  /** ISO 8601 timestamp, only if the note states when the values were measured. */
  measuredAt: z.string().nullable(),
  bloodPressure: z
    .object({
      systolic: z.number(),
      diastolic: z.number(),
      unitAsWritten: z.string().nullable(),
    })
    .nullable(),
  hemoglobin: ExtractedValue.nullable(),
  proteinuria: ExtractedValue.nullable(),
  glucose: ExtractedValue.nullable(),
  /** Things a clinician should check: missing values, ambiguous wording, units that were not written. */
  missingOrUnclear: z.array(z.string()),
});
export type NoteExtractionOutput = z.infer<typeof NoteExtractionOutput>;

/** What Claude returns for POST /api/patients/:id/risk/explain. */
export const ExplanationOutput = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
});
export type ExplanationOutput = z.infer<typeof ExplanationOutput>;
