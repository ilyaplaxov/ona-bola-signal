import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { UserRef, UserRole } from "./user";
import { ElevatedZone } from "./zones";

export const AlertStatus = z.enum(["PENDING", "ACKNOWLEDGED", "RESOLVED"]);
export type AlertStatus = z.infer<typeof AlertStatus>;

/** In-app alert. Previews show the patient reference, never the full name. */
export const Alert = z
  .object({
    id: Uuid,
    patientId: Uuid,
    patientReference: z.string().min(1),
    riskAssessmentId: Uuid,
    severity: ElevatedZone,
    title: z.string().min(1),
    message: z.string().min(1),
    triggeredRuleIds: z.array(z.string().min(1)),
    recipientRole: UserRole,
    status: AlertStatus,
    createdAt: IsoDateTime,
    acknowledgedAt: IsoDateTime.nullable(),
    acknowledgedBy: UserRef.nullable(),
  })
  .refine(
    (a) => a.status !== "ACKNOWLEDGED" || (a.acknowledgedAt !== null && a.acknowledgedBy !== null),
    {
      message: "An acknowledged alert records who acknowledged it and when",
      path: ["acknowledgedBy"],
    },
  );
export type Alert = z.infer<typeof Alert>;
