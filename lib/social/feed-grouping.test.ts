import { describe, expect, it } from "vitest";
import { groupConsecutiveEpisodes } from "@/lib/social/feed-grouping";
import type { ActivityFeedItem } from "@/lib/social/activity";

const user1 = { id: "u1", name: "Joao", username: "joao", avatarUrl: null };
const user2 = { id: "u2", name: "Maria", username: "maria", avatarUrl: null };
const seriesA = { id: "s1", slug: "slime", title: "That Time I Got Reincarnated as a Slime", posterUrl: null };
const seriesB = { id: "s2", slug: "other", title: "Other Series", posterUrl: null };

function makeActivity(overrides: Partial<Record<string, unknown>> = {}): ActivityFeedItem {
  return {
    id: `act-${Math.random()}`,
    type: "EPISODE_WATCHED",
    userId: user1.id,
    user: user1,
    series: seriesA,
    seriesId: seriesA.id,
    episode: { id: "ep-1", title: "Ep", number: 1, season: { number: 4 } },
    episodeId: "ep-1",
    review: null,
    reviewId: null,
    list: null,
    listId: null,
    comment: null,
    commentId: null,
    targetUser: null,
    targetUserId: null,
    metadata: null,
    visibility: "PUBLIC",
    createdAt: new Date("2026-07-30T10:00:00Z"),
    updatedAt: new Date("2026-07-30T10:00:00Z"),
    _count: { likes: 0, activityComments: 0 },
    likedByViewer: false,
    ...overrides
  } as unknown as ActivityFeedItem;
}

function episode(number: number, season = 4) {
  return { id: `ep-${number}`, title: `Ep ${number}`, number, season: { number: season } };
}

describe("groupConsecutiveEpisodes", () => {
  it("collapses consecutive episode-watched activities from the same user/series/season into one group", () => {
    const base = new Date("2026-07-30T10:00:00Z").getTime();
    const activities = Array.from({ length: 8 }, (_, index) =>
      makeActivity({ episode: episode(index + 1), createdAt: new Date(base - index * 60000) })
    );

    const entries = groupConsecutiveEpisodes(activities);

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("episode-group");
    if (entries[0].kind === "episode-group") {
      expect(entries[0].episodeNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(entries[0].seasonNumber).toBe(4);
    }
  });

  it("does not group a single episode — renders as a normal activity card", () => {
    const entries = groupConsecutiveEpisodes([makeActivity({ episode: episode(1) })]);
    expect(entries).toEqual([{ kind: "activity", activity: entries[0].kind === "activity" ? entries[0].activity : null }]);
  });

  it("breaks the group when another activity type interleaves, even from the same user", () => {
    const base = new Date("2026-07-30T10:00:00Z").getTime();
    const activities = [
      makeActivity({ episode: episode(2), createdAt: new Date(base) }),
      makeActivity({ type: "REVIEW_CREATED", episode: null, createdAt: new Date(base - 60000) }),
      makeActivity({ episode: episode(1), createdAt: new Date(base - 120000) })
    ];

    const entries = groupConsecutiveEpisodes(activities);
    expect(entries.map((entry) => entry.kind)).toEqual(["activity", "activity", "activity"]);
  });

  it("keeps different users' episodes of the same series in separate groups", () => {
    const base = new Date("2026-07-30T10:00:00Z").getTime();
    const activities = [
      makeActivity({ user: user1, userId: user1.id, episode: episode(1), createdAt: new Date(base) }),
      makeActivity({ user: user2, userId: user2.id, episode: episode(1), createdAt: new Date(base - 60000) }),
      makeActivity({ user: user1, userId: user1.id, episode: episode(2), createdAt: new Date(base - 120000) })
    ];

    const entries = groupConsecutiveEpisodes(activities);
    // user1 ep2 and user1 ep1 are not adjacent in the list (user2's activity interleaves), so no group forms.
    expect(entries.every((entry) => entry.kind === "activity")).toBe(true);
  });

  it("keeps different series from the same user in separate groups", () => {
    const base = new Date("2026-07-30T10:00:00Z").getTime();
    const activities = [
      makeActivity({ series: seriesA, seriesId: seriesA.id, episode: episode(1), createdAt: new Date(base) }),
      makeActivity({ series: seriesB, seriesId: seriesB.id, episode: episode(1), createdAt: new Date(base - 60000) })
    ];

    const entries = groupConsecutiveEpisodes(activities);
    expect(entries.every((entry) => entry.kind === "activity")).toBe(true);
  });

  it("breaks the group when the gap between episodes exceeds the grouping window", () => {
    const base = new Date("2026-07-30T10:00:00Z").getTime();
    const activities = [
      makeActivity({ episode: episode(2), createdAt: new Date(base) }),
      makeActivity({ episode: episode(1), createdAt: new Date(base - 4 * 60 * 60 * 1000) })
    ];

    const entries = groupConsecutiveEpisodes(activities);
    expect(entries.every((entry) => entry.kind === "activity")).toBe(true);
  });
});
