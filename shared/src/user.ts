import { z } from "zod";
import { Uuid } from "./common";

/**
 * Roles. SPECIALIST covers two kinds of user:
 * - specialty null: the alert recipient named in problem #9 (OvaBMU). Its display label comes from
 *   UI config; the "OvaBMU" abbreviation is not expanded anywhere until the domain mentor confirms it.
 * - specialty set (endocrinologist, cardiologist…): a consultant who sees patients referred to them.
 */
export const UserRole = z.enum(["DOCTOR", "NURSE", "SPECIALIST", "MANAGER"]);
export type UserRole = z.infer<typeof UserRole>;

/**
 * Medical specialties a patient can be referred to. Draft list for the hackathon: participant 3
 * confirms with a doctor which consultants an obstetrician actually refers to (TEAM_PLAN, section 3).
 */
export const Specialty = z.enum([
  "OBSTETRICIAN_GYNECOLOGIST",
  "THERAPIST",
  "ENDOCRINOLOGIST",
  "CARDIOLOGIST",
  "NEPHROLOGIST",
  "HEMATOLOGIST",
  "NEUROLOGIST",
  "OPHTHALMOLOGIST",
  "INFECTIOUS_DISEASE",
  "OTHER",
]);
export type Specialty = z.infer<typeof Specialty>;

export const UserRef = z.object({
  id: Uuid,
  displayName: z.string().min(1),
  role: UserRole,
});
export type UserRef = z.infer<typeof UserRef>;

export const User = UserRef.extend({
  district: z.string().min(1).nullable(),
  /** Set for consultants; null for obstetric staff, the alert recipient and managers. */
  specialty: Specialty.nullable().optional(),
  facility: z.string().min(1).nullable().optional(),
});
export type User = z.infer<typeof User>;
