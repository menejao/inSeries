import { prisma } from "@/lib/db/prisma";
import type { MyListGroup, MyListSummary } from "@/lib/my-list/types";

/**
 * Fase 5 (INSERIES-DASHBOARD-PREMIUM-01) — "Minha Lista": a resumo of the user's own
 * `UserSeriesStatus` groups plus a "Favoritas" group. There is no dedicated favorite
 * flag/model anywhere in the schema (audited — `Rating` exists but is never read or
 * written anywhere in the app; building on it would mean inventing a whole new feature).
 * `Review.rating >= 4` (the same threshold the recommendations engine already treats as
 * "positive", lib/recommendations/engine.ts's `positiveReviews` query) is the closest real,
 * actively-used signal — so "Favoritas" reuses it instead of adding anything new.
 *
 * Every group's count comes from one `groupBy`, and every group's preview is one bounded
 * `take: PREVIEW_LIMIT` query — 6 queries total, all in parallel, none proportional to
 * catalog size or to how many series the user tracks (Fase 9 — no N+1).
 */
const PREVIEW_LIMIT = 6;
const FAVORITE_MIN_RATING = 4;

const PREVIEW_SELECT = {
  id: true,
  slug: true,
  title: true,
  posterUrl: true,
  backdropUrl: true
} as const;

export async function getMyListSummaryForUser(userId: string): Promise<MyListSummary> {
  const [statusCounts, watching, wantToWatch, completed, paused, favoritesCount, favorites] = await Promise.all([
    prisma.userSeriesStatus.groupBy({ by: ["state"], where: { userId }, _count: { _all: true } }),
    prisma.userSeriesStatus.findMany({
      where: { userId, state: "WATCHING" },
      orderBy: { lastActivityAt: "desc" },
      take: PREVIEW_LIMIT,
      select: { series: { select: PREVIEW_SELECT } }
    }),
    prisma.userSeriesStatus.findMany({
      where: { userId, state: "WANT_TO_WATCH" },
      orderBy: { createdAt: "desc" },
      take: PREVIEW_LIMIT,
      select: { series: { select: PREVIEW_SELECT } }
    }),
    prisma.userSeriesStatus.findMany({
      where: { userId, state: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: PREVIEW_LIMIT,
      select: { series: { select: PREVIEW_SELECT } }
    }),
    prisma.userSeriesStatus.findMany({
      where: { userId, state: "PAUSED" },
      orderBy: { lastActivityAt: "desc" },
      take: PREVIEW_LIMIT,
      select: { series: { select: PREVIEW_SELECT } }
    }),
    prisma.review.count({ where: { userId, rating: { gte: FAVORITE_MIN_RATING } } }),
    prisma.review.findMany({
      where: { userId, rating: { gte: FAVORITE_MIN_RATING } },
      orderBy: { rating: "desc" },
      take: PREVIEW_LIMIT,
      select: { series: { select: PREVIEW_SELECT } }
    })
  ]);

  const countByState = new Map(statusCounts.map((row) => [row.state, row._count._all]));

  const groups: MyListGroup[] = [
    { key: "WATCHING", label: "Assistindo", count: countByState.get("WATCHING") ?? 0, preview: watching.map((row) => row.series) },
    {
      key: "WANT_TO_WATCH",
      label: "Quero assistir",
      count: countByState.get("WANT_TO_WATCH") ?? 0,
      preview: wantToWatch.map((row) => row.series)
    },
    { key: "COMPLETED", label: "Concluidas", count: countByState.get("COMPLETED") ?? 0, preview: completed.map((row) => row.series) },
    { key: "PAUSED", label: "Pausadas", count: countByState.get("PAUSED") ?? 0, preview: paused.map((row) => row.series) },
    { key: "FAVORITES", label: "Favoritas", count: favoritesCount, preview: favorites.map((row) => row.series) }
  ];

  return {
    groups,
    hasAnySeries: groups.some((group) => group.count > 0)
  };
}
