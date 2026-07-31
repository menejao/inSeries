import { describe, expect, it } from "vitest";
import { computeSeriesProgressFromEpisodes } from "@/lib/progress/calculate";

describe("computeSeriesProgressFromEpisodes", () => {
  it("ticket example: season 1 (10 aired) fully watched + season 2 announced (0 aired) -> 100% Concluida", () => {
    const season1 = Array.from({ length: 10 }, (_, i) => ({ id: `s1e${i}`, airedAt: new Date("2026-01-01T00:00:00Z") }));
    // Season 2 announced but not aired yet — must never count toward the total.
    const season2 = Array.from({ length: 8 }, (_, i) => ({ id: `s2e${i}`, airedAt: new Date("2027-01-01T00:00:00Z") }));
    const watchedIds = new Set(season1.map((e) => e.id));

    const result = computeSeriesProgressFromEpisodes([...season1, ...season2], watchedIds);

    expect(result.totalEpisodes).toBe(10);
    expect(result.watchedEpisodes).toBe(10);
    expect(result.percentage).toBe(100);
    expect(result.completed).toBe(true);
  });

  it("a future episode never enters the denominator or becomes nextEpisode", () => {
    const past = { id: "e1", airedAt: new Date("2020-01-01T00:00:00Z") };
    const future = { id: "e2", airedAt: new Date("2099-01-01T00:00:00Z") };
    const result = computeSeriesProgressFromEpisodes([past, future], new Set());

    expect(result.totalEpisodes).toBe(1);
    expect(result.nextEpisode?.id).toBe("e1");
    expect(result.completed).toBe(false);
  });

  it("an episode with no airedAt yet (unsynced) is treated as unavailable", () => {
    const result = computeSeriesProgressFromEpisodes([{ id: "e1", airedAt: null }], new Set());
    expect(result.totalEpisodes).toBe(0);
    expect(result.completed).toBe(false);
  });
});
