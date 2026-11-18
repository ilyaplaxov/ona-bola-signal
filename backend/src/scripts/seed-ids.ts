import { createHash } from "node:crypto";

/**
 * Deterministic UUID for seed data: the same key gives the same id on every reset, so demo links
 * (for example the demo patient's page) stay valid. Formatted as a version-4 UUID.
 */
export function seedId(key: string): string {
  const h = createHash("sha256").update(`ona-bola-seed:${key}`).digest("hex");
  const variant = ((parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
