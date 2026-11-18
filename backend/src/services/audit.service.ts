import type { AuditAction, AuditEntityType, AuditEvent, AuditListQuery } from "@ona-bola/shared";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { auditLogs, patients, users } from "../db/schema";
import type { RuleSet } from "../risk-engine";
import { toAuditEvent, toUserRef } from "./mappers";

export interface NewAuditEvent {
  /** null means the system. */
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  patientId: string | null;
  /** Minimal context. Never names, free-text notes or other personal details. */
  metadata?: Record<string, unknown>;
  /** Defaults to now; the seed script back-dates its events. */
  createdAt?: Date;
}

/** Appends one audit event. Call it inside the same transaction as the change it records. */
export async function recordAudit(db: DbExecutor, event: NewAuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: event.actorUserId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    patientId: event.patientId,
    metadata: event.metadata ?? {},
    ...(event.createdAt ? { createdAt: event.createdAt } : {}),
  });
}

/** Newest first, with the acting user and the patient reference resolved. */
export async function listAudit(
  db: DbExecutor,
  query: Partial<Omit<AuditListQuery, "limit">> & { limit: number; actions?: AuditAction[] },
): Promise<AuditEvent[]> {
  const filters: SQL[] = [];
  if (query.patientId) filters.push(eq(auditLogs.patientId, query.patientId));
  if (query.entityType) filters.push(eq(auditLogs.entityType, query.entityType));
  if (query.entityId) filters.push(eq(auditLogs.entityId, query.entityId));
  if (query.actions && query.actions.length > 0)
    filters.push(inArray(auditLogs.action, query.actions));

  const rows = await db
    .select({
      event: auditLogs,
      actor: { id: users.id, displayName: users.displayName, role: users.role },
      patientReference: patients.externalReference,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(patients, eq(patients.id, auditLogs.patientId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.seq))
    .limit(query.limit);

  return rows.map((r) =>
    toAuditEvent(r.event, r.actor ? toUserRef(r.actor) : null, r.patientReference),
  );
}

/**
 * Records which rule set the API runs with (brief section 5.6: rule configuration changes are audited).
 * Writes an entry only when the version differs from the last one recorded.
 */
export async function recordRuleSetLoaded(
  db: DbExecutor,
  ruleSet: RuleSet,
  createdAt?: Date,
): Promise<boolean> {
  const [last] = await db
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(eq(auditLogs.action, "RULE_SET_LOADED"))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.seq))
    .limit(1);
  if (last?.metadata.version === ruleSet.version) return false;
  await recordAudit(db, {
    actorUserId: null,
    action: "RULE_SET_LOADED",
    entityType: "RULE_SET",
    entityId: ruleSet.id,
    patientId: null,
    metadata: { version: ruleSet.version, kind: ruleSet.kind, rules: ruleSet.rules.length },
    ...(createdAt ? { createdAt } : {}),
  });
  return true;
}
