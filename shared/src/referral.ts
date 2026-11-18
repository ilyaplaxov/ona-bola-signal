import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { Specialty, UserRef } from "./user";

// Referral to a consultant after the obstetric visit (mentor item 3).
// SENT → ACCEPTED → CONCLUDED → CLOSED; SENT or ACCEPTED → CANCELLED by the referring doctor.

export const ReferralStatus = z.enum(["SENT", "ACCEPTED", "CONCLUDED", "CLOSED", "CANCELLED"]);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

export const ReferralUrgency = z.enum(["ROUTINE", "URGENT"]);
export type ReferralUrgency = z.infer<typeof ReferralUrgency>;

export const Referral = z.object({
  id: Uuid,
  patientId: Uuid,
  patientReference: z.string().min(1),
  fromUser: UserRef,
  toSpecialty: Specialty,
  /** The consultant it was addressed to, or who accepted it; null while any consultant of the specialty may take it. */
  toUser: UserRef.nullable(),
  /** Clinical reason, free text. Stored with the referral, never copied to the audit log. */
  reason: z.string().min(1),
  urgency: ReferralUrgency,
  status: ReferralStatus,
  /** The consultant's conclusion text, set when the referral is CONCLUDED. */
  conclusion: z.string().nullable(),
  /** Files attached as the conclusion (attachment ids). */
  conclusionAttachmentIds: z.array(Uuid),
  createdAt: IsoDateTime,
  acceptedAt: IsoDateTime.nullable(),
  concludedAt: IsoDateTime.nullable(),
  closedAt: IsoDateTime.nullable(),
});
export type Referral = z.infer<typeof Referral>;

export const CreateReferralRequest = z.object({
  toSpecialty: Specialty,
  /** Optional: a particular consultant. Without it, every consultant of the specialty sees it. */
  toUserId: Uuid.optional(),
  reason: z.string().trim().min(1).max(1000),
  urgency: ReferralUrgency.default("ROUTINE"),
});
export type CreateReferralRequest = z.infer<typeof CreateReferralRequest>;

/** PATCH /api/referrals/:id — one action per request. */
export const ReferralActionRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT") }),
  z.object({
    action: z.literal("CONCLUDE"),
    conclusion: z.string().trim().min(1).max(4000),
    attachmentIds: z.array(Uuid).max(10).default([]),
  }),
  z.object({ action: z.literal("CLOSE") }),
  z.object({ action: z.literal("CANCEL") }),
]);
export type ReferralActionRequest = z.infer<typeof ReferralActionRequest>;

export const ReferralListQuery = z.object({
  /** incoming: addressed to me or my specialty; outgoing: written by me; all: every referral I may see. */
  box: z.enum(["incoming", "outgoing", "all"]).default("all"),
  status: ReferralStatus.optional(),
  patientId: Uuid.optional(),
});
export type ReferralListQuery = z.infer<typeof ReferralListQuery>;

export const ReferralListResponse = z.object({
  /** Newest first. */
  items: z.array(Referral),
});
export type ReferralListResponse = z.infer<typeof ReferralListResponse>;
