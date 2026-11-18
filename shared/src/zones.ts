import { z } from "zod";

/** Risk zone set by the backend Risk Engine. The frontend displays it and never computes it. */
export const RiskZone = z.enum(["GREEN", "YELLOW", "RED"]);
export type RiskZone = z.infer<typeof RiskZone>;

/** Zones that need attention. Rule outcomes, reasons and alerts are never GREEN. */
export const ElevatedZone = z.enum(["YELLOW", "RED"]);
export type ElevatedZone = z.infer<typeof ElevatedZone>;

/** Registry filter: a zone, or patients that have no assessment yet. */
export const ZoneFilter = z.enum(["GREEN", "YELLOW", "RED", "NOT_ASSESSED"]);
export type ZoneFilter = z.infer<typeof ZoneFilter>;

/** Order for sorting and comparing zones. An ordering, not a clinical rule. */
export const ZONE_ORDER = { GREEN: 0, YELLOW: 1, RED: 2 } as const satisfies Record<
  RiskZone,
  number
>;
