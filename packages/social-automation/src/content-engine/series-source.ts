import { prisma } from "../db/client";
import type { SeriesSummary } from "./types";

const SERIES_SELECT = {
  id: true,
  slug: true,
  title: true,
  overview: true,
  posterUrl: true,
  backdropUrl: true,
  firstAirYear: true,
  genres: true,
  keywords: true,
  collectionTags: true,
  status: true,
  popularityScore: true,
  voteAverage: true,
  voteCount: true,
  discoveryScore: true,
  qualityScore: true,
  watchProviders: true,
  originCountry: true,
  spokenLanguages: true,
  numberOfSeasons: true,
  numberOfEpisodes: true
} as const;

/**
 * Direct Prisma queries against Series/Season/Episode/UserSeriesStatus/Review — this package
 * uses its own db/client.ts Prisma client (never imports lib/db/prisma.ts or lib/*), following
 * the same isolation pattern the rest of packages/social-automation already uses.
 */
export const seriesSource = {
  async topByDiscoveryScore(limit: number, filters: { minVotes?: number; minRating?: number; minPopularity?: number; maxAgeYears?: number } = {}): Promise<SeriesSummary[]> {
    const now = new Date();
    const minYear = filters.maxAgeYears ? now.getFullYear() - filters.maxAgeYears : undefined;

    return prisma.series.findMany({
      where: {
        discoveryScore: { not: null },
        voteCount: filters.minVotes ? { gte: filters.minVotes } : undefined,
        voteAverage: filters.minRating ? { gte: filters.minRating } : undefined,
        popularityScore: filters.minPopularity ? { gte: filters.minPopularity } : undefined,
        firstAirYear: minYear ? { gte: minYear } : undefined
      },
      orderBy: { discoveryScore: "desc" },
      take: limit,
      select: SERIES_SELECT
    });
  },

  async topByQualityAndDiscovery(limit: number): Promise<SeriesSummary[]> {
    return prisma.series.findMany({
      where: { OR: [{ discoveryScore: { not: null } }, { qualityScore: { not: null } }] },
      orderBy: [{ discoveryScore: "desc" }, { qualityScore: "desc" }],
      take: limit,
      select: SERIES_SELECT
    });
  },

  async randomSeedSeries(limit: number): Promise<SeriesSummary[]> {
    // No native "ORDER BY random()" via Prisma query builder cross-DB — take a bounded top slice
    // by discoveryScore (real signal, not synthesized) and let callers pick within it.
    return prisma.series.findMany({
      where: { discoveryScore: { not: null } },
      orderBy: { discoveryScore: "desc" },
      take: limit,
      select: SERIES_SELECT
    });
  },

  async candidatesExcluding(excludeIds: string[], limit: number): Promise<SeriesSummary[]> {
    return prisma.series.findMany({
      where: { id: { notIn: excludeIds } },
      orderBy: { discoveryScore: "desc" },
      take: limit,
      select: SERIES_SELECT
    });
  },

  async byId(id: string): Promise<SeriesSummary | null> {
    return prisma.series.findUnique({ where: { id }, select: SERIES_SELECT });
  },

  async byGenreOrKeyword(genres: string[], keywords: string[], limit: number): Promise<SeriesSummary[]> {
    return prisma.series.findMany({
      where: {
        OR: [
          genres.length > 0 ? { genres: { hasSome: genres } } : undefined,
          keywords.length > 0 ? { keywords: { hasSome: keywords } } : undefined
        ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause))
      },
      orderBy: { discoveryScore: "desc" },
      take: limit,
      select: SERIES_SELECT
    });
  },

  /**
   * "weekly-premieres" — real field availability check: Episode.airedAt (DateTime?) is the only
   * reliable premiere-date field in the schema (Season only has `airYear: Int?`, too coarse for
   * a weekly window). Returns series whose most-recently-aired episode falls in [since, until).
   */
  async premieresBetween(since: Date, until: Date, limit: number): Promise<SeriesSummary[]> {
    const episodes = await prisma.episode.findMany({
      where: { airedAt: { gte: since, lt: until } },
      select: { season: { select: { seriesId: true } }, airedAt: true },
      orderBy: { airedAt: "desc" },
      take: limit * 5
    });

    const seriesIds = Array.from(new Set(episodes.map((episode) => episode.season.seriesId))).slice(0, limit);
    if (seriesIds.length === 0) return [];

    return prisma.series.findMany({ where: { id: { in: seriesIds } }, select: SERIES_SELECT });
  },

  /** "ranking" — most-completed via UserSeriesStatus, grouped and joined back to Series. */
  async mostCompleted(limit: number): Promise<Array<SeriesSummary & { completedCount: number }>> {
    const grouped = await prisma.userSeriesStatus.groupBy({
      by: ["seriesId"],
      where: { state: "COMPLETED" },
      _count: { seriesId: true },
      orderBy: { _count: { seriesId: "desc" } },
      take: limit
    });

    if (grouped.length === 0) return [];
    const series = await prisma.series.findMany({ where: { id: { in: grouped.map((g) => g.seriesId) } }, select: SERIES_SELECT });
    const seriesById = new Map(series.map((s) => [s.id, s]));

    return grouped
      .map((g) => {
        const s = seriesById.get(g.seriesId);
        return s ? { ...s, completedCount: g._count.seriesId } : null;
      })
      .filter((item): item is SeriesSummary & { completedCount: number } => item !== null);
  },

  /** "ranking" — most-rated via Review, average rating + count, grouped and joined back to Series. */
  async mostRated(limit: number, minReviewCount = 3): Promise<Array<SeriesSummary & { avgRating: number; reviewCount: number }>> {
    const grouped = await prisma.review.groupBy({
      by: ["seriesId"],
      _avg: { rating: true },
      _count: { seriesId: true },
      having: { seriesId: { _count: { gte: minReviewCount } } },
      orderBy: { _avg: { rating: "desc" } },
      take: limit
    });

    if (grouped.length === 0) return [];
    const series = await prisma.series.findMany({ where: { id: { in: grouped.map((g) => g.seriesId) } }, select: SERIES_SELECT });
    const seriesById = new Map(series.map((s) => [s.id, s]));

    return grouped
      .map((g) => {
        const s = seriesById.get(g.seriesId);
        return s ? { ...s, avgRating: g._avg.rating ?? 0, reviewCount: g._count.seriesId } : null;
      })
      .filter((item): item is SeriesSummary & { avgRating: number; reviewCount: number } => item !== null);
  }
};
