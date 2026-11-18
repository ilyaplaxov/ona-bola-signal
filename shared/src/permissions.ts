import { z } from "zod";
import type { Specialty, UserRole } from "./user";

// Access matrix (TEAM_PLAN section 2, a draft that participant 3 checks with a doctor). The server
// enforces it on every route; the interface uses the same table only to hide buttons.

export const Permission = z.enum([
  "PATIENT_CREATE",
  "PATIENT_EDIT",
  "VISIT_ADD",
  "REFERRAL_CREATE",
  /** Accept a referral and attach the conclusion: the consultant it is addressed to. */
  "REFERRAL_RESPOND",
  "ATTACHMENT_UPLOAD",
  "ALERT_ACKNOWLEDGE",
  /** Issue a Telegram / web link code to a patient. */
  "SIGNAL_LINK",
  /** Mark a patient's signal as handled (contacted, called in, sent to hospital). */
  "SIGNAL_HANDLE",
  /** AI note analysis, explanation, chat and document reading. */
  "AI_USE",
  /** Full audit log and the per-district overview. */
  "AUDIT_VIEW_ALL",
]);
export type Permission = z.infer<typeof Permission>;

const MATRIX: Record<UserRole, readonly Permission[]> = {
  DOCTOR: [
    "PATIENT_CREATE",
    "PATIENT_EDIT",
    "VISIT_ADD",
    "REFERRAL_CREATE",
    "ATTACHMENT_UPLOAD",
    "ALERT_ACKNOWLEDGE",
    "SIGNAL_LINK",
    "SIGNAL_HANDLE",
    "AI_USE",
  ],
  NURSE: ["VISIT_ADD", "ATTACHMENT_UPLOAD", "SIGNAL_LINK", "SIGNAL_HANDLE", "AI_USE"],
  SPECIALIST: [
    "VISIT_ADD",
    "REFERRAL_CREATE",
    "REFERRAL_RESPOND",
    "ATTACHMENT_UPLOAD",
    "ALERT_ACKNOWLEDGE",
    "AI_USE",
  ],
  MANAGER: ["AUDIT_VIEW_ALL"],
};

export function permissionsFor(role: UserRole): readonly Permission[] {
  return MATRIX[role];
}

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

/**
 * Which patients a user sees:
 * - ALL: managers (read-only);
 * - DISTRICT: obstetric staff and the alert recipient, in their district (all districts when the
 *   user has none);
 * - REFERRALS: consultants, only patients with an open referral to their specialty or to them.
 */
export type PatientScope = "ALL" | "DISTRICT" | "REFERRALS";

export function patientScope(user: {
  role: UserRole;
  specialty?: Specialty | null | undefined;
}): PatientScope {
  if (user.role === "MANAGER") return "ALL";
  if (user.role === "SPECIALIST" && user.specialty) return "REFERRALS";
  return "DISTRICT";
}
