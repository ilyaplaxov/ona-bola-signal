import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs from backend/. Keep the fallback in sync with DEFAULT_DATABASE_URL in src/config.ts.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://ona:ona_dev_only@localhost:5433/ona_bola",
  },
  strict: true,
  verbose: true,
});
