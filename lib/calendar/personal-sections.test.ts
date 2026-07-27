import { describe, expect, it } from "vitest";
import { groupByWeekday, groupFutureSeasonsByYear, getCalendarEpisodeStatus } from "@/lib/calendar/personal-sections";
import type { CalendarEpisode, FutureSeason } from "@/lib/calendar/queries";

function makeEpisode(overrides: Partial<CalendarEpisode> = {}): CalendarEpisode {
  return {
    id: "ep-1",
    title: "Episode",
    number: 1,
    seasonNumber: 1,
    airedAt: new Date("2026-07-27T12:00:00Z"),
    watched: false,
    watchedAt: null,
    stillUrl: null,
    userState: "WATCHING",
    series: { id: "s1", slug: "s1", title: "Serie", posterUrl: null, backdropUrl: null },
    ...overrides
  } as CalendarEpisode;
}

function makeSeason(overrides: Partial<FutureSeason> = {}): FutureSeason {
  return {
    seasonId: "season-1",
    seasonNumber: 2,
    seasonTitle: "Temporada 2",
    airYear: 2026,
    series: { id: "s1", slug: "s1", title: "Serie", posterUrl: null },
    ...overrides
  };
}

describe("groupByWeekday", () => {
  it("groups consecutive episodes airing on the same calendar day", () => {
    const groups = groupByWeekday([
      makeEpisode({ id: "a", airedAt: new Date("2026-07-27T10:00:00") }),
      makeEpisode({ id: "b", airedAt: new Date("2026-07-27T20:00:00") }),
      makeEpisode({ id: "c", airedAt: new Date("2026-07-28T10:00:00") })
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].episodes).toHaveLength(2);
    expect(groups[1].episodes).toHaveLength(1);
  });

  it("returns an empty array for an empty input", () => {
    expect(groupByWeekday([])).toEqual([]);
  });
});

describe("groupFutureSeasonsByYear", () => {
  it("groups by airYear, ascending", () => {
    const groups = groupFutureSeasonsByYear([makeSeason({ airYear: 2027 }), makeSeason({ airYear: 2026 })]);
    expect(groups.map((g) => g.label)).toEqual(["2026", "2027"]);
  });

  it("puts seasons without a known year in a separate 'Sem previsao' group, last", () => {
    const groups = groupFutureSeasonsByYear([makeSeason({ airYear: null }), makeSeason({ airYear: 2026 })]);
    expect(groups.map((g) => g.label)).toEqual(["2026", "Sem previsao"]);
  });
});

describe("getCalendarEpisodeStatus", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("returns 'assistido' when watched, regardless of date", () => {
    expect(getCalendarEpisodeStatus(makeEpisode({ watched: true, airedAt: new Date("2026-07-20") }), now)).toBe("assistido");
  });

  it("returns 'hoje' for an unwatched episode airing today", () => {
    expect(getCalendarEpisodeStatus(makeEpisode({ airedAt: new Date("2026-07-27T08:00:00Z") }), now)).toBe("hoje");
  });

  it("returns 'atrasado' for an unwatched episode aired in the past", () => {
    expect(getCalendarEpisodeStatus(makeEpisode({ airedAt: new Date("2026-07-20") }), now)).toBe("atrasado");
  });

  it("returns 'em-breve' for an unwatched episode airing in the future", () => {
    expect(getCalendarEpisodeStatus(makeEpisode({ airedAt: new Date("2026-08-01") }), now)).toBe("em-breve");
  });
});
