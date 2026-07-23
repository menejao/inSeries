import { describe, expect, it } from "vitest";
import { groupOverdueBySeries } from "@/lib/dashboard/group-by-series";
import type { CalendarEpisode } from "@/lib/calendar/queries";

const now = new Date("2026-07-21T12:00:00Z");

function makeEpisode(
  id: string,
  seasonNumber: number,
  number: number,
  seriesId = "series-1",
  overrides: Partial<CalendarEpisode> = {}
): CalendarEpisode {
  return {
    id,
    title: `Episodio ${id}`,
    number,
    seasonNumber,
    airedAt: now,
    watched: false,
    watchedAt: null,
    stillUrl: null,
    userState: "WATCHING",
    series: { id: seriesId, slug: seriesId, title: `Serie ${seriesId}`, posterUrl: null, backdropUrl: null },
    ...overrides
  };
}

describe("groupOverdueBySeries", () => {
  it("groups episodes from the same series into a single group", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-1", 1, 1), makeEpisode("ep-2", 1, 2), makeEpisode("ep-3", 1, 3)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].episodes.map((ep) => ep.id)).toEqual(["ep-1", "ep-2", "ep-3"]);
  });

  it("keeps episodes from different series in separate groups", () => {
    const groups = groupOverdueBySeries([
      makeEpisode("ep-1", 1, 1, "series-a"),
      makeEpisode("ep-2", 1, 1, "series-b"),
      makeEpisode("ep-3", 1, 2, "series-a")
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.series.id === "series-a")?.count).toBe(2);
    expect(groups.find((g) => g.series.id === "series-b")?.count).toBe(1);
  });

  it("builds a range label when every episode in the group shares the same season", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-1", 2, 1), makeEpisode("ep-2", 2, 2), makeEpisode("ep-3", 2, 3)]);
    expect(groups[0].rangeLabel).toBe("T02E01 ate T02E03");
  });

  it("omits the range label when the group spans multiple seasons", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-1", 1, 5), makeEpisode("ep-2", 2, 1)]);
    expect(groups[0].rangeLabel).toBeNull();
  });

  it("omits the range label for a single-episode group", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-1", 1, 1)]);
    expect(groups[0].rangeLabel).toBeNull();
  });

  it("sorts episodes within a group by season then number, regardless of input order", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-b", 1, 5), makeEpisode("ep-a", 1, 1), makeEpisode("ep-c", 2, 1)]);
    expect(groups[0].episodes.map((ep) => ep.id)).toEqual(["ep-a", "ep-b", "ep-c"]);
  });

  it("sets nextEpisode to the oldest (first, by season/number) episode in the group", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-late", 2, 1), makeEpisode("ep-early", 1, 1)]);
    expect(groups[0].nextEpisode.id).toBe("ep-early");
  });

  it("preserves group order by first-encountered episode (already urgency-ordered input)", () => {
    const groups = groupOverdueBySeries([makeEpisode("ep-1", 1, 1, "series-urgent"), makeEpisode("ep-2", 1, 1, "series-later")]);
    expect(groups.map((g) => g.series.id)).toEqual(["series-urgent", "series-later"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(groupOverdueBySeries([])).toEqual([]);
  });
});
