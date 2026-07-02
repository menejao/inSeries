import { prisma } from "@/lib/db/prisma";

const publicSelect = {
  id: true,
  name: true,
  username: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
  isProfilePrivate: true,
  showWatchedSeries: true,
  showWatchingSeries: true,
  showLists: true,
  showReviews: true,
  showActivity: true,
  _count: { select: { followers: true, following: true } }
} as const;

export async function getProfileByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: publicSelect
  });
}

export async function isFollowing(followerId: string, followingId: string) {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } }
  });
  return Boolean(follow);
}

export async function getWatchStateSeries(userId: string, state: "WATCHING" | "COMPLETED") {
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId, state },
    include: { series: true },
    orderBy: { updatedAt: "desc" },
    take: 12
  });

  return statuses.map((status) => status.series);
}

export async function getPublicListsForUser(userId: string) {
  return prisma.list.findMany({
    where: { userId, visibility: "PUBLIC" },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getPublicReviewsForUser(userId: string) {
  return prisma.review.findMany({
    where: { userId, visibility: "PUBLIC" },
    include: { series: { select: { id: true, slug: true, title: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12
  });
}
