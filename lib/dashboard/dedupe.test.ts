import { describe, expect, it } from "vitest";
import { dedupeDashboardEpisodes } from "@/lib/dashboard/dedupe";
import type { ContinueWatchingItem } from "@/lib/continue-watching";
import type { CalendarEpisode } from "@/lib/calendar/queries";

const now = new Date("2026-07-21T12:00:00Z");

function makeCalendarEpisode(id: string, overrides: Partial<CalendarEpisode> = {}): CalendarEpisode {
  return {
    id,
    title: `Episodio ${id}`,
    number: 1,
    seasonNumber: 1,
    airedAt: now,
    watched: false,
    watchedAt: null,
    stillUrl: null,
    userState: "WATCHING",
    series: { id: "series-1", slug: "serie-1", title: "Serie 1", posterUrl: null, backdropUrl: null },
    ...overrides
  };
}

function makeContinueWatchingItem(episodeId: string): ContinueWatchingItem {
  return { episode: { id: episodeId } } as unknown as ContinueWatchingItem;
}

describe("dedupeDashboardEpisodes", () => {
  it("removes an episode from sinceLastVisit when it's already in Continuar Assistindo", () => {
    const result = dedupeDashboardEpisodes({
      continueWatching: [makeContinueWatchingItem("ep-shared")],
      sinceLastVisit: [makeCalendarEpisode("ep-shared"), makeCalendarEpisode("ep-new")],
      overdue: []
    });

    expect(result.sinceLastVisit.map((ep) => ep.id)).toEqual(["ep-new"]);
  });

  it("removes an episode from overdue when it's already in Continuar Assistindo", () => {
    const result = dedupeDashboardEpisodes({
      continueWatching: [makeContinueWatchingItem("ep-shared")],
      sinceLastVisit: [],
      overdue: [makeCalendarEpisode("ep-shared"), makeCalendarEpisode("ep-overdue")]
    });

    expect(result.overdue.map((ep) => ep.id)).toEqual(["ep-overdue"]);
  });

  it("preserves items that don't overlap with Continuar Assistindo", () => {
    const result = dedupeDashboardEpisodes({
      continueWatching: [makeContinueWatchingItem("ep-other-series")],
      sinceLastVisit: [makeCalendarEpisode("ep-new")],
      overdue: [makeCalendarEpisode("ep-overdue")]
    });

    expect(result.sinceLastVisit).toHaveLength(1);
    expect(result.overdue).toHaveLength(1);
  });

  it("dedupes against multiple continue-watching items at once", () => {
    const result = dedupeDashboardEpisodes({
      continueWatching: [makeContinueWatchingItem("ep-a"), makeContinueWatchingItem("ep-b")],
      sinceLastVisit: [makeCalendarEpisode("ep-a"), makeCalendarEpisode("ep-c")],
      overdue: [makeCalendarEpisode("ep-b"), makeCalendarEpisode("ep-d")]
    });

    expect(result.sinceLastVisit.map((ep) => ep.id)).toEqual(["ep-c"]);
    expect(result.overdue.map((ep) => ep.id)).toEqual(["ep-d"]);
  });

  it("returns empty arrays unchanged when there's nothing to dedupe against", () => {
    const result = dedupeDashboardEpisodes({ continueWatching: [], sinceLastVisit: [], overdue: [] });
    expect(result).toEqual({ sinceLastVisit: [], overdue: [] });
  });
});
