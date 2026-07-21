import { describe, expect, it, vi, afterEach } from "vitest";
import { cn, formatEpisodeCode, getInitials, formatDate, formatRelativeDate, isNavItemActive } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops false/null/undefined", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatEpisodeCode", () => {
  it("pads season and episode to 2 digits", () => {
    expect(formatEpisodeCode(1, 1)).toBe("S01E01");
    expect(formatEpisodeCode(12, 34)).toBe("S12E34");
  });
});

describe("getInitials", () => {
  it("uses first letter of first and last name for multi-word names", () => {
    expect(getInitials("Joao Silva")).toBe("JS");
  });

  it("uses first 2 letters for a single-word name", () => {
    expect(getInitials("Joao")).toBe("JO");
  });

  it("returns ? for an empty/whitespace-only name", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("formatDate", () => {
  it("formats with day, full month name and year (pt-BR)", () => {
    const formatted = formatDate(new Date("2026-03-05T12:00:00Z"));
    expect(formatted).toContain("2026");
    expect(formatted).toContain("5");
  });
});

describe("isNavItemActive", () => {
  it("matches '/' only when the pathname is exactly '/'", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/calendar", "/")).toBe(false);
  });

  it("matches an exact non-root href", () => {
    expect(isNavItemActive("/calendar", "/calendar")).toBe(true);
  });

  it("matches a nested route under a non-root href", () => {
    expect(isNavItemActive("/series/abc123", "/series")).toBe(true);
  });

  it("does not match a different top-level route with a shared prefix", () => {
    expect(isNavItemActive("/serieszzz", "/series")).toBe(false);
  });

  it("does not match an unrelated route", () => {
    expect(isNavItemActive("/feed", "/calendar")).toBe(false);
  });
});

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'agora mesmo' for under a minute", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeDate(new Date("2026-07-21T11:59:40Z"))).toBe("agora mesmo");
  });

  it("returns minutes for under an hour", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeDate(new Date("2026-07-21T11:45:00Z"))).toBe("ha 15 min");
  });

  it("returns hours for under a day", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeDate(new Date("2026-07-21T09:00:00Z"))).toBe("ha 3h");
  });

  it("returns days for under a week", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(formatRelativeDate(new Date("2026-07-19T12:00:00Z"))).toBe("ha 2 dia(s)");
  });

  it("falls back to an absolute date at 7+ days", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const result = formatRelativeDate(new Date("2026-07-01T12:00:00Z"));
    expect(result).toContain("2026");
    expect(result).not.toContain("ha ");
  });
});
