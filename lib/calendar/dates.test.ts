import { describe, expect, it } from "vitest";
import { startOfDay, endOfDay, addDays, isSameDay, diffInCalendarDays, formatShortDate } from "@/lib/calendar/dates";

describe("startOfDay / endOfDay", () => {
  it("zeroes out the time portion", () => {
    const date = new Date("2026-07-21T15:42:31.123Z");
    const start = startOfDay(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("pushes the time portion to the end of the day", () => {
    const date = new Date("2026-07-21T15:42:31.123Z");
    const end = endOfDay(date);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it("does not mutate the input date", () => {
    const date = new Date("2026-07-21T15:42:31.123Z");
    const original = date.getTime();
    startOfDay(date);
    expect(date.getTime()).toBe(original);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const result = addDays(new Date("2026-07-21T00:00:00"), 7);
    expect(result.getDate()).toBe(28);
  });

  it("subtracts with negative days", () => {
    const result = addDays(new Date("2026-07-21T00:00:00"), -21);
    expect(result.getDate()).toBe(30);
    expect(result.getMonth()).toBe(5); // June (0-indexed)
  });

  it("rolls over month boundaries", () => {
    const result = addDays(new Date("2026-07-30T00:00:00"), 5);
    expect(result.getMonth()).toBe(7); // August
    expect(result.getDate()).toBe(4);
  });
});

describe("isSameDay", () => {
  it("is true for the same calendar day at different times", () => {
    expect(isSameDay(new Date("2026-07-21T01:00:00"), new Date("2026-07-21T23:00:00"))).toBe(true);
  });

  it("is false across a day boundary", () => {
    expect(isSameDay(new Date("2026-07-21T23:59:00"), new Date("2026-07-22T00:01:00"))).toBe(false);
  });
});

describe("diffInCalendarDays", () => {
  it("counts whole calendar days regardless of time-of-day", () => {
    expect(diffInCalendarDays(new Date("2026-07-24T23:00:00"), new Date("2026-07-21T01:00:00"))).toBe(3);
  });

  it("is negative when target is before from", () => {
    expect(diffInCalendarDays(new Date("2026-07-18T00:00:00"), new Date("2026-07-21T00:00:00"))).toBe(-3);
  });

  it("is zero for the same day", () => {
    expect(diffInCalendarDays(new Date("2026-07-21T08:00:00"), new Date("2026-07-21T22:00:00"))).toBe(0);
  });
});

describe("formatShortDate", () => {
  it("formats as day + abbreviated month (pt-BR)", () => {
    const formatted = formatShortDate(new Date("2026-07-21T12:00:00Z"));
    expect(formatted).toContain("21");
  });
});
