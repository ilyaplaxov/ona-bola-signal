import { DEMO_ACTOR_HEADER, Uuid, type UserRef } from "@ona-bola/shared";
import { eq } from "drizzle-orm";
import type { RequestHandler, Response } from "express";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import { HttpError } from "../http-error";
import { toUserRef } from "../services/mappers";

/**
 * Reads the acting demo user from the x-demo-user-id header (set by the role switcher).
 * No header: the request continues without an actor; read routes need none.
 * A header that is not a known user id: 401 ACTOR_REQUIRED.
 * Real authentication replaces this later (brief section 11: no parallel password system for the demo).
 */
export function demoActor(db: Database): RequestHandler {
  return async (req, res, next) => {
    const raw = req.get(DEMO_ACTOR_HEADER);
    if (raw === undefined || raw === "") return next();
    const id = Uuid.safeParse(raw);
    if (!id.success) {
      throw new HttpError(401, "ACTOR_REQUIRED", `Header ${DEMO_ACTOR_HEADER} must be a user id`);
    }
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName, role: users.role })
      .from(users)
      .where(eq(users.id, id.data))
      .limit(1);
    if (!user) throw new HttpError(401, "ACTOR_REQUIRED", "Unknown demo user");
    res.locals.actor = toUserRef(user);
    next();
  };
}

/** The acting user, if the request named one. */
export function getActor(res: Response): UserRef | null {
  return (res.locals.actor as UserRef | undefined) ?? null;
}

/** The acting user; write routes call this and fail with 401 when nobody is acting. */
export function requireActor(res: Response): UserRef {
  const actor = getActor(res);
  if (!actor) {
    throw new HttpError(
      401,
      "ACTOR_REQUIRED",
      `Choose a demo user first (header ${DEMO_ACTOR_HEADER})`,
    );
  }
  return actor;
}
