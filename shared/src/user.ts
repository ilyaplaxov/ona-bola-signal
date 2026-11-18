import { z } from "zod";
import { Uuid } from "./common";

/**
 * Demo roles, chosen with the role switcher until real authentication exists.
 * SPECIALIST is the alert recipient named in problem #9. Its display label comes from UI config;
 * the "OvaBMU" abbreviation is not expanded anywhere until the domain mentor confirms it.
 */
export const UserRole = z.enum(["DOCTOR", "NURSE", "SPECIALIST", "MANAGER"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserRef = z.object({
  id: Uuid,
  displayName: z.string().min(1),
  role: UserRole,
});
export type UserRef = z.infer<typeof UserRef>;

export const User = UserRef.extend({
  district: z.string().min(1).nullable(),
});
export type User = z.infer<typeof User>;
