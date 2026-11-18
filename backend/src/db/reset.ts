import { sql } from "drizzle-orm";
import type { Database } from "./client";

/** Deletes every row in every table. Only for local demo and test databases (see scripts/reset.ts). */
export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE attachments, referrals, audit_logs, alerts, risk_assessments, measurements, patients, sessions, users CASCADE`,
  );
}
