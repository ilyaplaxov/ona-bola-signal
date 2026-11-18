import { createApp } from "./app";
import { loadConfig, loadEnvFile } from "./config";
import { createDatabase, pingDatabase } from "./db/client";
import { getRuleSet } from "./risk-engine";
import { DEMO_PASSWORD } from "./scripts/seed-data";
import { recordRuleSetLoaded } from "./services/audit.service";
import { aiServiceFromConfig } from "./services/claude.service";

loadEnvFile();
const config = loadConfig();
const ruleSet = getRuleSet(config.RULE_SET);
const { pool, db } = createDatabase(config.DATABASE_URL);
const { ai, status: aiStatus } = aiServiceFromConfig(config);
const app = createApp({
  pingDb: () => pingDatabase(pool),
  db,
  ruleSet,
  ai,
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

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, closing the API`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
