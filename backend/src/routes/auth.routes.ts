import {
  DemoAccountsResponse,
  LoginRequest,
  OkResponse,
  SESSION_COOKIE,
  SessionResponse,
} from "@ona-bola/shared";
import { isNotNull } from "drizzle-orm";
import { Router, type CookieOptions } from "express";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { HttpError } from "../http-error";
import { requireActorContext } from "../middleware/auth";
import { parseInput, sendJson } from "../middleware/validate";
import { login, logout, toCurrentUser } from "../services/auth.service";

export interface AuthRouteOptions {
  /** Secure cookies (HTTPS only). On in production. */
  secureCookies: boolean;
  /** Demo accounts listed on the login page, with the shared demo password. */
  demoAccounts: { enabled: boolean; password: string | null };
}

/** Sign-in, sign-out, the current user, and the demo account list for the login page. */
export function authRouter(deps: {
  db: Database;
  clock: () => Date;
  options: AuthRouteOptions;
}): Router {
  const router = Router();
  const cookie = (expires: Date): CookieOptions => ({
    httpOnly: true,
    sameSite: "lax",
    secure: deps.options.secureCookies,
    path: "/",
    expires,
  });

  router.post("/auth/login", async (req, res) => {
    const body = parseInput(LoginRequest, req.body);
    const result = await login(deps.db, { ...body, now: deps.clock() });
    if (!result) throw new HttpError(401, "INVALID_CREDENTIALS", "Wrong username or password");
    res.cookie(SESSION_COOKIE, result.token, cookie(result.expiresAt));
    sendJson(res, SessionResponse, {
      user: toCurrentUser(result.actor),
      expiresAt: result.expiresAt.toISOString(),
    });
  });

  router.post("/auth/logout", async (_req, res) => {
    const token = res.locals.sessionToken as string | undefined;
    const actor = requireActorContext(res);
    if (token) await logout(deps.db, { token, actor, now: deps.clock() });
    res.clearCookie(SESSION_COOKIE, { ...cookie(new Date(0)), expires: undefined });
    sendJson(res, OkResponse, { ok: true });
  });

  router.get("/auth/me", (_req, res) => {
    const actor = requireActorContext(res);
    const expiresAt =
      (res.locals.sessionExpiresAt as Date | undefined) ??
      new Date(deps.clock().getTime() + 3_600_000);
    sendJson(res, SessionResponse, {
      user: toCurrentUser(actor),
      expiresAt: expiresAt.toISOString(),
    });
  });

  router.get("/auth/demo-accounts", async (_req, res) => {
    const { enabled, password } = deps.options.demoAccounts;
    const items = enabled
      ? await deps.db
          .select({
            username: users.username,
            displayName: users.displayName,
            role: users.role,
            specialty: users.specialty,
            district: users.district,
          })
          .from(users)
          .where(isNotNull(users.username))
          .orderBy(users.role, users.displayName)
      : [];
    sendJson(res, DemoAccountsResponse, {
      enabled,
      password: enabled ? password : null,
      items: items.map((u) => ({ ...u, username: u.username ?? "" })),
    });
  });

  return router;
}
