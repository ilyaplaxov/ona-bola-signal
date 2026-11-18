import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/services/password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("demo2026");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("demo2026", stored)).toBe(true);
    expect(await verifyPassword("demo2027", stored)).toBe(false);
  });

  it("salts every hash and rejects malformed stored values", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});
