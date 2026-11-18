import type { Request } from "express";
import { HttpError } from "../http-error";

/**
 * Fixed-window counter per key, in memory (one API process). Enough to stop guessing link codes
 * from one address; a shared store is needed only with several API instances.
 */
export function rateLimiter(options: { limit: number; windowMs: number; clock?: () => Date }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const now = () => (options.clock ? options.clock().getTime() : Date.now());
  return {
    /** Throws 429 RATE_LIMITED when the key used up its window. */
    check(req: Request, scope: string): void {
      const key = `${scope}:${req.ip ?? "unknown"}`;
      const t = now();
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + options.windowMs });
        return;
      }
      entry.count += 1;
      if (entry.count > options.limit) {
        throw new HttpError(429, "RATE_LIMITED", "Too many attempts; try again in a few minutes");
      }
    },
  };
}
