import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/gamification/achievements";
import type { AchievementEvalContext } from "@/lib/gamification/types";

const BASE_CONTEXT: AchievementEvalContext = {
  userId: "u1",
  episodesWatchedCount: 0,
  hoursWatched: 0,
  genreEpisodeCounts: {},
  longestStreakDays: 0,
  seriesCompletedCount: 0,
  reviewsCount: 0,
  listsCount: 0,
  followingCount: 0
};

describe("ACHIEVEMENT_DEFINITIONS", () => {
  it("has no duplicate slugs", () => {
    const slugs = ACHIEVEMENT_DEFINITIONS.map((definition) => definition.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every definition has a positive target and points", () => {
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      expect(definition.target).toBeGreaterThan(0);
      expect(definition.points).toBeGreaterThan(0);
    }
  });

  it("metric(context) >= target correctly gates unlock (episodes-100 example)", () => {
    const definition = ACHIEVEMENT_DEFINITIONS.find((d) => d.slug === "hundred-episodes");
    expect(definition).toBeDefined();
    expect(definition!.metric({ ...BASE_CONTEXT, episodesWatchedCount: 99 })).toBeLessThan(definition!.target);
    expect(definition!.metric({ ...BASE_CONTEXT, episodesWatchedCount: 100 })).toBeGreaterThanOrEqual(definition!.target);
  });

  it("long-term tiers exist for every ticket-mandated track", () => {
    const slugs = new Set(ACHIEVEMENT_DEFINITIONS.map((d) => d.slug));
    for (const slug of [
      "episodes-500",
      "episodes-1000",
      "episodes-5000",
      "series-completed-25",
      "series-completed-100",
      "series-completed-250",
      "hours-10",
      "hours-500",
      "hours-1000",
      "hours-5000",
      "reviews-10",
      "reviews-50",
      "reviews-100",
      "lists-10",
      "lists-25",
      "streak-100",
      "streak-365"
    ]) {
      expect(slugs.has(slug)).toBe(true);
    }
  });
});
