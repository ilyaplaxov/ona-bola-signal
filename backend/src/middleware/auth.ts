import { DEMO_ACTOR_HEADER, SESSION_COOKIE, Uuid, type UserRef } from "@ona-bola/shared";
import type { Request, RequestHandler, Response } from "express";
import type { Database } from "../db/client";
import { HttpError } from "../http-error";
import { findActorById, sessionActor, type ActorContext } from "../services/auth.service";

export interface AuthOptions {
  /**
   * Also accept the old x-demo-user-id header (role switcher). On in tests and during the switch
   * to the login page; off in production. The session cookie always wins when both are present.
   */
  allowDemoHeader: boolean;
  clock: () => Date;
}

/** Reads one cookie from the Cookie header (no cookie-parser dependency). */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Resolves the acting user from the session cookie (or, when allowed, the demo header) and puts
 * it on res.locals. No credentials: the request continues anonymously and routes decide.
 * An expired or unknown session also continues anonymously (the client then shows the login page);
 * an invalid demo header is a 401, as before.
 */
export function authenticate(db: Database, options: AuthOptions): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      const session = await sessionActor(db, token, options.clock());
      if (session) {
        res.locals.actorContext = session.actor;
        res.locals.sessionToken = token;
        res.locals.sessionExpiresAt = session.expiresAt;
        return next();
      }
    }

    const raw = options.allowDemoHeader ? req.get(DEMO_ACTOR_HEADER) : undefined;
    if (raw === undefined || raw === "") return next();
    const id = Uuid.safeParse(raw);
    if (!id.success) {
      throw new HttpError(401, "ACTOR_REQUIRED", `Header ${DEMO_ACTOR_HEADER} must be a user id`);
    }
    const actor = await findActorById(db, id.data);
    if (!actor) throw new HttpError(401, "ACTOR_REQUIRED", "Unknown demo user");
    res.locals.actorContext = actor;
    next();
  };
}

/** The signed-in user with role, district and specialty, if any. */
export function getActorContext(res: Response): ActorContext | null {
  return (res.locals.actorContext as ActorContext | undefined) ?? null;
}

/** Signed-in user or 401. */
export function requireActorContext(res: Response): ActorContext {
  const actor = getActorContext(res);
  if (!actor) throw new HttpError(401, "ACTOR_REQUIRED", "Sign in first");
  return actor;
}

/** The acting user as a plain reference (id, name, role), for audit and responses. */
export function getActor(res: Response): UserRef | null {
  const actor = getActorContext(res);
  return actor ? { id: actor.id, displayName: actor.displayName, role: actor.role } : null;
}

export function requireActor(res: Response): UserRef {
  const actor = requireActorContext(res);
  return { id: actor.id, displayName: actor.displayName, role: actor.role };
}
