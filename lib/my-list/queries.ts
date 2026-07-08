import { prisma } from "@/lib/db/prisma";
import { MY_LIST_GROUP_LABELS, type MyListFullData, type MyListGroup, type MyListItem, type MyListSeriesCard, type MyListSummary } from "@/lib/my-list/types";

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
  const [statusCounts, watching, wantToWatch, completed, paused, dropped, favoritesCount, favorites] = await Promise.all([
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
    // Fase 1 (INSERIES-MY-LISTS-PREMIUM-01) — auditoria encontrou que "Abandonadas" (o 5o
    // valor do enum WatchState, DROPPED) nunca era consultado aqui, apesar de a mutation
    // (upsertSeriesStatus) e a UI de status da serie (SeriesStatusActions, "Abandonada") ja
    // suportarem esse estado havia sprints. Gap de cobertura, nao uma regra nova.
    prisma.userSeriesStatus.findMany({
      where: { userId, state: "DROPPED" },
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
    { key: "WATCHING", label: MY_LIST_GROUP_LABELS.WATCHING, count: countByState.get("WATCHING") ?? 0, preview: watching.map((row) => row.series) },
    {
      key: "WANT_TO_WATCH",
      label: MY_LIST_GROUP_LABELS.WANT_TO_WATCH,
      count: countByState.get("WANT_TO_WATCH") ?? 0,
      preview: wantToWatch.map((row) => row.series)
    },
    { key: "PAUSED", label: MY_LIST_GROUP_LABELS.PAUSED, count: countByState.get("PAUSED") ?? 0, preview: paused.map((row) => row.series) },
    {
      key: "COMPLETED",
      label: MY_LIST_GROUP_LABELS.COMPLETED,
      count: countByState.get("COMPLETED") ?? 0,
      preview: completed.map((row) => row.series)
    },
    { key: "DROPPED", label: MY_LIST_GROUP_LABELS.DROPPED, count: countByState.get("DROPPED") ?? 0, preview: dropped.map((row) => row.series) },
    { key: "FAVORITES", label: MY_LIST_GROUP_LABELS.FAVORITES, count: favoritesCount, preview: favorites.map((row) => row.series) }
  ];

  return {
    groups,
    hasAnySeries: groups.some((group) => group.count > 0)
  };
}

const SERIES_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  firstAirYear: true,
  posterUrl: true,
  backdropUrl: true,
  logoUrl: true,
  voteAverage: true,
  qualityScore: true,
  discoveryScore: true,
  genres: true,
  watchProviders: true,
  collectionTags: true,
  keywords: true,
  language: true,
  originCountry: true,
  numberOfSeasons: true,
  numberOfEpisodes: true,
  popularityScore: true
} as const;

function toSeriesCard(model: {
  id: string;
  slug: string;
  title: string;
  firstAirYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  voteAverage: number | null;
  qualityScore: number | null;
  discoveryScore: number | null;
  genres: string[];
  watchProviders: string[];
  collectionTags: string[];
  keywords: string[];
  language: string | null;
  originCountry: string[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  popularityScore: number | null;
}): MyListSeriesCard {
  return {
    id: model.id,
    slug: model.slug,
    title: model.title,
    year: model.firstAirYear ?? 0,
    posterUrl: model.posterUrl,
    backdropUrl: model.backdropUrl,
    logoUrl: model.logoUrl,
    voteAverage: model.voteAverage,
    qualityScore: model.qualityScore,
    discoveryScore: model.discoveryScore,
    genres: model.genres,
    watchProviders: model.watchProviders,
    collectionTags: model.collectionTags,
    keywords: model.keywords,
    language: model.language,
    originCountry: model.originCountry,
    numberOfSeasons: model.numberOfSeasons,
    numberOfEpisodes: model.numberOfEpisodes,
    popularityScore: model.popularityScore
  };
}

/**
 * Fase 2/12 (INSERIES-MY-LISTS-PREMIUM-01) — the full "Minha Lista" page's single data
 * source: every `UserSeriesStatus` row for the user (all 5 states), each with a lean
 * `Series` select (no `seasons`/`episodes` join — those aren't needed by the card, and
 * `/me/watching`'s old per-series `getCatalogSeriesBySlug` loop was exactly this N+1,
 * audited in Fase 1). One `UserSeriesStatus.findMany` + one `Review.findMany` (for the
 * favorite/rating signal), both in parallel — never one query per tracked series.
 * Grouping/filtering/sorting/search all happen client-side over this single array.
 */
export async function getMyListFullForUser(userId: string): Promise<MyListFullData> {
  const [statuses, reviews] = await Promise.all([
    prisma.userSeriesStatus.findMany({
      where: { userId },
      select: {
        state: true,
        completionPercent: true,
        lastActivityAt: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        series: { select: SERIES_CARD_SELECT }
      }
    }),
    prisma.review.findMany({
      where: { userId, rating: { gte: FAVORITE_MIN_RATING } },
      select: { seriesId: true, rating: true, createdAt: true, updatedAt: true, series: { select: SERIES_CARD_SELECT } }
    })
  ]);

  const reviewBySeriesId = new Map(reviews.map((review) => [review.seriesId, review]));
  const trackedSeriesIds = new Set(statuses.map((status) => status.series.id));

  const trackedItems: MyListItem[] = statuses.map((status) => {
    const review = reviewBySeriesId.get(status.series.id);
    return {
      series: toSeriesCard(status.series),
      state: status.state,
      completionPercent: status.completionPercent,
      lastActivityAt: status.lastActivityAt,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      addedAt: status.createdAt,
      updatedAt: status.updatedAt,
      isFavorite: Boolean(review),
      reviewRating: review?.rating ?? null
    };
  });

  // Fase 2/5 — a series favoritada (review >= 4) mas nunca rastreada via UserSeriesStatus
  // ainda precisa aparecer (so no grupo Favoritas): sem isso, ela ficaria invisivel na
  // Minha Lista completa, apesar de ja contar no resumo do Dashboard
  // (getMyListSummaryForUser sempre consultou Review de forma independente do status).
  const favoriteOnlyItems: MyListItem[] = reviews
    .filter((review) => !trackedSeriesIds.has(review.seriesId))
    .map((review) => ({
      series: toSeriesCard(review.series),
      state: null,
      completionPercent: 0,
      lastActivityAt: null,
      startedAt: null,
      completedAt: null,
      addedAt: review.createdAt,
      updatedAt: review.updatedAt,
      isFavorite: true,
      reviewRating: review.rating
    }));

  return { items: [...trackedItems, ...favoriteOnlyItems] };
}
