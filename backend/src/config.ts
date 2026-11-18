import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Connection string for the docker-compose database. Local development only; not a secret. */
export const DEFAULT_DATABASE_URL = "postgres://ona:ona_dev_only@localhost:5433/ona_bola";

/** backend/uploads: uploaded patient files (git-ignored). */
export const DEFAULT_UPLOADS_DIR = fileURLToPath(new URL("../uploads", import.meta.url));

/** Loads backend/.env if it exists. The app also runs without it, on the defaults below. */
export function loadEnvFile(): void {
  const file = fileURLToPath(new URL("../.env", import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * API port. Deliberately not the generic PORT, which preview runners and hosts set for the whole
   * process tree (that would put the API on the web app's port). Keep in sync with the Vite proxy.
   */
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
  /** Folder for uploaded files. */
  UPLOADS_DIR: z.string().min(1).default(DEFAULT_UPLOADS_DIR),
  TEST_DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Which Risk Engine rule set to use. "validated" stays empty until a clinician approves rules. */
  RULE_SET: z.enum(["demo", "validated"]).default("demo"),
  /** Claude features (phase 5) run only when this is true. */
  AI_ENABLED: z.stringbool().default(false),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLAUDE_MODEL: z.string().min(1).default("claude-opus-5-5"),
  CLAUDE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  /**
   * Accept the old x-demo-user-id header besides the session cookie. Default: on, except in
   * production. Turn off once the frontend signs in through the login page.
   */
  AUTH_DEMO_HEADER: z.preprocess(emptyToUndefined, z.stringbool().optional()),
  /** List the seeded demo accounts and their password on the login page. Default: on, except in production. */
  DEMO_ACCOUNTS: z.preprocess(emptyToUndefined, z.stringbool().optional()),
});

type ParsedEnv = z.infer<typeof EnvSchema>;
export type Config = Omit<ParsedEnv, "AUTH_DEMO_HEADER" | "DEMO_ACCOUNTS"> & {
  AUTH_DEMO_HEADER: boolean;
  DEMO_ACCOUNTS: boolean;
};

/** Validates the environment once at startup and fails with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const notProduction = parsed.data.NODE_ENV !== "production";
  return {
    ...parsed.data,
    AUTH_DEMO_HEADER: parsed.data.AUTH_DEMO_HEADER ?? notProduction,
    DEMO_ACCOUNTS: parsed.data.DEMO_ACCOUNTS ?? notProduction,
  };
}
