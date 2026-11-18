import {
  ATTACHMENT_MAX_BYTES,
  Attachment,
  AttachmentListResponse,
  IdParams,
  UploadAttachmentFields,
} from "@ona-bola/shared";
import { Router } from "express";
import multer from "multer";
import type { Database } from "../db/client";
import { HttpError } from "../http-error";
import { getActorContext, requireActorContext } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import { assertCan, assertPatientAccess } from "../services/access";
import {
  getAttachment,
  listAttachments,
  readAttachmentFile,
  saveAttachment,
  type AttachmentStore,
} from "../services/attachment.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1, fields: 5, fieldSize: 2_000 },
}).single("file");

/** Turns multer's errors into the API's error shape. */
const parseUpload = (req: Parameters<typeof upload>[0], res: Parameters<typeof upload>[1]) =>
  new Promise<void>((resolve, reject) => {
    upload(req, res, (error: unknown) => {
      if (!error) return resolve();
      if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? `The file is larger than ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB`
            : `Upload rejected: ${error.message}`;
        return reject(new HttpError(status, "VALIDATION_FAILED", message));
      }
      reject(error as Error);
    });
  });

/** RFC 6266 / 5987 Content-Disposition with an ASCII fallback. */
function disposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Upload, list and read a patient's files. */
export function attachmentsRouter(deps: {
  db: Database;
  clock: () => Date;
  store: AttachmentStore;
}): Router {
  const router = Router();

  router.post("/patients/:id/attachments", async (req, res) => {
    const actor = requireActorContext(res);
    assertCan(actor, "ATTACHMENT_UPLOAD");
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, actor, id);
    await parseUpload(req, res);
    if (!req.file) {
      throw new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [
        { path: "file", message: "Attach one file in the `file` field" },
      ]);
    }
    const fields = parseInput(UploadAttachmentFields, req.body ?? {});
    const attachment = await saveAttachment(deps.db, deps.store, {
      patientId: id,
      fields,
      // multer gives the name as latin1; browsers send UTF-8.
      file: {
        originalName: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
        bytes: req.file.buffer,
      },
      actor,
      now: deps.clock(),
    });
    sendJson(res, Attachment, attachment, 201);
  });

  router.get("/patients/:id/attachments", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    await assertPatientAccess(deps.db, getActorContext(res), id);
    sendJson(res, AttachmentListResponse, { items: await listAttachments(deps.db, id) });
  });

  router.get("/attachments/:id", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    const attachment = await getAttachment(deps.db, id);
    await assertPatientAccess(deps.db, getActorContext(res), attachment.patientId);
    sendJson(res, Attachment, attachment);
  });

  router.get("/attachments/:id/file", async (req, res) => {
    const { id } = parseInput(IdParams, req.params);
    const meta = await getAttachment(deps.db, id);
    await assertPatientAccess(deps.db, getActorContext(res), meta.patientId);
    const { bytes } = await readAttachmentFile(deps.db, deps.store, id);
    const inline = meta.contentType !== "application/dicom";
    res.setHeader("Content-Type", meta.contentType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader(
      "Content-Disposition",
      disposition(inline ? "inline" : "attachment", meta.fileName),
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(bytes);
  });

  return router;
}
