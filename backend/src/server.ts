import { createApp } from "./app";
import { loadConfig, loadEnvFile } from "./config";
import { createDatabase, pingDatabase } from "./db/client";
import { getRuleSet } from "./risk-engine";
import { DEMO_PASSWORD } from "./scripts/seed-data";
import { recordRuleSetLoaded } from "./services/audit.service";
import { aiServiceFromConfig } from "./services/claude.service";
import { createBotHandler, startPolling, telegramApi } from "./telegram/bot";
import { startDimedSender, stubDimedClient } from "./services/dimed.service";

loadEnvFile();
const config = loadConfig();
const ruleSet = getRuleSet(config.RULE_SET);
const { pool, db } = createDatabase(config.DATABASE_URL);
const { ai, status: aiStatus } = aiServiceFromConfig(config);
// Telegram bot: started after the API, only with a token. Its @username feeds the t.me links.
let botUsername: string | null = null;
let bot: { stop: () => void } | null = null;
let dimed: { stop: () => void } | null = null;

const app = createApp({
  botUsername: () => botUsername,
  pingDb: () => pingDatabase(pool),
  db,
  ruleSet,
  ai,
  uploadsDir: config.UPLOADS_DIR,
  dimedMode: config.DIMED_MODE === "stub" ? "STUB" : "OFF",
  auth: {
    allowDemoHeader: config.AUTH_DEMO_HEADER,
    secureCookies: config.NODE_ENV === "production",
    demoAccounts: {
      enabled: config.DEMO_ACCOUNTS,
      password: config.DEMO_ACCOUNTS ? DEMO_PASSWORD : null,
    },
  },
});

const server = app.listen(config.API_PORT, (error?: Error) => {
  if (error) {
    console.error(`Could not start the API on port ${config.API_PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Ona-Bola Signal API on http://localhost:${config.API_PORT}`);
  console.log(`Rule set ${ruleSet.version} (${ruleSet.kind}), ${ruleSet.rules.length} rules`);
  console.log(`AI features ${aiStatus}`);
  if (config.DIMED_MODE === "stub") {
    dimed = startDimedSender({ db, client: stubDimedClient });
    console.log(
      "DIMED: records are queued and delivered to the local stub (no real DIMED access yet)",
    );
  } else console.log("DIMED: off (records are queued, not sent)");
  if (config.TELEGRAM_BOT_TOKEN) void startBot(config.TELEGRAM_BOT_TOKEN);
  else console.log("Telegram bot off (no TELEGRAM_BOT_TOKEN); the /signal page still works");
  console.log(
    `Sign-in: session cookie${config.AUTH_DEMO_HEADER ? " + demo header" : ""}; ` +
      `demo accounts ${config.DEMO_ACCOUNTS ? "listed on the login page" : "hidden"}`,
  );
});

recordRuleSetLoaded(db, ruleSet).catch((error: Error) => {
  console.warn(
    `Could not record the rule set in the audit log (${error.message}). ` +
      `If the database is new, run "npm run db:reset".`,
  );
});

async function startBot(token: string): Promise<void> {
  const api = telegramApi(token);
  try {
    const me = await api.call<{ username: string }>("getMe");
    // Long polling and a webhook cannot both be active.
    await api.call("deleteWebhook", { drop_pending_updates: false });
    botUsername = me.username;
    bot = startPolling({ api, handle: createBotHandler({ db, api, clock: () => new Date() }) });
    console.log(`Telegram bot @${me.username} is polling`);
  } catch (error) {
    console.warn(`Telegram bot not started: ${(error as Error).message}`);
  }
}

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, closing the API`);
  bot?.stop();
  dimed?.stop();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
