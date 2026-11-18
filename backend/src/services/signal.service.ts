import {
  SIGNAL_ESCALATION_MINUTES,
  signalInstruction,
  type HandleSignalRequest,
  type Language,
  type PatientSignal,
  type SignalChannel,
  type SignalInstruction,
  type SignalKind,
  type SignalLinkResponse,
  type SignalLinkState,
  type SignalListQuery,
} from "@ona-bola/shared";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { patientSignals, patients, signalBindings, signalLinkCodes, users } from "../db/schema";
import { HttpError } from "../http-error";
import { recordAudit } from "./audit.service";
import type { ActorContext } from "./auth.service";

// A pregnant woman signals her polyclinic herself (TEAM_PLAN section 2a). The clinician issues a
// one-time code; the patient redeems it in the Telegram bot or on the /signal page and agrees to
// the terms; afterwards each button press becomes a signal for her doctor and nurse.
// Signals never change the zone: the clinician confirms a sign at a visit, then the engine decides.

export const LINK_CODE_HOURS = 24;
/** Abuse limits, not clinical rules. */
export const SIGNALS_PER_HOUR = 10;
export const DUPLICATE_WINDOW_MINUTES = 5;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function newLinkCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Issues a fresh code; earlier unused codes of this patient stop working. */
export async function issueLinkCode(
  db: Database,
  args: { patientId: string; actor: ActorContext; now: Date; botUsername: string | null },
): Promise<SignalLinkResponse> {
  const { patientId, actor, now } = args;
  const code = newLinkCode();
  const expiresAt = new Date(now.getTime() + LINK_CODE_HOURS * 3_600_000);
  await db.transaction(async (tx) => {
    await tx
      .update(signalLinkCodes)
      .set({ expiresAt: now })
      .where(
        and(
          eq(signalLinkCodes.patientId, patientId),
          isNull(signalLinkCodes.usedAt),
          gt(signalLinkCodes.expiresAt, now),
        ),
      );
    await tx.insert(signalLinkCodes).values({
      patientId,
      codeHash: sha256(code),
      issuedBy: actor.id,
      createdAt: now,
      expiresAt,
    });
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "SIGNAL_LINK_ISSUED",
      entityType: "PATIENT",
      entityId: patientId,
      patientId,
      metadata: { hours: LINK_CODE_HOURS },
      createdAt: now,
    });
  });
  return {
    code,
    expiresAt: expiresAt.toISOString(),
    telegramUrl: args.botUsername ? `https://t.me/${args.botUsername}?start=${code}` : null,
    webPath: `/signal?code=${code}`,
  };
}

export interface Binding {
  id: string;
  patientId: string;
  channel: SignalChannel;
  language: Language;
}

/**
 * Redeems a code for a Telegram chat or a web page. Returns null for an unknown, used or expired
 * code. A Telegram chat holds one patient: linking it again moves it to the new patient.
 */
export async function redeemLinkCode(
  db: Database,
  args: {
    code: string;
    channel: SignalChannel;
    telegramChatId?: string;
    language: Language;
    now: Date;
  },
): Promise<{ binding: Binding; webToken: string | null } | null> {
  const { code, channel, language, now } = args;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(signalLinkCodes)
      .where(eq(signalLinkCodes.codeHash, sha256(code)))
      .for("update")
      .limit(1);
    if (!row || row.usedAt || row.expiresAt <= now) return null;
    await tx.update(signalLinkCodes).set({ usedAt: now }).where(eq(signalLinkCodes.id, row.id));

    if (channel === "TELEGRAM" && args.telegramChatId) {
      await tx
        .update(signalBindings)
        .set({ revokedAt: now })
        .where(
          and(
            eq(signalBindings.telegramChatId, args.telegramChatId),
            isNull(signalBindings.revokedAt),
          ),
        );
    }
    const webToken = channel === "WEB" ? randomBytes(32).toString("base64url") : null;
    const [binding] = await tx
      .insert(signalBindings)
      .values({
        patientId: row.patientId,
        channel,
        telegramChatId: channel === "TELEGRAM" ? (args.telegramChatId ?? null) : null,
        webTokenHash: webToken ? sha256(webToken) : null,
        language,
        consentedAt: now,
        createdAt: now,
      })
      .returning();
    if (!binding) throw new Error("Binding insert returned no row");
    await recordAudit(tx, {
      actorUserId: null,
      action: "SIGNAL_LINKED",
      entityType: "PATIENT",
      entityId: row.patientId,
      patientId: row.patientId,
      metadata: { channel },
      createdAt: now,
    });
    return {
      binding: { id: binding.id, patientId: binding.patientId, channel, language },
      webToken,
    };
  });
}

const bindingColumns = {
  id: signalBindings.id,
  patientId: signalBindings.patientId,
  channel: signalBindings.channel,
  language: signalBindings.language,
};

export async function bindingForChat(db: DbExecutor, chatId: string): Promise<Binding | null> {
  const [row] = await db
    .select(bindingColumns)
    .from(signalBindings)
    .where(and(eq(signalBindings.telegramChatId, chatId), isNull(signalBindings.revokedAt)))
    .orderBy(desc(signalBindings.createdAt))
    .limit(1);
  return row ?? null;
}

export async function bindingForWebToken(db: DbExecutor, token: string): Promise<Binding | null> {
  const [row] = await db
    .select(bindingColumns)
    .from(signalBindings)
    .where(and(eq(signalBindings.webTokenHash, sha256(token)), isNull(signalBindings.revokedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Her own name and her doctor's, for the bot's greeting. Shown only in a chat she linked with the
 * code and agreed in; never a zone, diagnosis or lab value. Doctor: the assigned one, else whoever
 * issued her latest code.
 */
export async function bindingNames(
  db: DbExecutor,
  patientId: string,
): Promise<{ patientName: string; doctorName: string | null }> {
  const [row] = await db
    .select({ patientName: patients.displayName, doctorName: users.displayName })
    .from(patients)
    .leftJoin(users, eq(users.id, patients.assignedUserId))
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!row) return { patientName: "", doctorName: null };
  if (row.doctorName) return { patientName: row.patientName, doctorName: row.doctorName };
  const [issuer] = await db
    .select({ name: users.displayName })
    .from(signalLinkCodes)
    .innerJoin(users, eq(users.id, signalLinkCodes.issuedBy))
    .where(eq(signalLinkCodes.patientId, patientId))
    .orderBy(desc(signalLinkCodes.createdAt))
    .limit(1);
  return { patientName: row.patientName, doctorName: issuer?.name ?? null };
}

/** The patient withdraws: the chat or device stops signalling for her. */
export async function revokeBinding(db: Database, binding: Binding, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(signalBindings)
      .set({ revokedAt: now })
      .where(and(eq(signalBindings.id, binding.id), isNull(signalBindings.revokedAt)));
    await recordAudit(tx, {
      actorUserId: null,
      action: "SIGNAL_UNLINKED",
      entityType: "PATIENT",
      entityId: binding.patientId,
      patientId: binding.patientId,
      metadata: { channel: binding.channel },
      createdAt: now,
    });
  });
}

export async function setBindingLanguage(
  db: DbExecutor,
  bindingId: string,
  language: Language,
): Promise<void> {
  await db.update(signalBindings).set({ language }).where(eq(signalBindings.id, bindingId));
}

export class TooManySignalsError extends HttpError {
  constructor() {
    super(429, "RATE_LIMITED", "Too many signals from this device; call 103 if it is urgent");
  }
}

/**
 * Records a button press. The same button pressed again within a few minutes is the same signal
 * (no duplicate row); more than SIGNALS_PER_HOUR from one device is refused.
 */
export async function receiveSignal(
  db: Database,
  args: { binding: Binding; kind: SignalKind; now: Date },
): Promise<{ instruction: SignalInstruction; signalId: string; duplicate: boolean }> {
  const { binding, kind, now } = args;
  const instruction = signalInstruction(kind);
  return db.transaction(async (tx) => {
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const recent = await tx
      .select({
        id: patientSignals.id,
        kind: patientSignals.kind,
        createdAt: patientSignals.createdAt,
      })
      .from(patientSignals)
      .where(and(eq(patientSignals.bindingId, binding.id), gte(patientSignals.createdAt, hourAgo)))
      .orderBy(desc(patientSignals.createdAt));
    const windowStart = now.getTime() - DUPLICATE_WINDOW_MINUTES * 60_000;
    const same = recent.find((r) => r.kind === kind && r.createdAt.getTime() >= windowStart);
    if (same) return { instruction, signalId: same.id, duplicate: true };
    if (recent.length >= SIGNALS_PER_HOUR) throw new TooManySignalsError();

    const [row] = await tx
      .insert(patientSignals)
      .values({
        patientId: binding.patientId,
        bindingId: binding.id,
        kind,
        channel: binding.channel,
        status: "NEW",
        createdAt: now,
      })
      .returning({ id: patientSignals.id });
    if (!row) throw new Error("Signal insert returned no row");
    await recordAudit(tx, {
      actorUserId: null,
      action: "SIGNAL_RECEIVED",
      entityType: "PATIENT_SIGNAL",
      entityId: row.id,
      patientId: binding.patientId,
      metadata: { kind, channel: binding.channel },
      createdAt: now,
    });
    return { instruction, signalId: row.id, duplicate: false };
  });
}

const escalationCutoff = (now: Date) =>
  new Date(now.getTime() - SIGNAL_ESCALATION_MINUTES * 60_000);

export async function listSignals(
  db: DbExecutor,
  query: SignalListQuery & { id?: string },
  visibility: SQL | undefined,
  now: Date,
): Promise<PatientSignal[]> {
  const filters: SQL[] = [];
  if (visibility) filters.push(visibility);
  if (query.status) filters.push(eq(patientSignals.status, query.status));
  if (query.patientId) filters.push(eq(patientSignals.patientId, query.patientId));
  if (query.id) filters.push(eq(patientSignals.id, query.id));
  const rows = await db
    .select({
      signal: patientSignals,
      patientReference: patients.externalReference,
      handler: { id: users.id, displayName: users.displayName, role: users.role },
    })
    .from(patientSignals)
    .innerJoin(patients, eq(patients.id, patientSignals.patientId))
    .leftJoin(users, eq(users.id, patientSignals.handledBy))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      sql`case when ${patientSignals.status} = 'NEW' then 0 else 1 end`,
      desc(patientSignals.createdAt),
    )
    .limit(200);
  const cutoff = escalationCutoff(now);
  return rows.map(({ signal, patientReference, handler }) => ({
    id: signal.id,
    patientId: signal.patientId,
    patientReference,
    kind: signal.kind,
    channel: signal.channel,
    status: signal.status,
    createdAt: signal.createdAt.toISOString(),
    escalated: signal.status === "NEW" && signal.createdAt <= cutoff,
    handledBy: handler,
    handledAt: signal.handledAt ? signal.handledAt.toISOString() : null,
  }));
}

export async function handleSignal(
  db: Database,
  args: { signalId: string; request: HandleSignalRequest; actor: ActorContext; now: Date },
): Promise<string> {
  const { signalId, request, actor, now } = args;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(patientSignals)
      .set({ status: request.status, handledBy: actor.id, handledAt: now })
      .where(eq(patientSignals.id, signalId))
      .returning({ patientId: patientSignals.patientId });
    if (!row) throw new HttpError(404, "NOT_FOUND", "Signal not found");
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "SIGNAL_HANDLED",
      entityType: "PATIENT_SIGNAL",
      entityId: signalId,
      patientId: row.patientId,
      metadata: { status: request.status },
      createdAt: now,
    });
    return row.patientId;
  });
}

/** NEW signals in scope, and how many are past the escalation time. */
export async function countNewSignals(
  db: DbExecutor,
  visibility: SQL | undefined,
  now: Date,
): Promise<{ total: number; escalated: number }> {
  const [row] = await db
    .select({
      total: sql`count(*)`.mapWith(Number),
      escalated:
        sql`count(*) filter (where ${patientSignals.createdAt} <= ${escalationCutoff(now)})`.mapWith(
          Number,
        ),
    })
    .from(patientSignals)
    .innerJoin(patients, eq(patients.id, patientSignals.patientId))
    .where(and(eq(patientSignals.status, "NEW"), visibility));
  return { total: row?.total ?? 0, escalated: row?.escalated ?? 0 };
}

export async function signalLinkState(db: DbExecutor, patientId: string): Promise<SignalLinkState> {
  const rows = await db
    .select({ channel: signalBindings.channel, createdAt: signalBindings.createdAt })
    .from(signalBindings)
    .where(and(eq(signalBindings.patientId, patientId), isNull(signalBindings.revokedAt)))
    .orderBy(desc(signalBindings.createdAt));
  return {
    telegram: rows.some((r) => r.channel === "TELEGRAM"),
    web: rows.some((r) => r.channel === "WEB"),
    linkedAt: rows[0] ? rows[0].createdAt.toISOString() : null,
  };
}

/** Housekeeping: codes that can no longer be used. */
export async function deleteStaleCodes(db: DbExecutor, now: Date): Promise<void> {
  await db
    .delete(signalLinkCodes)
    .where(lt(signalLinkCodes.expiresAt, new Date(now.getTime() - 7 * 86_400_000)));
}
