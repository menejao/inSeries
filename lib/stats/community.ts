import { prisma } from "@/lib/db/prisma";
import type { CommunityComparison } from "@/lib/stats/types";

/**
 * INSERIES-STATISTICS-ENGINE-01 — "Comparacao com a comunidade": purely aggregate counts,
 * never another user's identity or personal data — one groupBy over episode counts per user.
 */
export async function computeCommunityComparison(userId: string, myEpisodesWatched: number): Promise<CommunityComparison> {
  const grouped = await prisma.userEpisodeProgress.groupBy({
    by: ["userId"],
    where: { watched: true },
    _count: { _all: true }
  });

  if (grouped.length <= 1) {
    return { episodesPercentile: null, ratioToAverage: null };
  }

  const others = grouped.filter((row) => row.userId !== userId);
  const usersWithFewer = others.filter((row) => row._count._all < myEpisodesWatched).length;
  const episodesPercentile = others.length ? Math.round((usersWithFewer / others.length) * 100) : null;

  const averageEpisodes = grouped.reduce((sum, row) => sum + row._count._all, 0) / grouped.length;
  const ratioToAverage = averageEpisodes > 0 ? Math.round((myEpisodesWatched / averageEpisodes) * 10) / 10 : null;

  return { episodesPercentile, ratioToAverage };
}
