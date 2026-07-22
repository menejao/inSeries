import { describe, expect, it } from "vitest";
import { splitContinueWatchingByProgress } from "@/lib/dashboard/continue-watching-priority";
import type { ContinueWatchingItem } from "@/lib/continue-watching";

function makeItem(episodeId: string, seriesProgressPercent: number): ContinueWatchingItem {
  return { episode: { id: episodeId }, seriesProgressPercent } as unknown as ContinueWatchingItem;
}

describe("splitContinueWatchingByProgress", () => {
  it("puts items with progress above 0% in started", () => {
    const result = splitContinueWatchingByProgress([makeItem("ep-a", 42)]);
    expect(result.started.map((item) => item.episode.id)).toEqual(["ep-a"]);
    expect(result.notStarted).toHaveLength(0);
  });

  it("puts items with exactly 0% progress in notStarted", () => {
    const result = splitContinueWatchingByProgress([makeItem("ep-a", 0)]);
    expect(result.notStarted.map((item) => item.episode.id)).toEqual(["ep-a"]);
    expect(result.started).toHaveLength(0);
  });

  it("splits a mixed list, preserving relative order within each group", () => {
    const result = splitContinueWatchingByProgress([makeItem("ep-a", 10), makeItem("ep-b", 0), makeItem("ep-c", 55), makeItem("ep-d", 0)]);

    expect(result.started.map((item) => item.episode.id)).toEqual(["ep-a", "ep-c"]);
    expect(result.notStarted.map((item) => item.episode.id)).toEqual(["ep-b", "ep-d"]);
  });

  it("returns two empty arrays for an empty input", () => {
    expect(splitContinueWatchingByProgress([])).toEqual({ started: [], notStarted: [] });
  });
});
