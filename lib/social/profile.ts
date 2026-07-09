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

/**
 * Fase 1/6 (INSERIES-PROFILE-PREMIUM-01) — aditivo: alem da serie, agora tambem devolve
 * `completionPercent`/`lastActivityAt` (ja existiam em `UserSeriesStatus`, so nao eram
 * selecionados). Unico consumidor e a pagina de perfil; nenhuma assinatura publica quebrada.
 */
export async function getWatchStateSeries(userId: string, state: "WATCHING" | "COMPLETED") {
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId, state },
    include: { series: true },
    orderBy: { updatedAt: "desc" },
    take: 12
  });

  return statuses.map((status) => ({
    ...status.series,
    completionPercent: status.completionPercent,
    lastActivityAt: status.lastActivityAt
  }));
}

export async function getPublicListsForUser(userId: string) {
  return prisma.list.findMany({
    where: { userId, visibility: "PUBLIC", hiddenByAdminAt: null },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

/** Fase 1/5 (INSERIES-PROFILE-PREMIUM-01) — `posterUrl` aditivo, para as novas secoes "Favoritas"/"Reviews recentes" mostrarem o poster sem uma query extra. */
export async function getPublicReviewsForUser(userId: string) {
  return prisma.review.findMany({
    where: { userId, visibility: "PUBLIC", hiddenByAdminAt: null },
    include: { series: { select: { id: true, slug: true, title: true, posterUrl: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12
  });
}
