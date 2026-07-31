import { describe, expect, it } from "vitest";
import { isEpisodeAvailable } from "@/lib/progress/availability";

const now = new Date("2026-08-01T12:00:00Z");

describe("isEpisodeAvailable", () => {
  it("is available when airedAt is in the past", () => {
    expect(isEpisodeAvailable(new Date("2026-07-01T00:00:00Z"), now)).toBe(true);
  });

  it("is available exactly at the release moment", () => {
    expect(isEpisodeAvailable(now, now)).toBe(true);
  });

  it("is not available when airedAt is in the future", () => {
    expect(isEpisodeAvailable(new Date("2026-08-02T00:00:00Z"), now)).toBe(false);
  });

  it("is not available when airedAt is null (not synced/announced)", () => {
    expect(isEpisodeAvailable(null, now)).toBe(false);
  });
});
