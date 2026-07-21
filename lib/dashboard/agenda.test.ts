import { describe, expect, it, vi, afterEach } from "vitest";
import { groupUpcomingForAgenda } from "@/lib/dashboard/agenda";
import type { CalendarEpisode } from "@/lib/calendar/queries";

function makeEpisode(id: string, airedAt: Date): CalendarEpisode {
  return {
    id,
    title: `Episodio ${id}`,
    number: 1,
    seasonNumber: 1,
    airedAt,
    watched: false,
    watchedAt: null,
    stillUrl: null,
    userState: "WATCHING",
    series: { id: "series-1", slug: "serie-1", title: "Serie 1", posterUrl: null, backdropUrl: null }
  };
}

// Fixed "now": 2026-07-21 12:00 UTC (a Tuesday).
const NOW = new Date("2026-07-21T12:00:00Z");

describe("groupUpcomingForAgenda", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups an episode airing later today under 'hoje'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([makeEpisode("today-ep", new Date("2026-07-21T20:00:00Z"))]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("hoje");
    expect(groups[0].episodes.map((ep) => ep.id)).toEqual(["today-ep"]);
  });

  it("groups an episode airing tomorrow under 'amanha'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([makeEpisode("tomorrow-ep", new Date("2026-07-22T09:00:00Z"))]);
    expect(groups[0].key).toBe("amanha");
  });

  it("groups an episode airing 3 days out under 'estaSemana'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([makeEpisode("this-week-ep", new Date("2026-07-24T09:00:00Z"))]);
    expect(groups[0].key).toBe("estaSemana");
  });

  it("excludes episodes airing more than 7 days out entirely", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([makeEpisode("far-future", new Date("2026-08-15T09:00:00Z"))]);
    expect(groups).toHaveLength(0);
  });

  it("omits empty groups instead of returning them with 0 episodes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([makeEpisode("today-ep", new Date("2026-07-21T20:00:00Z"))]);
    expect(groups.some((g) => g.key === "amanha")).toBe(false);
    expect(groups.some((g) => g.key === "estaSemana")).toBe(false);
  });

  it("orders groups hoje -> amanha -> estaSemana when all 3 have episodes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([
      makeEpisode("week-ep", new Date("2026-07-25T09:00:00Z")),
      makeEpisode("today-ep", new Date("2026-07-21T20:00:00Z")),
      makeEpisode("tomorrow-ep", new Date("2026-07-22T09:00:00Z"))
    ]);
    expect(groups.map((g) => g.key)).toEqual(["hoje", "amanha", "estaSemana"]);
  });

  it("caps total visible episodes at 4 and reports the overflow as hiddenCount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // Deliberately mid-week (23rd-25th), away from the 7-day boundary itself - the exact edge
    // day is timezone-sensitive (startOfDay/addDays zero out *local* time), which isn't what
    // this test is about.
    const weekEpisodes = Array.from({ length: 6 }, (_, i) => makeEpisode(`week-${i}`, new Date(`2026-07-2${3 + (i % 3)}T09:00:00Z`)));
    const groups = groupUpcomingForAgenda(weekEpisodes);
    const total = groups.reduce((sum, g) => sum + g.episodes.length, 0);
    const hidden = groups.reduce((sum, g) => sum + g.hiddenCount, 0);
    expect(total).toBe(4);
    expect(hidden).toBe(2);
  });

  it("spends the visible-episode budget on earlier groups first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const groups = groupUpcomingForAgenda([
      makeEpisode("today-1", new Date("2026-07-21T14:00:00Z")),
      makeEpisode("today-2", new Date("2026-07-21T16:00:00Z")),
      makeEpisode("today-3", new Date("2026-07-21T18:00:00Z")),
      makeEpisode("week-1", new Date("2026-07-24T09:00:00Z")),
      makeEpisode("week-2", new Date("2026-07-25T09:00:00Z"))
    ]);
    const hoje = groups.find((g) => g.key === "hoje")!;
    const estaSemana = groups.find((g) => g.key === "estaSemana")!;
    expect(hoje.episodes).toHaveLength(3);
    expect(hoje.hiddenCount).toBe(0);
    expect(estaSemana.episodes).toHaveLength(1);
    expect(estaSemana.hiddenCount).toBe(1);
  });

  it("returns no groups for an empty input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(groupUpcomingForAgenda([])).toEqual([]);
  });
});
