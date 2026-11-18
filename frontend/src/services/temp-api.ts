import {
  SIGNAL_ESCALATION_MINUTES,
  signalInstruction,
  type Attachment,
  type AttachmentKind,
  type CreateReferralRequest,
  type CurrentUser,
  type PatientSignal,
  type Referral,
  type ReferralActionRequest,
  type ReferralListQuery,
  type SendSignalResponse,
  type SignalKind,
  type SignalLinkResponse,
  type SignalListQuery,
  type SignalStatus,
  type UserRef,
} from "@ona-bola/shared";
import { ApiError } from "./api";

/*
 * TEMP(api): stand-in for the endpoints participant 1 has not shipped yet: referrals, attachments
 * and patient signals (shared/src/api.ts, TEAM_PLAN items 3, 6, 7). queries.ts calls the real
 * endpoint first and falls back to this file only when the server answers "No route for ...".
 * When the real API is live this whole file can be deleted, with the `orTemp` calls in queries.ts.
 *
 * Referrals and signals are kept in localStorage, so two tabs of one browser share them (the doctor
 * tab and the patient's /signal tab): the 5-second polling of the lists picks changes up. Files are
 * kept in memory only, so uploaded documents are gone after a reload.
 */

interface TempDb {
  referrals: Referral[];
  signals: PatientSignal[];
  codes: Record<string, { patientId: string; reference: string; expiresAt: string }>;
  tokens: Record<string, { patientId: string; reference: string }>;
  linked: Record<string, string>; // patient id -> time the web page was linked
}

const KEY = "ona-bola.temp-db";
let memory: TempDb = { referrals: [], signals: [], codes: {}, tokens: {}, linked: {} };

function read(): TempDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = { ...memory, ...(JSON.parse(raw) as Partial<TempDb>) };
  } catch {
    // Storage blocked or damaged: keep working from memory.
  }
  return memory;
}

function write(db: TempDb): void {
  memory = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Not persisted; the page still works for this session.
  }
}

const now = () => new Date().toISOString();
const ref = (u: CurrentUser): UserRef => ({ id: u.id, displayName: u.displayName, role: u.role });

// ---------- referrals ----------

export const tempReferrals = {
  list(query: ReferralListQuery, me: CurrentUser): Referral[] {
    return read()
      .referrals.filter((r) => {
        // A consultant without a specialty (the alert recipient in the demo data) sees them all.
        const incoming =
          r.toUser?.id === me.id ||
          (me.specialty ? r.toSpecialty === me.specialty : me.role === "SPECIALIST");
        const outgoing = r.fromUser.id === me.id;
        const visible = me.role === "MANAGER" || incoming || outgoing;
        const inBox =
          query.box === "incoming" ? incoming : query.box === "outgoing" ? outgoing : visible;
        return (
          visible &&
          inBox &&
          (!query.status || r.status === query.status) &&
          (!query.patientId || r.patientId === query.patientId)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  create(
    patientId: string,
    patientReference: string,
    body: CreateReferralRequest,
    me: CurrentUser,
  ): Referral {
    const db = read();
    const created: Referral = {
      id: crypto.randomUUID(),
      patientId,
      patientReference,
      fromUser: ref(me),
      toSpecialty: body.toSpecialty,
      toUser: null,
      reason: body.reason,
      urgency: body.urgency,
      status: "SENT",
      conclusion: null,
      conclusionAttachmentIds: [],
      createdAt: now(),
      acceptedAt: null,
      concludedAt: null,
      closedAt: null,
    };
    write({ ...db, referrals: [created, ...db.referrals] });
    return created;
  },

  act(id: string, body: ReferralActionRequest, me: CurrentUser): Referral {
    const db = read();
    const current = db.referrals.find((r) => r.id === id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Referral not found");
    const at = now();
    let next: Referral;
    if (body.action === "ACCEPT" && current.status === "SENT") {
      next = { ...current, status: "ACCEPTED", toUser: ref(me), acceptedAt: at };
    } else if (body.action === "CONCLUDE" && ["SENT", "ACCEPTED"].includes(current.status)) {
      next = {
        ...current,
        status: "CONCLUDED",
        toUser: current.toUser ?? ref(me),
        acceptedAt: current.acceptedAt ?? at,
        conclusion: body.conclusion,
        conclusionAttachmentIds: body.attachmentIds,
        concludedAt: at,
      };
    } else if (body.action === "CLOSE" && current.status === "CONCLUDED") {
      next = { ...current, status: "CLOSED", closedAt: at };
    } else if (body.action === "CANCEL" && ["SENT", "ACCEPTED"].includes(current.status)) {
      next = { ...current, status: "CANCELLED", closedAt: at };
    } else {
      throw new ApiError(409, "CONFLICT", "That action is not possible in this status");
    }
    write({ ...db, referrals: db.referrals.map((r) => (r.id === id ? next : r)) });
    return next;
  },
};

// ---------- attachments (in memory) ----------

interface StoredFile {
  attachment: Attachment;
  url: string;
  uploadedAtMs: number;
}
const files: StoredFile[] = [];

export const tempAttachments = {
  list(patientId: string): Attachment[] {
    return files
      .filter((f) => f.attachment.patientId === patientId)
      .map((f) => ({
        ...f.attachment,
        // Pretend the DIMED stub takes a few seconds to deliver.
        dimedStatus: Date.now() - f.uploadedAtMs > 4000 ? ("SENT" as const) : ("PENDING" as const),
      }))
      .reverse();
  },

  upload(
    patientId: string,
    file: File,
    fields: { kind: AttachmentKind; description?: string | undefined },
    me: CurrentUser,
  ): Attachment {
    const isDicom = /\.dcm$/i.test(file.name);
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      patientId,
      kind: fields.kind,
      fileName: file.name,
      contentType: isDicom ? "application/dicom" : (file.type as Attachment["contentType"]),
      sizeBytes: Math.max(file.size, 1),
      description: fields.description?.trim() || null,
      referralId: null,
      uploadedBy: ref(me),
      uploadedAt: now(),
    };
    files.push({ attachment, url: URL.createObjectURL(file), uploadedAtMs: Date.now() });
    return attachment;
  },

  /** Object URL of a file uploaded in this session; undefined for files the real server holds. */
  urlFor: (id: string): string | undefined => files.find((f) => f.attachment.id === id)?.url,
};

// ---------- patient signals ----------

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L, same as the contract
const randomFrom = (alphabet: string, length: number) =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (b) => alphabet[b % alphabet.length],
  ).join("");

export const tempSignals = {
  list(query: SignalListQuery): PatientSignal[] {
    const limit = Date.now() - SIGNAL_ESCALATION_MINUTES * 60_000;
    return read()
      .signals.map((s) => ({
        ...s,
        escalated: s.status === "NEW" && new Date(s.createdAt).getTime() < limit,
      }))
      .filter(
        (s) =>
          (!query.status || s.status === query.status) &&
          (!query.patientId || s.patientId === query.patientId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  handle(id: string, status: Exclude<SignalStatus, "NEW">, me: CurrentUser): PatientSignal {
    const db = read();
    const current = db.signals.find((s) => s.id === id);
    if (!current) throw new ApiError(404, "NOT_FOUND", "Signal not found");
    const next: PatientSignal = { ...current, status, handledBy: ref(me), handledAt: now() };
    write({ ...db, signals: db.signals.map((s) => (s.id === id ? next : s)) });
    return next;
  },

  issueLink(patientId: string, patientReference: string): SignalLinkResponse {
    const db = read();
    const code = randomFrom(CODE_ALPHABET, 8);
    const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    write({
      ...db,
      codes: { ...db.codes, [code]: { patientId, reference: patientReference, expiresAt } },
    });
    return { code, expiresAt, telegramUrl: null, webPath: `/signal?code=${code}` };
  },

  isLinked: (patientId: string): boolean => patientId in read().linked,

  redeem(code: string): { token: string } {
    const db = read();
    const key = code.toUpperCase();
    const entry = db.codes[key];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      throw new ApiError(400, "VALIDATION_FAILED", "Code is wrong or expired");
    }
    const token = randomFrom("abcdefghijklmnopqrstuvwxyz0123456789", 40);
    const codes = Object.fromEntries(Object.entries(db.codes).filter(([k]) => k !== key));
    write({
      ...db,
      codes,
      tokens: { ...db.tokens, [token]: { patientId: entry.patientId, reference: entry.reference } },
      linked: { ...db.linked, [entry.patientId]: now() },
    });
    return { token };
  },

  send(token: string, kind: SignalKind): SendSignalResponse {
    const db = read();
    const entry = db.tokens[token];
    if (!entry) throw new ApiError(401, "ACTOR_REQUIRED", "This device is not connected");
    const receivedAt = now();
    const signal: PatientSignal = {
      id: crypto.randomUUID(),
      patientId: entry.patientId,
      patientReference: entry.reference,
      kind,
      channel: "WEB",
      status: "NEW",
      createdAt: receivedAt,
      escalated: false,
      handledBy: null,
      handledAt: null,
    };
    write({ ...db, signals: [signal, ...db.signals] });
    return { instruction: signalInstruction(kind), receivedAt };
  },
};
