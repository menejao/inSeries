import { prisma } from "@/lib/db/prisma";
import { getBlockedEitherWayIds } from "@/lib/social/block";
import type { FollowState } from "@/lib/social/follow";

const rowSelect = { id: true, name: true, username: true, avatarUrl: true } as const;

export type SocialListRow = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  followState: FollowState;
  followsViewer: boolean;
  mutualSeriesCount: number;
};

/** Series em comum entre dois usuarios (WATCHING/COMPLETED em ambos) — usado nas listas sociais e no Explorar pessoas. */
async function mutualSeriesCounts(viewerId: string, otherIds: string[]): Promise<Map<string, number>> {
  if (!otherIds.length) return new Map();

  const viewerSeries = await prisma.userSeriesStatus.findMany({
    where: { userId: viewerId, state: { in: ["WATCHING", "COMPLETED"] } },
    select: { seriesId: true }
  });
  const viewerSeriesIds = viewerSeries.map((row) => row.seriesId);
  if (!viewerSeriesIds.length) return new Map();

  const rows = await prisma.userSeriesStatus.groupBy({
    by: ["userId"],
    where: { userId: { in: otherIds }, seriesId: { in: viewerSeriesIds }, state: { in: ["WATCHING", "COMPLETED"] } },
    _count: { seriesId: true }
  });

  return new Map(rows.map((row) => [row.userId, row._count.seriesId]));
}

async function withRelationshipState(viewerId: string | null, rows: { id: string; name: string; username: string; avatarUrl: string | null }[]): Promise<SocialListRow[]> {
  if (!rows.length) return [];
  if (!viewerId) {
    return rows.map((row) => ({ ...row, followState: "none" as const, followsViewer: false, mutualSeriesCount: 0 }));
  }

  const ids = rows.map((row) => row.id);
  const [followedByViewer, followsViewer, pendingRequests, mutuals] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followerId: { in: ids }, followingId: viewerId }, select: { followerId: true } }),
    prisma.followRequest.findMany({ where: { requesterId: viewerId, targetId: { in: ids }, status: "PENDING" }, select: { targetId: true } }),
    mutualSeriesCounts(viewerId, ids)
  ]);
  const followedSet = new Set(followedByViewer.map((row) => row.followingId));
  const followsSet = new Set(followsViewer.map((row) => row.followerId));
  const pendingSet = new Set(pendingRequests.map((row) => row.targetId));

  return rows.map((row) => ({
    ...row,
    followState: followedSet.has(row.id) ? "following" : pendingSet.has(row.id) ? "requested" : "none",
    followsViewer: followsSet.has(row.id),
    mutualSeriesCount: mutuals.get(row.id) ?? 0
  }));
}

/** Fase 10 — lista de quem `profileUserId` segue, com busca por nome/username. */
export async function listFollowing(profileUserId: string, viewerId: string | null, q?: string) {
  const blockedIds = viewerId ? await getBlockedEitherWayIds(viewerId) : [];

  const rows = await prisma.follow.findMany({
    where: {
      followerId: profileUserId,
      followingId: blockedIds.length ? { notIn: blockedIds } : undefined,
      following: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }
        : undefined
    },
    include: { following: { select: rowSelect } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return withRelationshipState(viewerId, rows.map((row) => row.following));
}

/** Fase 11 — lista de quem segue `profileUserId`, com busca por nome/username. */
export async function listFollowers(profileUserId: string, viewerId: string | null, q?: string) {
  const blockedIds = viewerId ? await getBlockedEitherWayIds(viewerId) : [];

  const rows = await prisma.follow.findMany({
    where: {
      followingId: profileUserId,
      followerId: blockedIds.length ? { notIn: blockedIds } : undefined,
      follower: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }
        : undefined
    },
    include: { follower: { select: rowSelect } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return withRelationshipState(viewerId, rows.map((row) => row.follower));
}
