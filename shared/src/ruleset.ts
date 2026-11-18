import { z } from "zod";
import { RuleSetKind } from "./assessment";
import { MeasureKey } from "./measurement";
import { ElevatedZone } from "./zones";

export const RuleKind = z.enum(["THRESHOLD", "TREND", "DATA_QUALITY"]);
export type RuleKind = z.infer<typeof RuleKind>;

/**
 * Documents a rule can cite by page. The UI names each one in Uzbek and English.
 * - UZ_ANTENATAL_CARE_2025: national clinical protocol «Антенатальный уход. Ведение беременных групп
 *   риска», Ministry of Health of Uzbekistan, order No. 180 of 23 June 2025.
 * - UZ_IRON_DEFICIENCY_ANAEMIA_2025: national clinical protocol «Ведение беременных с
 *   железодефицитной анемией», same order.
 */
export const SourceDocument = z.enum(["UZ_ANTENATAL_CARE_2025", "UZ_IRON_DEFICIENCY_ANAEMIA_2025"]);
export type SourceDocument = z.infer<typeof SourceDocument>;

/** Printed page numbers in one document, for example ["34", "36"] or ["12–13"]. */
export const RuleCitation = z.object({
  document: SourceDocument,
  pages: z.array(z.string().min(1)).min(1),
});
export type RuleCitation = z.infer<typeof RuleCitation>;

export const RuleSource = z
  .object({
    status: RuleSetKind,
    /** Citation (protocol, order number, page) for a VALIDATED rule; null for an ILLUSTRATIVE one. */
    ref: z.string().min(1).nullable(),
    /**
     * The same pages in structured form, shown under each reason on the patient card.
     * Absent when no protocol page supports the rule (for example a team choice from the brief).
     */
    citations: z.array(RuleCitation).min(1).optional(),
  })
  .refine((s) => s.status !== "VALIDATED" || s.ref !== null, {
    message: "A validated rule needs a source reference",
    path: ["ref"],
  });
export type RuleSource = z.infer<typeof RuleSource>;

/**
 * Weeks of pregnancy a rule applies to.
 * - `{ from, to }`: from ≤ week < to; either end may be left open. A threshold rule checks the week
 *   on the date of each reading it reads; a data-quality rule checks today's week.
 * - `{ unknown: true }`: only while the week is unknown (no estimated due date), so a family of
 *   week-specific rules still covers a patient without one.
 */
export const GestationalWeeks = z.union([
  z
    .strictObject({
      from: z.number().int().nonnegative().optional(),
      to: z.number().int().positive().optional(),
    })
    .refine((w) => w.from !== undefined || w.to !== undefined, {
      message: "A week range needs at least one end",
    })
    .refine((w) => w.from === undefined || w.to === undefined || w.from < w.to, {
      message: "A week range must start before it ends",
    }),
  z.strictObject({ unknown: z.literal(true) }),
]);
export type GestationalWeeks = z.infer<typeof GestationalWeeks>;

/** One rule as shown on the rules page and in GET /api/ruleset. */
export const RuleInfo = z.object({
  id: z.string().min(1),
  kind: RuleKind,
  /** Every input the rule reads; a combined rule (for example pressure and proteinuria) lists several. */
  measures: z.array(MeasureKey).min(1),
  /** Zone the rule asks for; null for a rule that only reports (a data warning or an informational trend). */
  zone: ElevatedZone.nullable(),
  /** Plain-language description, including the value the rule uses. */
  description: z.string().min(1),
  source: RuleSource,
  /** Weeks of pregnancy the rule is limited to; absent when it applies at any week. */
  gestationalWeeks: GestationalWeeks.optional(),
});
export type RuleInfo = z.infer<typeof RuleInfo>;

export const RuleSetInfo = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  kind: RuleSetKind,
  rules: z.array(RuleInfo),
});
export type RuleSetInfo = z.infer<typeof RuleSetInfo>;
