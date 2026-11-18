import { z } from "zod";
import { RiskAssessment } from "./assessment";
import { IsoDate, IsoDateTime, Uuid } from "./common";
import { DatingMethod } from "./pregnancy";
import { SignalLinkState } from "./patient-signal";
import { RiskFlag, RiskGroup } from "./risk-groups";
import { UserRef } from "./user";
import { RiskZone } from "./zones";

/**
 * Patient-level risk factors from the brief's research list. Which ones count is the domain mentor's call.
 * A missing key means "not recorded" (the engine reports it as missing data); false means "recorded as absent".
 */
export const RiskFactors = z.strictObject({
  previousCesarean: z.boolean().optional(),
  gestationalDiabetes: z.boolean().optional(),
  /** Number of previous births. Recording it marks the anamnesis as taken: the risk-group scales need it. */
  parity: z.number().int().nonnegative().optional(),
  /** Body-mass index before pregnancy, kg/m². */
  bmi: z.number().positive().optional(),
  /** Anamnesis and pregnancy findings recorded as present, for the risk-group scales. */
  flags: z.array(RiskFlag).optional(),
});
export type RiskFactors = z.infer<typeof RiskFactors>;

/** Registry row. Age and gestational week are derived on the server when the row is read. */
export const PatientSummary = z.object({
  id: Uuid,
  /** Short synthetic reference (for example "OB-0001"), used in alert previews instead of the name. */
  externalReference: z.string().min(1),
  displayName: z.string().min(1),
  district: z.string().min(1),
  facility: z.string().min(1),
  ageYears: z.number().int().nonnegative().nullable(),
  gestationalWeek: z.number().int().nonnegative().nullable(),
  estimatedDueDate: IsoDate.nullable(),
  /** null means the patient has not been assessed yet ("Not assessed" in the UI). */
  currentRiskZone: RiskZone.nullable(),
  /** The latest assessment reported missing, stale or implausible data. */
  hasDataWarnings: z.boolean(),
  lastMeasurementAt: IsoDateTime.nullable(),
  openAlertCount: z.number().int().nonnegative(),
  assignedUser: UserRef.nullable(),
});
export type PatientSummary = z.infer<typeof PatientSummary>;

export const PatientDetail = PatientSummary.extend({
  dateOfBirth: IsoDate.nullable(),
  /** LMP-equivalent start of the pregnancy; derived from the due date for records that only have one. */
  pregnancyStartDate: IsoDate.nullable(),
  /** How the pregnancy was dated; null for records created with a due date only. */
  datingMethod: DatingMethod.nullable(),
  /** Completed days of pregnancy today (weeks = floor(days / 7)); null when undated or not started. */
  gestationalAgeDays: z.number().int().nonnegative().nullable(),
  riskFactors: RiskFactors,
  /**
   * Risk groups from the anamnesis (antenatal protocol, pp. 33–41), worked out when the patient is
   * read. Badges only: not a zone, never changes one. null when the parity or the age is not
   * recorded, so the scales cannot be applied.
   */
  riskGroups: z.array(RiskGroup).nullable().optional(),
  currentAssessment: RiskAssessment.nullable(),
  /** Whether the patient can signal through the Telegram bot or the web page. */
  signalLink: SignalLinkState.optional(),
  /** Open referrals (SENT or ACCEPTED). */
  openReferralCount: z.number().int().nonnegative().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type PatientDetail = z.infer<typeof PatientDetail>;
