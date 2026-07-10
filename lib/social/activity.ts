import type { ActivityType, Prisma, Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { incrementActivitiesCreated } from "@/lib/metrics/service";

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
  targetUser: { select: { id: true, username: true, name: true } }
} satisfies Prisma.ActivityInclude;

export type ActivityFeedItem = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

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

export async function getGlobalFeed(viewerId?: string | null, limit = 30): Promise<ActivityFeedItem[]> {
  return prisma.activity.findMany({
    where: {
      visibility: "PUBLIC",
      OR: typeVisibilityBranches(viewerId ?? undefined)
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function getPersonalFeed(userId: string, limit = 30): Promise<ActivityFeedItem[]> {
  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const relevantIds = [userId, ...following.map((item) => item.followingId)];

  return prisma.activity.findMany({
    where: {
      userId: { in: relevantIds },
      visibility: "PUBLIC",
      OR: typeVisibilityBranches(userId)
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function getRecentActivityForUser(userId: string, limit = 5): Promise<ActivityFeedItem[]> {
  return prisma.activity.findMany({
    where: { userId },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function getProfileActivity(
  profileUserId: string,
  viewerId: string | null,
  limit = 20
): Promise<ActivityFeedItem[]> {
  if (viewerId === profileUserId) {
    return getRecentActivityForUser(profileUserId, limit);
  }

  return prisma.activity.findMany({
    where: {
      userId: profileUserId,
      visibility: "PUBLIC",
      OR: typeVisibilityBranches()
    },
    include: activityInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
