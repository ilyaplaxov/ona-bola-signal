import type { DimedOutboxItem, DimedRecordType, DimedStatusResponse } from "@ona-bola/shared";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import type { Database, DbExecutor } from "../db/client";
import { dimedOutbox } from "../db/schema";
import { recordAudit } from "./audit.service";

// Integration layer for DIMED (mentor items 1 and 8). Records are queued in the transaction that
// writes them; a sender delivers the queue in the background with retries. Until real access and
// documentation exist (TEAM_PLAN: participant 3 finds out), the far end is a local stub, so the
// flow and the statuses are real and only DIMED itself is simulated. Swapping in the real client
// changes only `DimedClient`.

export type DimedMode = "OFF" | "STUB" | "LIVE";

export interface DimedClient {
  readonly mode: Exclude<DimedMode, "OFF">;
  send(item: { recordType: DimedRecordType; recordId: string; patientId: string }): Promise<void>;
}

/** Accepts everything, like a DIMED test endpoint would. */
export const stubDimedClient: DimedClient = {
  mode: "STUB",
  async send() {},
};

export const MAX_ATTEMPTS = 5;
/** Wait before retry n: 30 s, 1, 2, 4, 8 minutes. */
const backoffMs = (attempt: number) => 30_000 * 2 ** (attempt - 1);

/** Queues a record; queuing the same record twice keeps the first entry. */
export async function enqueueForDimed(
  tx: DbExecutor,
  item: { patientId: string; recordType: DimedRecordType; recordId: string; now: Date },
): Promise<void> {
  await tx
    .insert(dimedOutbox)
    .values({
      patientId: item.patientId,
      recordType: item.recordType,
      recordId: item.recordId,
      status: "PENDING",
      createdAt: item.now,
      nextAttemptAt: item.now,
    })
    .onConflictDoNothing();
}

/**
 * Sends what is due. One failing record never blocks the others; after MAX_ATTEMPTS it stays
 * FAILED for a person to look at. Returns how many were sent and failed.
 */
export async function processDimedOutbox(
  db: Database,
  client: DimedClient,
  now: Date,
  batch = 20,
): Promise<{ sent: number; failed: number }> {
  const due = await db
    .select()
    .from(dimedOutbox)
    .where(
      and(
        inArray(dimedOutbox.status, ["PENDING", "FAILED"]),
        lte(dimedOutbox.nextAttemptAt, now),
        lte(dimedOutbox.attempts, MAX_ATTEMPTS - 1),
      ),
    )
    .orderBy(asc(dimedOutbox.createdAt))
    .limit(batch);

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const attempts = item.attempts + 1;
    try {
      await client.send(item);
      await db.transaction(async (tx) => {
        await tx
          .update(dimedOutbox)
          .set({ status: "SENT", attempts, sentAt: now, lastError: null })
          .where(eq(dimedOutbox.id, item.id));
        await recordAudit(tx, {
          actorUserId: null,
          action: "DIMED_SENT",
          entityType: "DIMED_OUTBOX",
          entityId: item.id,
          patientId: item.patientId,
          metadata: { recordType: item.recordType, mode: client.mode, attempts },
          createdAt: now,
        });
      });
      sent += 1;
    } catch (error) {
      const message = (error as Error).message.slice(0, 300);
      await db.transaction(async (tx) => {
        await tx
          .update(dimedOutbox)
          .set({
            status: "FAILED",
            attempts,
            lastError: message,
            nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
          })
          .where(eq(dimedOutbox.id, item.id));
        await recordAudit(tx, {
          actorUserId: null,
          action: "DIMED_FAILED",
          entityType: "DIMED_OUTBOX",
          entityId: item.id,
          patientId: item.patientId,
          metadata: { recordType: item.recordType, mode: client.mode, attempts },
          createdAt: now,
        });
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

function toItem(row: typeof dimedOutbox.$inferSelect): DimedOutboxItem {
  return {
    id: row.id,
    patientId: row.patientId,
    recordType: row.recordType,
    recordId: row.recordId,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  };
}

export async function dimedStatusForPatient(
  db: DbExecutor,
  patientId: string,
  mode: DimedMode,
): Promise<DimedStatusResponse> {
  const rows = await db
    .select()
    .from(dimedOutbox)
    .where(eq(dimedOutbox.patientId, patientId))
    .orderBy(desc(dimedOutbox.createdAt))
    .limit(100);
  return { mode, items: rows.map(toItem) };
}

/** Delivery status per record id of one type, for lists (for example attachments). */
export async function dimedStatusByRecord(
  db: DbExecutor,
  recordType: DimedRecordType,
  recordIds: string[],
): Promise<Map<string, DimedOutboxItem["status"]>> {
  if (recordIds.length === 0) return new Map();
  const rows = await db
    .select({ recordId: dimedOutbox.recordId, status: dimedOutbox.status })
    .from(dimedOutbox)
    .where(and(eq(dimedOutbox.recordType, recordType), inArray(dimedOutbox.recordId, recordIds)));
  return new Map(rows.map((r) => [r.recordId, r.status]));
}

/** Runs the sender every few seconds until stopped. */
export function startDimedSender(deps: {
  db: Database;
  client: DimedClient;
  intervalMs?: number;
  log?: (message: string) => void;
}): { stop: () => void } {
  const log = deps.log ?? ((m: string) => console.warn(m));
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processDimedOutbox(deps.db, deps.client, new Date())
      .catch((error: Error) => log(`DIMED sender: ${error.message}`))
      .finally(() => {
        running = false;
      });
  }, deps.intervalMs ?? 5_000);
  return { stop: () => clearInterval(timer) };
}
