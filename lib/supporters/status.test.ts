import { describe, expect, it } from "vitest";
import { computeRenewedExpiry } from "@/lib/supporters/status";

describe("computeRenewedExpiry", () => {
  it("starts a fresh 30-day window when there is no existing record", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(computeRenewedExpiry(now, null)).toEqual(new Date("2026-08-31T00:00:00.000Z"));
  });

  it("starts a fresh 30-day window when the existing record already expired", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const current = { status: "EXPIRED", expiresAt: new Date("2026-07-20T00:00:00.000Z") };
    expect(computeRenewedExpiry(now, current)).toEqual(new Date("2026-08-31T00:00:00.000Z"));
  });

  it("never loses remaining days — stacks 30 days on top of the current expiry (ticket example: expira 20/08, novo apoio 10/08 -> 19/09)", () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const current = { status: "ACTIVE", expiresAt: new Date("2026-08-20T00:00:00.000Z") };
    expect(computeRenewedExpiry(now, current)).toEqual(new Date("2026-09-19T00:00:00.000Z"));
  });

  it("ignores a non-ACTIVE record even if its expiresAt is in the future", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const current = { status: "CANCELLED", expiresAt: new Date("2026-08-15T00:00:00.000Z") };
    expect(computeRenewedExpiry(now, current)).toEqual(new Date("2026-08-31T00:00:00.000Z"));
  });
});
