import { can, patientScope, type Permission } from "@ona-bola/shared";
import { eq, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { patients } from "../db/schema";
import { HttpError } from "../http-error";
import type { ActorContext } from "./auth.service";

// Server-side access checks (TEAM_PLAN section 2; the matrix itself is in shared/permissions.ts).
// The actor is null only in legacy mode (AUTH_DEMO_HEADER on and nobody chosen): then reads stay
// open as before sign-in existed. Writes always need an actor.

/** 403 unless the actor's role has the permission. */
export function assertCan(actor: ActorContext, permission: Permission): void {
  if (!can(actor.role, permission)) {
    throw new HttpError(403, "FORBIDDEN", `Your role (${actor.role}) cannot do this`);
  }
}

/**
 * SQL condition on the `patients` table: the patients this actor may see. undefined means all.
 * REFERRALS: patients with an open referral to the consultant or their specialty.
 */
export function visiblePatients(actor: ActorContext | null): SQL | undefined {
  if (!actor) return undefined;
  switch (patientScope(actor)) {
    case "ALL":
      return undefined;
    case "DISTRICT":
      return actor.district ? eq(patients.district, actor.district) : undefined;
    case "REFERRALS":
      return referredTo(actor);
  }
}

function referredTo(actor: ActorContext): SQL {
  return sql`exists (
    select 1 from referrals r
    where r.patient_id = ${patients.id}
      and r.status in ('SENT', 'ACCEPTED', 'CONCLUDED') -- OPEN_REFERRAL_STATUSES
      and (r.to_user_id = ${actor.id}
        or (r.to_user_id is null and r.to_specialty = ${actor.specialty})))`;
}

/** 404 when the patient does not exist, 403 when the actor may not see her. */
export async function assertPatientAccess(
  db: DbExecutor,
  actor: ActorContext | null,
  patientId: string,
): Promise<void> {
  const visible = visiblePatients(actor);
  const [row] = await db
    .select({ id: patients.id, visible: visible ? sql<boolean>`${visible}` : sql<boolean>`true` })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Patient not found");
  if (!row.visible) throw new HttpError(403, "FORBIDDEN", "This patient is not in your list");
}
