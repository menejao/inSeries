import type { ActivityType, Prisma, Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { incrementActivitiesCreated } from "@/lib/metrics/service";
import { getMutedIds } from "@/lib/social/mute";
import { getBlockedEitherWayIds } from "@/lib/social/block";

type CreateActivityInput = {
  userId: string;
  type: ActivityType;
  seriesId?: string;
  episodeId?: string;
  reviewId?: string;
  listId?: string;
  commentId?: string;
  targetUserId?: string;
  metadata?: Prisma.InputJsonValue;
  visibility?: Visibility;
};

export async function recordActivity(input: CreateActivityInput) {
  const activity = await prisma.activity.create({
    data: {
      userId: input.userId,
      type: input.type,
      seriesId: input.seriesId,
      episodeId: input.episodeId,
      reviewId: input.reviewId,
      listId: input.listId,
      commentId: input.commentId,
      targetUserId: input.targetUserId,
      metadata: input.metadata,
      visibility: input.visibility ?? "PUBLIC"
    }
  });
  incrementActivitiesCreated();
  return activity;
}

export async function syncActivityVisibility(
  where: { reviewId: string } | { listId: string },
  visibility: Visibility
) {
  await prisma.activity.updateMany({ where, data: { visibility } });
}

const activityInclude = {
  user: { select: { id: true, name: true, username: true, avatarUrl: true } },
  series: { select: { id: true, slug: true, title: true, posterUrl: true } },
  episode: {
    select: {
      id: true,
      title: true,
      number: true,
      season: { select: { number: true } }
    }
  },
  review: {
    select: {
      id: true,
      rating: true,
      body: true,
      seriesId: true,
      containsSpoiler: true,
      _count: { select: { comments: true } }
    }
  },
  list: { select: { id: true, title: true } },
  comment: { select: { id: true, body: true, reviewId: true, parentId: true } },
  targetUser: { select: { id: true, username: true, name: true } },
  // Fase 25/27/28 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — curtidas/comentarios ficam
  // disponiveis em todo card de atividade, sem query extra por card.
  _count: { select: { likes: true, activityComments: true } }
} satisfies Prisma.ActivityInclude;

export type ActivityFeedItem = Prisma.ActivityGetPayload<{ include: typeof activityInclude }> & { likedByViewer: boolean };

function typeVisibilityBranches(selfUserId?: string) {
  const branches: Prisma.ActivityWhereInput[] = [
    { type: "EPISODE_WATCHED", user: { isProfilePrivate: false, showActivity: true, showWatchedSeries: true } },
    { type: "SERIES_STATUS_CHANGED", user: { isProfilePrivate: false, showActivity: true, showWatchingSeries: true } },
    { type: "SERIES_COMPLETED", user: { isProfilePrivate: false, showActivity: true, showWatchedSeries: true } },
    { type: "REVIEW_CREATED", user: { isProfilePrivate: false, showActivity: true, showReviews: true } },
    { type: "COMMENT_CREATED", user: { isProfilePrivate: false, showActivity: true, showReviews: true } },
    { type: "LIST_CREATED", user: { isProfilePrivate: false, showActivity: true, showLists: true } },
    { type: "USER_FOLLOWED", user: { isProfilePrivate: false, showActivity: true } }
  ];

  return selfUserId ? [...branches, { userId: selfUserId }] : branches;
}

/** Anexa `likedByViewer` (1 query em lote, nunca por card) e mantem a mesma forma de sempre. */
async function withLikedByViewer(
  activities: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>[],
  viewerId?: string | null
): Promise<ActivityFeedItem[]> {
  if (!viewerId || !activities.length) {
    return activities.map((activity) => ({ ...activity, likedByViewer: false }));
  }

  const liked = await prisma.activityLike.findMany({
    where: { userId: viewerId, activityId: { in: activities.map((activity) => activity.id) } },
    select: { activityId: true }
  });
  const likedIds = new Set(liked.map((row) => row.activityId));

  return activities.map((activity) => ({ ...activity, likedByViewer: likedIds.has(activity.id) }));
}

async function excludedAuthorIds(viewerId?: string | null) {
  if (!viewerId) return [];
  const [muted, blocked] = await Promise.all([getMutedIds(viewerId), getBlockedEitherWayIds(viewerId)]);
  return [...muted, ...blocked];
}

export async function getGlobalFeed(viewerId?: string | null, limit = 30): Promise<ActivityFeedItem[]> {
  const excluded = await excludedAuthorIds(viewerId);
  const activities = await prisma.activity.findMany({
    where: {
      visibility: "PUBLIC",
      OR: typeVisibilityBranches(viewerId ?? undefined),
      ...(excluded.length ? { userId: { notIn: excluded } } : {})
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return withLikedByViewer(activities, viewerId);
}

/** Fase 20 — "Para voce": atividades proprias + de quem o usuario segue (rankeado cronologicamente por ora). */
export async function getPersonalFeed(userId: string, limit = 30): Promise<ActivityFeedItem[]> {
  const [following, excluded] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    excludedAuthorIds(userId)
  ]);
  const relevantIds = [userId, ...following.map((item) => item.followingId)].filter((id) => !excluded.includes(id));

  const activities = await prisma.activity.findMany({
    where: {
      userId: { in: relevantIds },
      visibility: "PUBLIC",
      OR: typeVisibilityBranches(userId)
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return withLikedByViewer(activities, userId);
}

/**
 * Fase 21 — "Seguindo": exclusivamente atividades de quem o usuario segue (nunca as proprias),
 * cronologico, sem silenciados/bloqueados.
 */
export async function getFollowingFeed(userId: string, limit = 30): Promise<ActivityFeedItem[]> {
  const [following, excluded] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    excludedAuthorIds(userId)
  ]);
  const followingIds = following.map((item) => item.followingId).filter((id) => !excluded.includes(id));

  if (!followingIds.length) return [];

  const activities = await prisma.activity.findMany({
    where: {
      userId: { in: followingIds },
      visibility: "PUBLIC",
      OR: typeVisibilityBranches()
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return withLikedByViewer(activities, userId);
}

export async function getRecentActivityForUser(userId: string, limit = 5): Promise<ActivityFeedItem[]> {
  const activities = await prisma.activity.findMany({
    where: { userId },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return withLikedByViewer(activities, userId);
}

export async function getProfileActivity(
  profileUserId: string,
  viewerId: string | null,
  limit = 20
): Promise<ActivityFeedItem[]> {
  if (viewerId === profileUserId) {
    return getRecentActivityForUser(profileUserId, limit);
  }

  const activities = await prisma.activity.findMany({
    where: {
      userId: profileUserId,
      visibility: "PUBLIC",
      OR: typeVisibilityBranches()
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return withLikedByViewer(activities, viewerId);
}
