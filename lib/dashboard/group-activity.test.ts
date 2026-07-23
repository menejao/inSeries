import { describe, expect, it } from "vitest";
import { groupRecentActivity } from "@/lib/dashboard/group-activity";
import type { ActivityFeedItem } from "@/lib/social/activity";

const now = new Date("2026-07-21T12:00:00Z");

function makeActivity(overrides: Partial<ActivityFeedItem> = {}): ActivityFeedItem {
  return {
    id: `act-${Math.random()}`,
    createdAt: now,
    type: "EPISODE_WATCHED",
    series: { id: "series-1", slug: "serie-1", title: "Serie Um", posterUrl: null },
    episode: { id: "ep-1", title: "Ep", number: 1, season: { number: 1 } },
    targetUser: null,
    comment: null,
    review: null,
    list: null,
    ...overrides
  } as unknown as ActivityFeedItem;
}

describe("groupRecentActivity", () => {
  it("merges consecutive EPISODE_WATCHED activities for the same series into one group", () => {
    const groups = groupRecentActivity([
      makeActivity({ episode: { id: "e3", title: "E3", number: 3, season: { number: 1 } } } as never),
      makeActivity({ episode: { id: "e2", title: "E2", number: 2, season: { number: 1 } } } as never),
      makeActivity({ episode: { id: "e1", title: "E1", number: 1, season: { number: 1 } } } as never)
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].label).toBe("Voce assistiu 3 episodios de Serie Um");
    expect(groups[0].contextLabel).toBe("T01E01 ate T01E03");
  });

  it("does not merge activities from different series", () => {
    const groups = groupRecentActivity([
      makeActivity({ series: { id: "series-a", slug: "a", title: "A", posterUrl: null } as never }),
      makeActivity({ series: { id: "series-b", slug: "b", title: "B", posterUrl: null } as never })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toContain("A");
    expect(groups[1].label).toContain("B");
  });

  it("does not merge non-consecutive activities of the same series (interrupted by a different one)", () => {
    const groups = groupRecentActivity([
      makeActivity({ episode: { id: "e2", title: "E2", number: 2, season: { number: 1 } } } as never),
      makeActivity({ type: "REVIEW_CREATED" } as never),
      makeActivity({ episode: { id: "e1", title: "E1", number: 1, season: { number: 1 } } } as never)
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0].type).toBe("EPISODE_WATCHED");
    expect(groups[1].type).toBe("REVIEW_CREATED");
    expect(groups[2].type).toBe("EPISODE_WATCHED");
  });

  it("uses singular wording for a single-item group", () => {
    const groups = groupRecentActivity([makeActivity()]);
    expect(groups[0].label).toBe("Voce assistiu 1 episodio de Serie Um");
    expect(groups[0].contextLabel).toBeNull();
  });

  it("groups USER_FOLLOWED by target user", () => {
    const groups = groupRecentActivity([
      makeActivity({ type: "USER_FOLLOWED", targetUser: { id: "u1", username: "joana", name: "Joana" } } as never)
    ]);
    expect(groups[0].label).toBe("Voce comecou a seguir Joana");
    expect(groups[0].href).toBe("/profile/joana");
  });

  it("pluralizes USER_FOLLOWED when consecutive follows target different people but stay ungrouped (different key)", () => {
    const groups = groupRecentActivity([
      makeActivity({ type: "USER_FOLLOWED", targetUser: { id: "u1", username: "a", name: "A" } } as never),
      makeActivity({ type: "USER_FOLLOWED", targetUser: { id: "u2", username: "b", name: "B" } } as never)
    ]);
    expect(groups).toHaveLength(2);
  });

  it("returns an empty array for an empty input", () => {
    expect(groupRecentActivity([])).toEqual([]);
  });

  it("handles SERIES_COMPLETED with the correct label", () => {
    const groups = groupRecentActivity([makeActivity({ type: "SERIES_COMPLETED" } as never)]);
    expect(groups[0].label).toBe("Voce concluiu Serie Um");
  });

  it("handles LIST_CREATED grouping consecutively even without a series", () => {
    const groups = groupRecentActivity([
      makeActivity({ type: "LIST_CREATED", series: null } as never),
      makeActivity({ type: "LIST_CREATED", series: null } as never)
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Voce criou 2 listas");
  });
});
