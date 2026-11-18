import { z } from "zod";

/** Every id in the system is a UUID. */
export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

/** Calendar date, "YYYY-MM-DD". */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/** Timestamp with an explicit offset, e.g. "2026-11-18T09:40:00+05:00" or "2026-11-18T04:40:00Z". */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Interface and AI output languages. Uzbek first (decision 4); Russian added on 18 Nov 2026. */
export const Language = z.enum(["uz", "ru", "en"]);
export type Language = z.infer<typeof Language>;
