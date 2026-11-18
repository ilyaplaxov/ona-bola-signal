import { z } from "zod";
import { IsoDateTime, Language, Uuid } from "./common";
import { DimedSyncStatus } from "./dimed";
import { MeasurementReading } from "./measurement";
import { PregnancyDating } from "./pregnancy";
import { UserRef } from "./user";

// Files attached to a patient: ultrasound and specialist reports, lab sheets, MRI (mentor items 5–7).
// Upload is multipart/form-data, so it is described here, not in the JSON endpoint catalogue.

export const AttachmentKind = z.enum([
  "ULTRASOUND",
  "SPECIALIST_CONCLUSION",
  "LAB_RESULTS",
  "MRI",
  "OTHER",
]);
export type AttachmentKind = z.infer<typeof AttachmentKind>;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Accepted file types. MRI comes as DICOM; it is stored and downloadable, not rendered. */
export const ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/dicom",
] as const;
export const AttachmentContentType = z.enum(ATTACHMENT_CONTENT_TYPES);
export type AttachmentContentType = z.infer<typeof AttachmentContentType>;

export const Attachment = z.object({
  id: Uuid,
  patientId: Uuid,
  kind: AttachmentKind,
  /** Original file name, shown to clinicians; never written to the audit log. */
  fileName: z.string().min(1),
  contentType: AttachmentContentType,
  sizeBytes: z.number().int().positive(),
  description: z.string().nullable(),
  /** Set when the file belongs to a referral (for example the consultant's conclusion). */
  referralId: Uuid.nullable(),
  uploadedBy: UserRef,
  uploadedAt: IsoDateTime,
  /** Delivery to DIMED; absent when the integration is off. */
  dimedStatus: DimedSyncStatus.optional(),
});
export type Attachment = z.infer<typeof Attachment>;

/**
 * POST /api/patients/:id/attachments, multipart/form-data:
 * - `file`: the file (≤ ATTACHMENT_MAX_BYTES, one of ATTACHMENT_CONTENT_TYPES);
 * - the text fields below.
 * Response: Attachment (201). Too large: 413 VALIDATION_FAILED. Wrong type: 415 VALIDATION_FAILED.
 */
export const UploadAttachmentFields = z.object({
  kind: AttachmentKind,
  description: z.string().trim().max(500).optional(),
  referralId: Uuid.optional(),
});
export type UploadAttachmentFields = z.infer<typeof UploadAttachmentFields>;

export const AttachmentListResponse = z.object({
  /** Newest first. */
  items: z.array(Attachment),
});
export type AttachmentListResponse = z.infer<typeof AttachmentListResponse>;

/** GET path of the file itself (inline for PDF and images, download otherwise). */
export const attachmentFilePath = (attachmentId: string) =>
  `/api/attachments/${attachmentId}/file` as const;

export const AnalyzeDocumentRequest = z.object({ language: Language.default("uz") });
export type AnalyzeDocumentRequest = z.infer<typeof AnalyzeDocumentRequest>;

/** Claude reads a PDF or image report and drafts values for the clinician to confirm. Nothing is saved. */
export const AnalyzeDocumentResponse = z.object({
  draft: z.object({
    /** When the measurements were taken, if the report says so. */
    measuredAt: IsoDateTime.nullable(),
    measurements: z.array(MeasurementReading),
  }),
  /** From an ultrasound report: scan date and gestational age, for the patient's dating. */
  dating: PregnancyDating.nullable(),
  warnings: z.array(z.string()),
  model: z.string().min(1),
});
export type AnalyzeDocumentResponse = z.infer<typeof AnalyzeDocumentResponse>;
