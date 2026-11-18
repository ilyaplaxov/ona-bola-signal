import type { CurrentUser, Specialty, UserRef, UserRole } from "@ona-bola/shared";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { sessions, users } from "../db/schema";
import { recordAudit } from "./audit.service";
import { DUMMY_HASH, verifyPassword } from "./password";

/** How long a sign-in lasts: one working shift. */
export const SESSION_HOURS = 12;

/** The signed-in user as the server needs it for access checks. */
export interface ActorContext extends UserRef {
  district: string | null;
  specialty: Specialty | null;
  facility: string | null;
  username: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const actorColumns = {
  id: users.id,
  displayName: users.displayName,
  role: users.role,
  district: users.district,
  specialty: users.specialty,
  facility: users.facility,
  username: users.username,
};

type ActorRow = {
  id: string;
  displayName: string;
  role: UserRole;
  district: string | null;
  specialty: Specialty | null;
  facility: string | null;
  username: string | null;
};

const toActor = (row: ActorRow): ActorContext => ({ ...row });

export function toCurrentUser(actor: ActorContext): CurrentUser {
  return {
    id: actor.id,
    displayName: actor.displayName,
    role: actor.role,
    district: actor.district,
    specialty: actor.specialty,
    facility: actor.facility,
    username: actor.username ?? "",
  };
}

export async function findActorById(db: DbExecutor, id: string): Promise<ActorContext | null> {
  const [row] = await db.select(actorColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ? toActor(row) : null;
}

/**
 * Checks the password and opens a session. Returns null for a wrong username or password (the
 * caller answers 401 without saying which). Both outcomes are audited; a failed attempt records
 * no username, since a mistyped one can be a person's name.
 */
export async function login(
  db: Database,
  args: { username: string; password: string; now: Date },
): Promise<{ token: string; actor: ActorContext; expiresAt: Date } | null> {
  const { username, password, now } = args;
  const [row] = await db
    .select({ ...actorColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);

  if (!row || !row.passwordHash || !ok) {
    await recordAudit(db, {
      actorUserId: null,
      action: "USER_LOGIN_FAILED",
      entityType: "USER",
      entityId: row?.id ?? "unknown",
      patientId: null,
      metadata: { knownUser: Boolean(row) },
      createdAt: now,
    });
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  await db.transaction(async (tx) => {
    // Housekeeping: drop this user's expired sessions.
    await tx.delete(sessions).where(and(eq(sessions.userId, row.id), lt(sessions.expiresAt, now)));
    await tx
      .insert(sessions)
      .values({ id: hashToken(token), userId: row.id, createdAt: now, expiresAt });
    await recordAudit(tx, {
      actorUserId: row.id,
      action: "USER_LOGGED_IN",
      entityType: "USER",
      entityId: row.id,
      patientId: null,
      metadata: {},
      createdAt: now,
    });
  });
  const { passwordHash: _hash, ...actor } = row;
  return { token, actor: toActor(actor), expiresAt };
}

/** The user behind a session token, or null when the token is unknown or expired. */
export async function sessionActor(
  db: DbExecutor,
  token: string,
  now: Date,
): Promise<{ actor: ActorContext; expiresAt: Date } | null> {
  const [row] = await db
    .select({ ...actorColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  const { expiresAt, ...actor } = row;
  return { actor: toActor(actor), expiresAt };
}

export async function logout(
  db: Database,
  args: { token: string; actor: ActorContext; now: Date },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.id, hashToken(args.token)));
    await recordAudit(tx, {
      actorUserId: args.actor.id,
      action: "USER_LOGGED_OUT",
      entityType: "USER",
      entityId: args.actor.id,
      patientId: null,
      metadata: {},
      createdAt: args.now,
    });
  });
}
