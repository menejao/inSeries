import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";
import { fetchAnalyticsDataset, computeGenreStats } from "@/lib/analytics";
import { RECOMMENDATION_PROVIDERS } from "@/lib/recommendations/providers";
import { combineProviderSignals } from "@/lib/recommendations/scoring";
import { excludeIneligibleSeries, type ExclusionSets } from "@/lib/recommendations/filters";
import type {
  CandidateSeries,
  ProviderSignal,
  RecommendationContext,
  RecommendationOptions,
  RecommendationProviderId,
  ScoredRecommendation,
  SeedSeries
} from "@/lib/recommendations/types";

const CANDIDATE_SELECT = {
  id: true,
  slug: true,
  title: true,
  posterUrl: true,
  backdropUrl: true,
  genres: true,
  status: true,
  popularityScore: true,
  voteAverage: true,
  voteCount: true,
  firstAirYear: true
} as const;

/**
 * Builds the shared `RecommendationContext` — every query the engine needs,
 * run once and handed to all providers. Reuses the Analytics Layer
 * (`fetchAnalyticsDataset`, `computeGenreStats`) instead of re-deriving
 * genre affinity from scratch (Fase 10).
 */
async function buildContext(userId: string): Promise<{ context: RecommendationContext; exclusions: ExclusionSets }> {
  const [dataset, positiveReviews] = await Promise.all([
    fetchAnalyticsDataset(userId),
    prisma.review.findMany({
      where: { userId, rating: { gte: 4 } },
      select: { series: { select: { genres: true } } }
    })
  ]);

  const completed = dataset.seriesStatuses.filter((status) => status.state === "COMPLETED");
  const dropped = dataset.seriesStatuses.filter((status) => status.state === "DROPPED");
  const watchlisted = dataset.seriesStatuses.filter((status) => status.state === "WANT_TO_WATCH");
  const watching = dataset.seriesStatuses.filter((status) => status.state === "WATCHING");

  const exclusions: ExclusionSets = {
    completed: new Set(completed.map((s) => s.seriesId)),
    dropped: new Set(dropped.map((s) => s.seriesId)),
    watchlisted: new Set(watchlisted.map((s) => s.seriesId)),
    watching: new Set(watching.map((s) => s.seriesId))
  };

  const seedSeries: SeedSeries[] = [...completed, ...watching].map((status) => ({
    id: status.seriesId,
    title: status.seriesTitle,
    genres: status.seriesGenres
  }));

  const genreCompletedCounts = new Map<string, number>();
  for (const status of completed) {
    for (const genre of status.seriesGenres) {
      genreCompletedCounts.set(genre, (genreCompletedCounts.get(genre) ?? 0) + 1);
    }
  }

  const positivelyReviewedGenres = new Map<string, number>();
  for (const review of positiveReviews) {
    for (const genre of review.series.genres) {
      positivelyReviewedGenres.set(genre, (positivelyReviewedGenres.get(genre) ?? 0) + 1);
    }
  }

  const excludedFromQuery = [...exclusions.completed, ...exclusions.dropped];
  const candidates: CandidateSeries[] = await prisma.series.findMany({
    where: excludedFromQuery.length ? { id: { notIn: excludedFromQuery } } : undefined,
    orderBy: [{ popularityScore: "desc" }],
    take: config.recommendations.candidatePoolSize,
    select: CANDIDATE_SELECT
  });

  const context: RecommendationContext = {
    userId,
    candidates,
    seedSeries,
    genreAffinity: computeGenreStats(dataset.watchedEpisodes),
    genreCompletedCounts,
    positivelyReviewedGenres
  };

  return { context, exclusions };
}

/**
 * Runs every provider, combines their signals into a weighted score per
 * series, applies the Fase 5 filters, sorts, and limits. This is the whole
 * engine — `service.ts` only adds caching around this function.
 */
export async function computeRecommendations(userId: string, options: RecommendationOptions = {}): Promise<ScoredRecommendation[]> {
  const { context, exclusions } = await buildContext(userId);

  const signalsByProvider = Object.fromEntries(
    RECOMMENDATION_PROVIDERS.map((provider) => [provider.id, provider.run(context)])
  ) as Record<RecommendationProviderId, ProviderSignal[]>;

  const combined = combineProviderSignals(signalsByProvider);

  const candidatesById = new Map(context.candidates.map((candidate) => [candidate.id, candidate]));
  const eligibleIds = new Set(
    excludeIneligibleSeries(context.candidates, exclusions, options).map((candidate) => candidate.id)
  );

  const limit = options.limit ?? 10;

  return combined
    .filter((entry) => eligibleIds.has(entry.seriesId))
    .slice(0, limit)
    .map((entry) => {
      const series = candidatesById.get(entry.seriesId);
      if (!series) return null;
      const primary = entry.reasons[0];
      return {
        series,
        score: Math.round(entry.score * 10) / 10,
        primaryReason: primary?.text ?? "Selecionado para voce.",
        primaryProvider: primary?.provider ?? "popular",
        reasons: entry.reasons
      } satisfies ScoredRecommendation;
    })
    .filter((item): item is ScoredRecommendation => item !== null);
}
