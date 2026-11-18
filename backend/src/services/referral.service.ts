import type {
  CreateReferralRequest,
  Referral,
  ReferralActionRequest,
  ReferralListQuery,
  ReferralStatus,
} from "@ona-bola/shared";
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database, DbExecutor } from "../db/client";
import { patients, referrals, users } from "../db/schema";
import { HttpError } from "../http-error";
import { visiblePatients } from "./access";
import { recordAudit } from "./audit.service";
import type { ActorContext } from "./auth.service";

// Referral to a consultant (mentor item 3). The reason and the conclusion stay in the referrals
// table; the audit log records only the specialty, urgency, action and new status.

/** Statuses in which the consultant still works with the patient (and so may see her). */
export const OPEN_REFERRAL_STATUSES: ReferralStatus[] = ["SENT", "ACCEPTED", "CONCLUDED"];

const fromUser = alias(users, "from_user");
const toUser = alias(users, "to_user");

const columns = {
  referral: referrals,
  patientReference: patients.externalReference,
  from: { id: fromUser.id, displayName: fromUser.displayName, role: fromUser.role },
  to: { id: toUser.id, displayName: toUser.displayName, role: toUser.role },
};

type Row = {
  referral: typeof referrals.$inferSelect;
  patientReference: string;
  from: { id: string; displayName: string; role: Referral["fromUser"]["role"] };
  to: { id: string; displayName: string; role: Referral["fromUser"]["role"] } | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toReferral(row: Row): Referral {
  const r = row.referral;
  return {
    id: r.id,
    patientId: r.patientId,
    patientReference: row.patientReference,
    fromUser: row.from,
    toSpecialty: r.toSpecialty,
    toUser: row.to,
    reason: r.reason,
    urgency: r.urgency,
    status: r.status,
    conclusion: r.conclusion,
    conclusionAttachmentIds: r.conclusionAttachmentIds,
    createdAt: r.createdAt.toISOString(),
    acceptedAt: iso(r.acceptedAt),
    concludedAt: iso(r.concludedAt),
    closedAt: iso(r.closedAt),
  };
}

function selectReferrals(db: DbExecutor) {
  return db
    .select(columns)
    .from(referrals)
    .innerJoin(patients, eq(patients.id, referrals.patientId))
    .innerJoin(fromUser, eq(fromUser.id, referrals.fromUserId))
    .leftJoin(toUser, eq(toUser.id, referrals.toUserId));
}

async function getReferral(db: DbExecutor, id: string): Promise<Referral> {
  const [row] = await selectReferrals(db).where(eq(referrals.id, id)).limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Referral not found");
  return toReferral(row);
}

/** Addressed to this consultant: by name, or to her specialty while nobody has taken it. */
function addressedTo(actor: ActorContext): SQL | undefined {
  const byName = eq(referrals.toUserId, actor.id);
  if (!actor.specialty) return byName;
  return or(byName, and(isNull(referrals.toUserId), eq(referrals.toSpecialty, actor.specialty)));
}

export async function createReferral(
  db: Database,
  args: { patientId: string; request: CreateReferralRequest; actor: ActorContext; now: Date },
): Promise<Referral> {
  const { patientId, request, actor, now } = args;
  if (request.toUserId) {
    const [target] = await db
      .select({ role: users.role, specialty: users.specialty })
      .from(users)
      .where(eq(users.id, request.toUserId))
      .limit(1);
    if (!target || target.role !== "SPECIALIST" || target.specialty !== request.toSpecialty) {
      throw new HttpError(400, "VALIDATION_FAILED", "Request validation failed", [
        { path: "toUserId", message: "Not a consultant of this specialty" },
      ]);
    }
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(referrals)
      .values({
        patientId,
        fromUserId: actor.id,
        toSpecialty: request.toSpecialty,
        toUserId: request.toUserId ?? null,
        reason: request.reason,
        urgency: request.urgency,
        status: "SENT",
        createdAt: now,
      })
      .returning({ id: referrals.id });
    if (!row) throw new Error("Referral insert returned no row");
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "REFERRAL_CREATED",
      entityType: "REFERRAL",
      entityId: row.id,
      patientId,
      metadata: { toSpecialty: request.toSpecialty, urgency: request.urgency },
      createdAt: now,
    });
    return row.id;
  });
  return getReferral(db, id);
}

export async function listReferrals(
  db: DbExecutor,
  query: ReferralListQuery,
  actor: ActorContext | null,
): Promise<Referral[]> {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(referrals.status, query.status));
  if (query.patientId) filters.push(eq(referrals.patientId, query.patientId));
  if (query.box === "incoming") {
    if (!actor) throw new HttpError(401, "ACTOR_REQUIRED", "Sign in first");
    const mine = addressedTo(actor);
    if (mine) filters.push(mine);
  } else if (query.box === "outgoing") {
    if (!actor) throw new HttpError(401, "ACTOR_REQUIRED", "Sign in first");
    filters.push(eq(referrals.fromUserId, actor.id));
  } else {
    const visible = visiblePatients(actor);
    if (visible) filters.push(visible);
  }
  const rows = await selectReferrals(db)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      sql`case when ${referrals.urgency} = 'URGENT' and ${referrals.status} = 'SENT' then 0 else 1 end`,
      desc(referrals.createdAt),
    )
    .limit(200);
  return rows.map(toReferral);
}

/** Referrals waiting for this consultant to accept (for the dashboard badge). */
export async function countIncoming(db: DbExecutor, actor: ActorContext): Promise<number> {
  const mine = addressedTo(actor);
  const [row] = await db
    .select({ n: sql`count(*)`.mapWith(Number) })
    .from(referrals)
    .where(and(eq(referrals.status, "SENT"), mine));
  return row?.n ?? 0;
}

/** Open referrals per patient, for the patient card. */
export async function countOpenForPatient(db: DbExecutor, patientId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql`count(*)`.mapWith(Number) })
    .from(referrals)
    .where(
      and(eq(referrals.patientId, patientId), inArray(referrals.status, ["SENT", "ACCEPTED"])),
    );
  return row?.n ?? 0;
}

const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
const forbidden = (message: string) => new HttpError(403, "FORBIDDEN", message);

/**
 * One step of the referral's life:
 * - ACCEPT, CONCLUDE: the consultant it is addressed to (CONCLUDE also accepts a SENT referral);
 * - CLOSE (after the conclusion), CANCEL (before it): the doctor who wrote it.
 * A step that does not fit the current status is a 409.
 */
export async function actOnReferral(
  db: Database,
  args: {
    referralId: string;
    request: ReferralActionRequest;
    actor: ActorContext;
    now: Date;
    /** Checks that the attached files belong to the patient (attachments are in their own module). */
    checkAttachments?: (tx: DbExecutor, patientId: string, ids: string[]) => Promise<void>;
  },
): Promise<Referral> {
  const { referralId, request, actor, now } = args;
  await db.transaction(async (tx) => {
    const [r] = await tx
      .select()
      .from(referrals)
      .where(eq(referrals.id, referralId))
      .for("update")
      .limit(1);
    if (!r) throw new HttpError(404, "NOT_FOUND", "Referral not found");

    const isAddressee =
      r.toUserId === actor.id || (r.toUserId === null && r.toSpecialty === actor.specialty);
    const isAuthor = r.fromUserId === actor.id;
    let changes: Partial<typeof referrals.$inferInsert>;

    switch (request.action) {
      case "ACCEPT":
        if (actor.role !== "SPECIALIST" || !isAddressee)
          throw forbidden("This referral is not addressed to you");
        if (r.status !== "SENT") throw conflict(`The referral is already ${r.status}`);
        changes = { status: "ACCEPTED", toUserId: actor.id, acceptedAt: now };
        break;
      case "CONCLUDE":
        if (actor.role !== "SPECIALIST" || !isAddressee)
          throw forbidden("This referral is not addressed to you");
        if (r.status !== "SENT" && r.status !== "ACCEPTED") {
          throw conflict(`The referral is already ${r.status}`);
        }
        if (request.attachmentIds.length > 0) {
          await args.checkAttachments?.(tx, r.patientId, request.attachmentIds);
        }
        changes = {
          status: "CONCLUDED",
          toUserId: actor.id,
          acceptedAt: r.acceptedAt ?? now,
          conclusion: request.conclusion,
          conclusionAttachmentIds: request.attachmentIds,
          concludedAt: now,
        };
        break;
      case "CLOSE":
        if (!isAuthor) throw forbidden("Only the doctor who wrote the referral can close it");
        if (r.status !== "CONCLUDED") throw conflict("Close a referral after the conclusion");
        changes = { status: "CLOSED", closedAt: now };
        break;
      case "CANCEL":
        if (!isAuthor) throw forbidden("Only the doctor who wrote the referral can cancel it");
        if (r.status !== "SENT" && r.status !== "ACCEPTED") {
          throw conflict(`A ${r.status} referral cannot be cancelled`);
        }
        changes = { status: "CANCELLED", closedAt: now };
        break;
    }

    await tx.update(referrals).set(changes).where(eq(referrals.id, referralId));
    await recordAudit(tx, {
      actorUserId: actor.id,
      action: "REFERRAL_UPDATED",
      entityType: "REFERRAL",
      entityId: referralId,
      patientId: r.patientId,
      metadata: {
        action: request.action,
        status: changes.status,
        ...(request.action === "CONCLUDE" ? { attachments: request.attachmentIds.length } : {}),
      },
      createdAt: now,
    });
  });
  return getReferral(db, referralId);
}
