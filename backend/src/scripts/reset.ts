// npm run db:reset — applies migrations, wipes every table and loads the synthetic demo data.
// Refuses to touch a database that is not on this machine unless --allow-remote is passed,
// so a shared (for example Supabase) database is never wiped by accident.
import { rm } from "node:fs/promises";
import { loadConfig, loadEnvFile } from "../config";
import { createDatabase } from "../db/client";
import { runMigrations } from "../db/migrate";
import { resetDatabase } from "../db/reset";
import { getRuleSet } from "../risk-engine";
import { DEMO_PATIENT_REF } from "./seed-data";
import { seedDatabase } from "./seed";

loadEnvFile();
const config = loadConfig();
const target = new URL(config.DATABASE_URL);
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname);

if (!isLocal && !process.argv.includes("--allow-remote")) {
  console.error(
    `Refusing to reset ${target.hostname}: it is not a local database. ` +
      "Pass --allow-remote only if you really mean to wipe it.",
  );
  process.exit(1);
}

const { pool, db } = createDatabase(config.DATABASE_URL);
try {
  await runMigrations(db);
  await resetDatabase(db);
  // Uploaded files belong to the rows just wiped.
  await rm(config.UPLOADS_DIR, { recursive: true, force: true });
  const ruleSet = getRuleSet(config.RULE_SET);
  const summary = await seedDatabase(db, ruleSet, new Date());
  console.log(
    `Demo data ready on ${target.host}${target.pathname}: ${summary.users} users, ${summary.patients} patients, ` +
      `${summary.measurements} measurements, ${summary.assessments} assessments, ${summary.alerts} alerts (rules ${ruleSet.version}).`,
  );
  console.log(`Demo patient: ${DEMO_PATIENT_REF}.`);
} finally {
  await pool.end();
}
