import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * Fase 5 (INSERIES-SOCIAL-FEED-01) — os 4 blocos de descoberta sao derivados EM MEMORIA do
 * mesmo batch de atividades que a lista principal do Feed ja buscou (getGlobalFeed), nunca
 * de uma query nova. Isso e o que garante, por construcao, que os blocos respeitam
 * integralmente a mesma privacidade ja aplicada pelas branches de `typeVisibilityBranches`
 * (lib/social/activity.ts) — nada aqui olha para `Review`/`Comment` diretamente.
 */

export type TrendingSeriesEntry = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  activityCount: number;
};

export function getTrendingSeries(activities: ActivityFeedItem[], limit = 6): TrendingSeriesEntry[] {
  const counts = new Map<string, { series: NonNullable<ActivityFeedItem["series"]>; count: number }>();

  for (const activity of activities) {
    if (!activity.series) continue;
    const existing = counts.get(activity.series.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(activity.series.id, { series: activity.series, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ series, count }) => ({ ...series, activityCount: count }));
}

export type FeaturedReview = {
  id: string;
  rating: number;
  body: string;
  containsSpoiler: boolean;
  commentCount: number;
  user: ActivityFeedItem["user"];
  series: NonNullable<ActivityFeedItem["series"]>;
};

export function getFeaturedReviews(activities: ActivityFeedItem[], limit = 4): FeaturedReview[] {
  const seen = new Set<string>();
  const reviews: FeaturedReview[] = [];

  for (const activity of activities) {
    if (activity.type !== "REVIEW_CREATED" || !activity.review || !activity.series) continue;
    if (seen.has(activity.review.id)) continue;
    seen.add(activity.review.id);

    reviews.push({
      id: activity.review.id,
      rating: activity.review.rating,
      body: activity.review.body,
      containsSpoiler: activity.review.containsSpoiler,
      commentCount: activity.review._count.comments,
      user: activity.user,
      series: activity.series
    });
  }

  return reviews.sort((a, b) => b.commentCount - a.commentCount || b.rating - a.rating).slice(0, limit);
}

export type RecentDiscussion = {
  id: string;
  body: string;
  createdAt: Date;
  user: ActivityFeedItem["user"];
  series: ActivityFeedItem["series"];
};

export function getRecentDiscussions(activities: ActivityFeedItem[], limit = 4): RecentDiscussion[] {
  // `activities` ja vem ordenado por `createdAt desc` (getGlobalFeed/getPersonalFeed) —
  // filtrar preserva a ordem, sem precisar reordenar.
  return activities
    .filter((activity): activity is ActivityFeedItem & { comment: NonNullable<ActivityFeedItem["comment"]> } =>
      activity.type === "COMMENT_CREATED" && Boolean(activity.comment)
    )
    .slice(0, limit)
    .map((activity) => ({
      id: activity.comment.id,
      body: activity.comment.body,
      createdAt: activity.createdAt,
      user: activity.user,
      series: activity.series
    }));
}

export type ActiveUser = ActivityFeedItem["user"] & { activityCount: number };

export function getActiveUsers(activities: ActivityFeedItem[], limit = 6): ActiveUser[] {
  const counts = new Map<string, { user: ActivityFeedItem["user"]; count: number }>();

  for (const activity of activities) {
    const existing = counts.get(activity.user.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(activity.user.id, { user: activity.user, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ user, count }) => ({ ...user, activityCount: count }));
}
