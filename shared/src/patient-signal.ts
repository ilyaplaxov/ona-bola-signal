import { z } from "zod";
import { IsoDateTime, Language, Uuid } from "./common";
import { UserRef } from "./user";

// A pregnant woman signals her polyclinic herself, through the Telegram bot or the /signal web page
// (TEAM_PLAN section 2a). Only buttons, no free text.

/**
 * The 13 alarm signs are the antenatal protocol's list, word for word in the source
 * (АУ с. 30, also с. 60; data-pack/protocol-data.ts ALARM_SIGNS, same ids). LABOUR_ONSET and
 * CALL_BACK are ours: they are not protocol alarm signs.
 */
export const SignalKind = z.enum([
  "VOMITING_OVER_5",
  "VAGINAL_BLEEDING",
  "WATERY_DISCHARGE",
  "HEADACHE_VISION",
  "SUDDEN_EDEMA",
  "FEVER_38",
  "VAGINAL_ITCH",
  "DYSURIA",
  "ABDOMINAL_PAIN",
  "CONTRACTIONS",
  "ABDOMINAL_TRAUMA",
  "FETAL_MOVEMENT_CHANGE",
  "AMNIOTIC_LEAK",
  "LABOUR_ONSET",
  "CALL_BACK",
]);
export type SignalKind = z.infer<typeof SignalKind>;

/** Kinds that are protocol alarm signs ("seek medical help at once", АУ с. 30). */
export const isAlarmSign = (kind: SignalKind) => kind !== "LABOUR_ONSET" && kind !== "CALL_BACK";

/**
 * What the patient is told at once, before anyone reads the signal:
 * - SEEK_CARE_NOW: "Seek medical help immediately. If you feel very unwell, call 103." (protocol wording);
 * - LABOUR: "Call 103 or go to the maternity hospital.";
 * - DOCTOR_WILL_CALL: "Your doctor will call you."
 * The texts live in the interface and in the bot, in uz / ru / en.
 */
export const SignalInstruction = z.enum(["SEEK_CARE_NOW", "LABOUR", "DOCTOR_WILL_CALL"]);
export type SignalInstruction = z.infer<typeof SignalInstruction>;

export const signalInstruction = (kind: SignalKind): SignalInstruction =>
  kind === "LABOUR_ONSET" ? "LABOUR" : kind === "CALL_BACK" ? "DOCTOR_WILL_CALL" : "SEEK_CARE_NOW";

export const SignalChannel = z.enum(["TELEGRAM", "WEB"]);
export type SignalChannel = z.infer<typeof SignalChannel>;

/** NEW until a clinician records what was done. */
export const SignalStatus = z.enum(["NEW", "CONTACTED", "CALLED_IN", "SENT_TO_HOSPITAL"]);
export type SignalStatus = z.infer<typeof SignalStatus>;

/** A NEW signal older than this is shown to the manager too. A setting, not a clinical rule. */
export const SIGNAL_ESCALATION_MINUTES = 30;

export const PatientSignal = z.object({
  id: Uuid,
  patientId: Uuid,
  /** Short reference, never the name. */
  patientReference: z.string().min(1),
  kind: SignalKind,
  channel: SignalChannel,
  status: SignalStatus,
  createdAt: IsoDateTime,
  /** true when still NEW after SIGNAL_ESCALATION_MINUTES. */
  escalated: z.boolean(),
  handledBy: UserRef.nullable(),
  handledAt: IsoDateTime.nullable(),
});
export type PatientSignal = z.infer<typeof PatientSignal>;

export const SignalListQuery = z.object({
  status: SignalStatus.optional(),
  patientId: Uuid.optional(),
});
export type SignalListQuery = z.infer<typeof SignalListQuery>;

export const SignalListResponse = z.object({
  /** Newest first. */
  items: z.array(PatientSignal),
});
export type SignalListResponse = z.infer<typeof SignalListResponse>;

export const HandleSignalRequest = z.object({
  status: z.enum(["CONTACTED", "CALLED_IN", "SENT_TO_HOSPITAL"]),
});
export type HandleSignalRequest = z.infer<typeof HandleSignalRequest>;

// ---- Linking a patient to the bot or the web page ----

/** One-time code, 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L). */
export const SignalLinkCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJKMNP-Z2-9]{8}$/, "8-character code");

/** POST /api/patients/:id/signal-link (staff). A new code replaces any unused earlier one. */
export const SignalLinkResponse = z.object({
  code: SignalLinkCode,
  expiresAt: IsoDateTime,
  /** t.me deep link; null when the bot is not configured. */
  telegramUrl: z.string().url().nullable(),
  /** Path of the web page; the code is typed there or carried in the link. */
  webPath: z.string().min(1),
});
export type SignalLinkResponse = z.infer<typeof SignalLinkResponse>;

/** How the patient is linked; part of PatientDetail. */
export const SignalLinkState = z.object({
  telegram: z.boolean(),
  web: z.boolean(),
  linkedAt: IsoDateTime.nullable(),
});
export type SignalLinkState = z.infer<typeof SignalLinkState>;

// ---- Patient-facing web page (/signal), no sign-in ----

/** POST /api/public/signal/redeem: the patient enters the code and agrees. */
export const RedeemSignalCodeRequest = z.object({
  code: SignalLinkCode,
  /** "Your signal goes to your doctor. Messages pass through the internet. This does not replace 103." */
  consent: z.literal(true),
  language: Language.default("uz"),
});
export type RedeemSignalCodeRequest = z.infer<typeof RedeemSignalCodeRequest>;

/** The device token the page keeps (localStorage) and sends with each signal. */
export const RedeemSignalCodeResponse = z.object({
  token: z.string().min(32),
});
export type RedeemSignalCodeResponse = z.infer<typeof RedeemSignalCodeResponse>;

/** POST /api/public/signal */
export const SendSignalRequest = z.object({
  token: z.string().min(32).max(200),
  kind: SignalKind,
});
export type SendSignalRequest = z.infer<typeof SendSignalRequest>;

export const SendSignalResponse = z.object({
  instruction: SignalInstruction,
  receivedAt: IsoDateTime,
});
export type SendSignalResponse = z.infer<typeof SendSignalResponse>;
