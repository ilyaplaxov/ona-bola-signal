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
    actions: [
      "MEASUREMENTS_ADDED",
      "ALERT_CREATED",
      "ALERT_ACKNOWLEDGED",
      "PATIENT_CREATED",
      "PATIENT_UPDATED",
    ],
  });
  const districtRows = await db
    .select({
      district: patients.district,
      zone: patients.currentRiskZone,
      count: sql`count(*)`.mapWith(Number),
    })
    .from(patients)
    .groupBy(patients.district, patients.currentRiskZone);
  const districtAlertRows = await db
    .select({ district: patients.district, count: sql`count(*)`.mapWith(Number) })
    .from(alerts)
    .innerJoin(patients, eq(patients.id, alerts.patientId))
    .where(eq(alerts.status, "PENDING"))
    .groupBy(patients.district);
  const byDistrict = new Map<string, NonNullable<DashboardStats["districts"]>[number]>();
  const entry = (district: string) => {
    let e = byDistrict.get(district);
    if (!e) {
      e = {
        district,
        zoneCounts: { GREEN: 0, YELLOW: 0, RED: 0, NOT_ASSESSED: 0 },
        pendingAlerts: 0,
      };
      byDistrict.set(district, e);
    }
    return e;
  };
  for (const row of districtRows)
    entry(row.district).zoneCounts[row.zone ?? "NOT_ASSESSED"] = row.count;
  for (const row of districtAlertRows) entry(row.district).pendingAlerts = row.count;
  const districts = [...byDistrict.values()].sort((a, b) => a.district.localeCompare(b.district));

  return { zoneCounts, pendingAlerts, recentActivity, districts };
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
