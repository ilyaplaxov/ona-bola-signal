import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";

// Integration layer for DIMED (mentor items 1 and 8). Every record that DIMED should receive goes
// to an outbox; a sender delivers it. Until real access exists, the sender talks to a local stub
// (mode STUB), so the flow and the statuses are real and only the far end is simulated.

export const DimedSyncStatus = z.enum(["PENDING", "SENT", "FAILED"]);
export type DimedSyncStatus = z.infer<typeof DimedSyncStatus>;

export const DimedRecordType = z.enum(["PATIENT", "VISIT", "ATTACHMENT", "REFERRAL"]);
export type DimedRecordType = z.infer<typeof DimedRecordType>;

export const DimedOutboxItem = z.object({
  id: Uuid,
  patientId: Uuid,
  recordType: DimedRecordType,
  /** Id of the record: patient, measurement submission, attachment or referral. */
  recordId: z.string().min(1),
  status: DimedSyncStatus,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: IsoDateTime,
  sentAt: IsoDateTime.nullable(),
});
export type DimedOutboxItem = z.infer<typeof DimedOutboxItem>;

export const DimedStatusResponse = z.object({
  mode: z.enum(["OFF", "STUB", "LIVE"]),
  /** Newest first. */
  items: z.array(DimedOutboxItem),
});
export type DimedStatusResponse = z.infer<typeof DimedStatusResponse>;
