import type { DashboardStats, User } from "@ona-bola/shared";
import { asc, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../db/client";
import { alerts, patients, users } from "../db/schema";
import { listAudit } from "./audit.service";

export async function getDashboardStats(db: DbExecutor): Promise<DashboardStats> {
  const zoneRows = await db
    .select({ zone: patients.currentRiskZone, count: sql`count(*)`.mapWith(Number) })
    .from(patients)
    .groupBy(patients.currentRiskZone);
  const zoneCounts = { GREEN: 0, YELLOW: 0, RED: 0, NOT_ASSESSED: 0 };
  for (const row of zoneRows) zoneCounts[row.zone ?? "NOT_ASSESSED"] = row.count;

  const alertRows = await db
    .select({ severity: alerts.severity, count: sql`count(*)`.mapWith(Number) })
    .from(alerts)
    .where(eq(alerts.status, "PENDING"))
    .groupBy(alerts.severity);
  const pendingAlerts = { total: 0, YELLOW: 0, RED: 0 };
  for (const row of alertRows) {
    pendingAlerts[row.severity] = row.count;
    pendingAlerts.total += row.count;
  }

  // The feed shows what people did and what needs them; routine re-checks would drown it.
  const recentActivity = await listAudit(db, {
    limit: 10,
    actions: ["MEASUREMENTS_ADDED", "ALERT_CREATED", "ALERT_ACKNOWLEDGED", "PATIENT_CREATED"],
  });
  return { zoneCounts, pendingAlerts, recentActivity };
}

/** Demo actors for the role switcher, grouped by role. */
export async function listUsers(db: DbExecutor): Promise<User[]> {
  const rows = await db.select().from(users).orderBy(asc(users.role), asc(users.displayName));
  return rows.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    district: u.district,
  }));
}
