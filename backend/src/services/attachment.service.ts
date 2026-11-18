import type { Attachment, AttachmentContentType, UploadAttachmentFields } from "@ona-bola/shared";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { attachments, referrals, users } from "../db/schema";
import { HttpError } from "../http-error";
import { recordAudit } from "./audit.service";
import type { ActorContext } from "./auth.service";

// Patient files (mentor items 5–7). The type is decided from the file's first bytes, not from what
// the browser says. Files are stored under a random key; the original name stays in the database
// for clinicians and never reaches the audit log or the disk.

/** Detects the accepted formats by their signatures; null for anything else. */
export function sniffContentType(bytes: Buffer): AttachmentContentType | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 132 && bytes.subarray(128, 132).toString("latin1") === "DICM") {
    return "application/dicom";
  }
  return null;
}

/** Keeps a readable file name: no folders, no control characters, at most 200 characters. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "file").slice(0, 200);
}

const uploaderColumns = { id: users.id, displayName: users.displayName, role: users.role };

function toAttachment(
  row: typeof attachments.$inferSelect,
  uploader: Attachment["uploadedBy"],
): Attachment {
  return {
    id: row.id,
    patientId: row.patientId,
    kind: row.kind,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    description: row.description,
    referralId: row.referralId,
    uploadedBy: uploader,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export interface AttachmentStore {
  dir: string;
}

export async function saveAttachment(
  db: Database,
  store: AttachmentStore,
  args: {
    patientId: string;
    fields: UploadAttachmentFields;
    file: { originalName: string; bytes: Buffer };
    actor: ActorContext;
    now: Date;
  },
): Promise<Attachment> {
  const { patientId, fields, file, actor, now } = args;
  const contentType = sniffContentType(file.bytes);
  if (!contentType) {
    throw new HttpError(415, "VALIDATION_FAILED", "Only PDF, JPEG, PNG and DICOM files", [
      { path: "file", message: "Unsupported file type" },
    ]);
  }
  if (fields.referralId) {
    const [r] = await db
      .select({ patientId: referrals.patientId })
      .from(referrals)
      .where(eq(referrals.id, fields.referralId))
      .limit(1);
    if (!r || r.patientId !== patientId) {
      throw new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [
        { path: "referralId", message: "Not a referral of this patient" },
      ]);
    }
  }

  const storageKey = randomUUID();
  const target = path.join(store.dir, storageKey);
  await mkdir(store.dir, { recursive: true });
  await writeFile(target, file.bytes, { flag: "wx" });
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(attachments)
        .values({
          patientId,
          kind: fields.kind,
          fileName: cleanFileName(file.originalName),
          contentType,
          sizeBytes: file.bytes.length,
          sha256: createHash("sha256").update(file.bytes).digest("hex"),
          storageKey,
          description: fields.description || null,
          referralId: fields.referralId ?? null,
          uploadedBy: actor.id,
          uploadedAt: now,
        })
        .returning({ id: attachments.id });
      if (!row) throw new Error("Attachment insert returned no row");
      await recordAudit(tx, {
        actorUserId: actor.id,
        action: "ATTACHMENT_UPLOADED",
        entityType: "ATTACHMENT",
        entityId: row.id,
        patientId,
        metadata: {
          kind: fields.kind,
          contentType,
          sizeBytes: file.bytes.length,
          forReferral: Boolean(fields.referralId),
        },
        createdAt: now,
      });
      return row.id;
    });
    return getAttachment(db, id);
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}

export async function getAttachment(db: DbExecutor, id: string): Promise<Attachment> {
  const [row] = await db
    .select({ attachment: attachments, uploader: uploaderColumns })
    .from(attachments)
    .innerJoin(users, eq(users.id, attachments.uploadedBy))
    .where(eq(attachments.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Attachment not found");
  return toAttachment(row.attachment, row.uploader);
}

export async function listAttachments(db: DbExecutor, patientId: string): Promise<Attachment[]> {
  const rows = await db
    .select({ attachment: attachments, uploader: uploaderColumns })
    .from(attachments)
    .innerJoin(users, eq(users.id, attachments.uploadedBy))
    .where(eq(attachments.patientId, patientId))
    .orderBy(desc(attachments.uploadedAt), desc(attachments.id));
  return rows.map((r) => toAttachment(r.attachment, r.uploader));
}

/** The stored bytes and what to send them as. */
export async function readAttachmentFile(
  db: DbExecutor,
  store: AttachmentStore,
  id: string,
): Promise<{ meta: Attachment; bytes: Buffer }> {
  const [row] = await db
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Attachment not found");
  const meta = await getAttachment(db, id);
  try {
    return { meta, bytes: await readFile(path.join(store.dir, row.storageKey)) };
  } catch {
    throw new HttpError(404, "NOT_FOUND", "The file is missing from storage");
  }
}

/** For referral conclusions: every id must be a file of this patient. */
export async function assertAttachmentsOfPatient(
  db: DbExecutor,
  patientId: string,
  ids: string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  const rows = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.patientId, patientId), inArray(attachments.id, unique)));
  if (rows.length !== unique.length) {
    throw new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [
      { path: "attachmentIds", message: "Every file must belong to this patient" },
    ]);
  }
}
