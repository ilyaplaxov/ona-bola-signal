import express from "express";
import type { Database } from "./db/client";
import type { AiService } from "./services/claude.service";
import { HttpError } from "./http-error";
import { authenticate, getActorContext } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/error-handler";
import type { RuleSet } from "./risk-engine";
import { aiRouter } from "./routes/ai.routes";
import { authRouter, type AuthRouteOptions } from "./routes/auth.routes";
import { healthRouter } from "./routes/health.routes";
import { workflowRouter } from "./routes/measurements.routes";
import { metaRouter } from "./routes/meta.routes";
import { patientsRouter } from "./routes/patients.routes";
import { referralsRouter } from "./routes/referrals.routes";
import { attachmentsRouter } from "./routes/attachments.routes";
import { publicSignalRouter, signalsRouter } from "./routes/signals.routes";
import { assertAttachmentsOfPatient } from "./services/attachment.service";
import type { DimedMode } from "./services/dimed.service";
import { DEMO_PASSWORD } from "./scripts/seed-data";
import { DEFAULT_UPLOADS_DIR } from "./config";

export interface AppDeps {
  /** Resolves true when the database answers. Injected so tests can fake it. */
  pingDb: () => Promise<boolean>;
  db: Database;
  /** Active Risk Engine rule set (RULE_SET in the environment). */
  ruleSet: RuleSet;
  /** Current time; tests pass a fixed clock. Used for derived values such as gestational week. */
  clock?: () => Date;
  /** Claude features; null or absent when AI_ENABLED is off. Tests pass a fake. */
  ai?: AiService | null;
  /** The Telegram bot's @username once known; absent or null without a bot. */
  botUsername?: () => string | null;
  /** DIMED integration mode for the status endpoints (the sender itself runs in server.ts). Default STUB. */
  dimedMode?: DimedMode;
  /** Where uploaded files are stored. Tests pass a temporary folder. */
  uploadsDir?: string;
  /** Sign-in settings. Defaults (for tests): demo header accepted, demo accounts listed, plain cookies. */
  auth?: Partial<AuthRouteOptions> & { allowDemoHeader?: boolean };
}

/** Builds the Express app. The backend lane owns this file; other lanes ask to mount their routers. */
export function createApp(deps: AppDeps): express.Express {
  const clock = deps.clock ?? (() => new Date());
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  const ai = deps.ai ?? null;
  app.use("/api", healthRouter({ pingDb: deps.pingDb, aiEnabled: ai !== null }));
  app.use(
    "/api",
    authenticate(deps.db, { allowDemoHeader: deps.auth?.allowDemoHeader ?? true, clock }),
  );
  app.use(
    "/api",
    authRouter({
      db: deps.db,
      clock,
      options: {
        secureCookies: deps.auth?.secureCookies ?? false,
        demoAccounts: deps.auth?.demoAccounts ?? { enabled: true, password: DEMO_PASSWORD },
      },
    }),
  );
  // The patient's own page: no staff sign-in, so it is mounted before the gate.
  app.use("/api", publicSignalRouter({ db: deps.db, clock }));

  // Without the legacy demo header, everything below needs a signed-in user, except the rule set
  // (no patient data) and the patient's own signal page (/api/public/*).
  if (!(deps.auth?.allowDemoHeader ?? true)) {
    app.use("/api", (req, res, next) => {
      const open = req.path === "/ruleset";
      if (!open && !getActorContext(res)) {
        throw new HttpError(401, "ACTOR_REQUIRED", "Sign in first");
      }
      next();
    });
  }
  app.use("/api", patientsRouter({ db: deps.db, ruleSet: deps.ruleSet, clock }));
  app.use("/api", metaRouter({ db: deps.db, ruleSet: deps.ruleSet, clock }));
  app.use("/api", workflowRouter({ db: deps.db, ruleSet: deps.ruleSet, clock }));
  const store = { dir: deps.uploadsDir ?? DEFAULT_UPLOADS_DIR };
  app.use("/api", aiRouter({ db: deps.db, ai, clock, store }));
  app.use(
    "/api",
    referralsRouter({ db: deps.db, clock, checkAttachments: assertAttachmentsOfPatient }),
  );
  app.use(
    "/api",
    signalsRouter({ db: deps.db, clock, botUsername: deps.botUsername ?? (() => null) }),
  );
  app.use(
    "/api",
    attachmentsRouter({ db: deps.db, clock, store, dimedMode: deps.dimedMode ?? "STUB" }),
  );

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}
