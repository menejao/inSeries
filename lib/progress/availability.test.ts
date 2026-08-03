import { describe, expect, it } from "vitest";
import { isEpisodeAvailable, resolveEpisodeAvailability } from "@/lib/progress/availability";

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

describe("resolveEpisodeAvailability", () => {
  const timezone = "America/Sao_Paulo"; // UTC-3, no DST since 2019

  it("airedAt null -> FUTURE, no availableAt", () => {
    const result = resolveEpisodeAvailability({ airedAt: null }, now, timezone);
    expect(result).toEqual({ status: "FUTURE", availableAt: null });
  });

  it("reliable timestamp, now before release -> FUTURE, availableAt is the exact instant", () => {
    // 2026-08-01 20:00 UTC-3 = 23:00 UTC, a real time-of-day (not midnight) -> treated as reliable.
    const airedAt = new Date("2026-08-01T23:00:00Z");
    const before = new Date("2026-08-01T22:59:59Z");
    const result = resolveEpisodeAvailability({ airedAt }, before, timezone);
    expect(result.status).toBe("TODAY_PENDING"); // same local calendar day, not yet released
    expect(result.availableAt).toEqual(airedAt);
  });

  it("reliable timestamp, now after release -> AVAILABLE", () => {
    const airedAt = new Date("2026-08-01T23:00:00Z");
    const after = new Date("2026-08-01T23:00:01Z");
    const result = resolveEpisodeAvailability({ airedAt }, after, timezone);
    expect(result.status).toBe("AVAILABLE");
    expect(result.availableAt).toEqual(airedAt);
  });

  it("reliable timestamp exactly at release instant -> AVAILABLE (now >= availableAt)", () => {
    const airedAt = new Date("2026-08-01T23:00:00Z");
    const result = resolveEpisodeAvailability({ airedAt }, airedAt, timezone);
    expect(result.status).toBe("AVAILABLE");
  });

  it("airDate today, no time (TMDb date-only) -> TODAY_PENDING, not AVAILABLE, even though UTC midnight already passed", () => {
    // airedAt 2026-08-02T00:00:00Z reads as 2026-08-01 21:00 in America/Sao_Paulo (UTC-3) — its
    // *local* calendar day is Aug 1, same as `now`'s local day (Aug 1, 09:00) — this is the
    // realistic TMDb-sync shape: a bare air_date always lands as UTC midnight.
    const airedAt = new Date("2026-08-02T00:00:00Z");
    const result = resolveEpisodeAvailability({ airedAt }, now, timezone);
    expect(result.status).toBe("TODAY_PENDING");
    expect(result.availableAt).toEqual(new Date("2026-08-02T03:00:00Z")); // 2026-08-02T00:00:00-03:00
  });

  it("rolls over to AVAILABLE at local midnight of the next day, not a second before", () => {
    const airedAt = new Date("2026-08-02T00:00:00Z"); // local day Aug 1 in Sao Paulo, see test above
    const oneSecondBeforeMidnight = new Date("2026-08-02T02:59:59Z"); // 2026-08-01 23:59:59 local
    const atMidnight = new Date("2026-08-02T03:00:00Z"); // 2026-08-02 00:00:00 local

    expect(resolveEpisodeAvailability({ airedAt }, oneSecondBeforeMidnight, timezone).status).toBe("TODAY_PENDING");
    expect(resolveEpisodeAvailability({ airedAt }, atMidnight, timezone).status).toBe("AVAILABLE");
  });

  it("airDate in the future -> FUTURE", () => {
    const airedAt = new Date("2026-08-05T00:00:00Z");
    const result = resolveEpisodeAvailability({ airedAt }, now, timezone);
    expect(result.status).toBe("FUTURE");
  });

  it("old, long-since-aired episode -> AVAILABLE (existing behavior preserved)", () => {
    const airedAt = new Date("2020-01-01T00:00:00Z");
    const result = resolveEpisodeAvailability({ airedAt }, now, timezone);
    expect(result.status).toBe("AVAILABLE");
  });

  it("server timezone vs user timezone: same instant + same airedAt resolve to different statuses depending on the timezone passed in", () => {
    // airedAt 2026-08-02T00:00:00Z's *local* day is Aug 1 in Sao Paulo (UTC-3) but Aug 2 in UTC.
    // At instant 2026-08-01T23:00:00Z:
    //  - America/Sao_Paulo reads it as Aug 1, 20:00 local -> same local day as airedAt -> TODAY_PENDING.
    //  - UTC reads it as Aug 1, 23:00 -> the day *before* airedAt's UTC local day (Aug 2) -> FUTURE.
    // Proves the function never falls back to the server's own local time — the timezone
    // argument alone decides the outcome for an identical pair of instants.
    const airedAt = new Date("2026-08-02T00:00:00Z");
    const instant = new Date("2026-08-01T23:00:00Z");

    expect(resolveEpisodeAvailability({ airedAt }, instant, "America/Sao_Paulo").status).toBe("TODAY_PENDING");
    expect(resolveEpisodeAvailability({ airedAt }, instant, "UTC").status).toBe("FUTURE");
  });

  it("DST-observing timezone: next-local-midnight instant lands after a spring-forward transition", () => {
    // America/New_York springs forward 2026-03-08 02:00 -> 03:00 local (UTC-5 -> UTC-4).
    // airedAt 2026-03-09T00:00:00Z reads as 2026-03-08, 20:00 EDT in New York (local day Mar 8,
    // already past the transition) — next local midnight is 2026-03-09 00:00 EDT = 04:00 UTC,
    // not the pre-transition 05:00 UTC (UTC-5) it would be without re-reading the offset for
    // the target day.
    const airedAt = new Date("2026-03-09T00:00:00Z");
    const result = resolveEpisodeAvailability({ airedAt }, new Date("2026-03-10T00:00:00Z"), "America/New_York");
    expect(result.availableAt).toEqual(new Date("2026-03-09T04:00:00Z"));
  });

  it("falls back to the product's configured default timezone when none is passed", () => {
    // No third argument -> getDefaultTimezone() -> "America/Sao_Paulo" unless APP_TIMEZONE is set.
    const airedAt = new Date("2026-08-01T00:00:00Z");
    const withDefault = resolveEpisodeAvailability({ airedAt }, now);
    const withExplicitSaoPaulo = resolveEpisodeAvailability({ airedAt }, now, "America/Sao_Paulo");
    expect(withDefault).toEqual(withExplicitSaoPaulo);
  });
});
