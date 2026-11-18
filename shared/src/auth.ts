import { z } from "zod";
import { IsoDateTime } from "./common";
import { Specialty, User, UserRole } from "./user";

// Doctor sign-in (TEAM_PLAN item 12). Demo accounts are seeded; the session lives in an httpOnly
// cookie, so the browser sends it with every request (fetch needs credentials: "include" only for
// a different origin; the Vite dev proxy keeps it same-origin).

/** Name of the httpOnly session cookie set by POST /api/auth/login. */
export const SESSION_COOKIE = "ob_session";

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "3–40 characters: letters, digits, dot, dash, underscore");

export const LoginRequest = z.object({
  username: Username,
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** The signed-in user, with what the interface needs to show their profile. */
export const CurrentUser = User.extend({
  username: z.string().min(1),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

export const SessionResponse = z.object({
  user: CurrentUser,
  expiresAt: IsoDateTime,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

/** Demo accounts listed on the login page for the jury. Empty and disabled outside the demo. */
export const DemoAccountsResponse = z.object({
  enabled: z.boolean(),
  /** One shared demo password, shown only while demo accounts are enabled. */
  password: z.string().nullable(),
  items: z.array(
    z.object({
      username: z.string().min(1),
      displayName: z.string().min(1),
      role: UserRole,
      specialty: Specialty.nullable(),
      district: z.string().nullable(),
    }),
  ),
});
export type DemoAccountsResponse = z.infer<typeof DemoAccountsResponse>;
