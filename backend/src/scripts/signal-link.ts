// npm run signal:link -- OB-DEMO-01
// Issues a one-time signal code for a patient from the terminal, for testing the Telegram bot
// and the /signal page before the patient card has its "Connect Telegram" button. The code is
// issued in the name of the patient's assigned doctor (or a doctor of her district) and audited
// like one issued from the card. Synthetic demo data only.
import { and, eq } from "drizzle-orm";
import { loadConfig, loadEnvFile } from "../config";
import { createDatabase } from "../db/client";
import { patients, users } from "../db/schema";
import { findActorById } from "../services/auth.service";
import { issueLinkCode } from "../services/signal.service";
import { telegramApi } from "../telegram/bot";

loadEnvFile();
const config = loadConfig();
const reference = process.argv[2];
if (!reference) {
  console.error("Usage: npm run signal:link -- <patient reference, e.g. OB-DEMO-01>");
  process.exit(1);
}

const { pool, db } = createDatabase(config.DATABASE_URL);
try {
  const [patient] = await db
    .select({
      id: patients.id,
      district: patients.district,
      assignedUserId: patients.assignedUserId,
    })
    .from(patients)
    .where(eq(patients.externalReference, reference))
    .limit(1);
  if (!patient) throw new Error(`No patient with reference ${reference}`);

  const [districtDoctor] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "DOCTOR"), eq(users.district, patient.district)))
    .limit(1);
  const actorId = patient.assignedUserId ?? districtDoctor?.id;
  const actor = actorId ? await findActorById(db, actorId) : null;
  if (!actor) throw new Error(`No doctor to issue the code for ${reference}`);

  let botUsername: string | null = null;
  if (config.TELEGRAM_BOT_TOKEN) {
    const me = await telegramApi(config.TELEGRAM_BOT_TOKEN).call<{ username: string }>("getMe");
    botUsername = me.username;
  }
  const link = await issueLinkCode(db, {
    patientId: patient.id,
    actor,
    now: new Date(),
    botUsername,
  });
  const web = `http://localhost:5173${link.webPath}`;
  console.log(`Patient ${reference}, code issued as ${actor.displayName}`);
  console.log(`Code:      ${link.code} (valid until ${link.expiresAt})`);
  console.log(`Telegram:  ${link.telegramUrl ?? "bot off (no TELEGRAM_BOT_TOKEN)"}`);
  console.log(`Web page:  ${web}`);
} finally {
  await pool.end();
}
