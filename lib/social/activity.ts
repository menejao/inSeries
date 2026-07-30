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
  list: {
    select: {
      id: true,
      title: true,
      _count: { select: { items: true } },
      items: {
        take: 4,
        orderBy: { position: "asc" },
        select: { series: { select: { id: true, posterUrl: true, title: true } } }
      }
    }
  },
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

export type FeedPage = { items: ActivityFeedItem[]; nextCursor: string | null };

/**
 * INSERIES-FEED-REDESIGN-01 — real cursor pagination (id-based, tie-broken with the already
 * unique `id`) replaces the old "fetch 150 then slice in memory" approach: only `limit` rows
 * ever leave the database per request, and `nextCursor` (the last row's id, or null once
 * exhausted) is what the client sends back to fetch the next page — see app/api/feed/route.ts.
 */
async function paginate(where: Prisma.ActivityWhereInput, limit: number, cursor?: string | null) {
  return prisma.activity.findMany({
    where,
    include: activityInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });
}

function toFeedPage(rows: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function getGlobalFeed(viewerId?: string | null, limit = 20, cursor?: string | null): Promise<FeedPage> {
  const excluded = await excludedAuthorIds(viewerId);
  const rows = await paginate(
    {
      visibility: "PUBLIC",
      OR: typeVisibilityBranches(viewerId ?? undefined),
      ...(excluded.length ? { userId: { notIn: excluded } } : {})
    },
    limit,
    cursor
  );
  const { items, nextCursor } = toFeedPage(rows, limit);
  return { items: await withLikedByViewer(items, viewerId), nextCursor };
}

/** Fase 20 — "Para voce": atividades proprias + de quem o usuario segue (rankeado cronologicamente por ora). */
export async function getPersonalFeed(userId: string, limit = 20, cursor?: string | null): Promise<FeedPage> {
  const [following, excluded] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    excludedAuthorIds(userId)
  ]);
  const relevantIds = [userId, ...following.map((item) => item.followingId)].filter((id) => !excluded.includes(id));

  const rows = await paginate(
    { userId: { in: relevantIds }, visibility: "PUBLIC", OR: typeVisibilityBranches(userId) },
    limit,
    cursor
  );
  const { items, nextCursor } = toFeedPage(rows, limit);
  return { items: await withLikedByViewer(items, userId), nextCursor };
}

/**
 * Fase 21 — "Seguindo": exclusivamente atividades de quem o usuario segue (nunca as proprias),
 * cronologico, sem silenciados/bloqueados.
 */
export async function getFollowingFeed(userId: string, limit = 20, cursor?: string | null): Promise<FeedPage> {
  const [following, excluded] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    excludedAuthorIds(userId)
  ]);
  const followingIds = following.map((item) => item.followingId).filter((id) => !excluded.includes(id));

  if (!followingIds.length) return { items: [], nextCursor: null };

  const rows = await paginate(
    { userId: { in: followingIds }, visibility: "PUBLIC", OR: typeVisibilityBranches() },
    limit,
    cursor
  );
  const { items, nextCursor } = toFeedPage(rows, limit);
  return { items: await withLikedByViewer(items, userId), nextCursor };
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
