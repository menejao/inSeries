import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";
import { fetchAnalyticsDataset, computeGenreStats } from "@/lib/analytics";
import { RECOMMENDATION_PROVIDERS } from "@/lib/recommendations/providers";
import { combineProviderSignals } from "@/lib/recommendations/scoring";
import { excludeIneligibleSeries, type ExclusionSets } from "@/lib/recommendations/filters";
import { applyDiversityMix } from "@/lib/recommendations/diversity";
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
  firstAirYear: true,
  qualityScore: true,
  collectionTags: true,
  watchProviders: true,
  logoUrl: true,
  discoveryScore: true,
  keywords: true,
  createdBy: true,
  networks: true,
  language: true,
  originCountry: true,
  cast: true
} as const;

/** `Series.cast` is `Json[]` — each row shaped like `NormalizedCastMember` (lib/catalog/normalize.ts), but Prisma can't type a JSON column, so it's read back defensively. */
function castNamesOf(cast: unknown): string[] {
  if (!Array.isArray(cast)) return [];
  return cast
    .slice(0, 8)
    .map((entry) => (entry && typeof entry === "object" && "name" in entry ? String((entry as { name: unknown }).name) : null))
    .filter((name): name is string => Boolean(name));
}

// INSERIES-RECOMMENDATION-ENGINE-02 — "dar peso maior para series avaliadas com notas altas
// ... 1 estrela nao utilizar como base." A 1-star review contributes nothing (0); unreviewed
// COMPLETED/WATCHING series get the neutral baseline (1) they always had.
const RATING_WEIGHTS: Record<number, number> = { 1: 0, 2: 0.6, 3: 1, 4: 1.5, 5: 2 };
const DEFAULT_SEED_WEIGHT = 1;

// Abandoned-series genre suppression (also reused for NOT_INTERESTED feedback): each
// occurrence multiplies the running suppression by this factor, floored so a genre is
// never fully erased from view (just heavily deprioritized).
const DROPPED_GENRE_PENALTY = 0.55;
const MIN_GENRE_SUPPRESSION = 0.15;

const CANDIDATE_SEED_SELECT = { id: true, collectionTags: true, keywords: true, createdBy: true, networks: true, language: true, originCountry: true, watchProviders: true, cast: true } as const;

/**
 * Builds the shared `RecommendationContext` — every query the engine needs,
 * run once and handed to all providers. Reuses the Analytics Layer
 * (`fetchAnalyticsDataset`, `computeGenreStats`) instead of re-deriving
 * genre affinity from scratch (Fase 10).
 */
async function buildContext(userId: string): Promise<{ context: RecommendationContext; exclusions: ExclusionSets }> {
  const [dataset, positiveReviews, allReviews, feedbackRows, listedRows] = await Promise.all([
    fetchAnalyticsDataset(userId),
    prisma.review.findMany({
      where: { userId, rating: { gte: 4 } },
      select: { series: { select: { genres: true } } }
    }),
    // INSERIES-RECOMMENDATION-ENGINE-02 — every review, to derive per-seed rating weight (not just the >=4 ones above, which only feed the genre "positive reviews" boost).
    prisma.review.findMany({ where: { userId }, select: { seriesId: true, rating: true } }),
    prisma.recommendationFeedback.findMany({ where: { userId }, select: { seriesId: true, action: true, series: { select: { genres: true } } } }),
    prisma.listItem.findMany({ where: { list: { userId } }, select: { seriesId: true } })
  ]);

  const completed = dataset.seriesStatuses.filter((status) => status.state === "COMPLETED");
  const dropped = dataset.seriesStatuses.filter((status) => status.state === "DROPPED");
  const watchlisted = dataset.seriesStatuses.filter((status) => status.state === "WANT_TO_WATCH");
  const watching = dataset.seriesStatuses.filter((status) => status.state === "WATCHING");

  const feedbackExcluded = new Set(
    feedbackRows.filter((row) => row.action !== "LIKE").map((row) => row.seriesId)
  );

  const exclusions: ExclusionSets = {
    completed: new Set(completed.map((s) => s.seriesId)),
    dropped: new Set(dropped.map((s) => s.seriesId)),
    watchlisted: new Set(watchlisted.map((s) => s.seriesId)),
    watching: new Set(watching.map((s) => s.seriesId)),
    listed: new Set(listedRows.map((row) => row.seriesId)),
    feedbackExcluded
  };

  // "Series concluidas tem peso maior que abandonadas" + rating-weighted seed profile — one
  // per-series rating lookup, reused for every seed below.
  const ratingBySeriesId = new Map(allReviews.map((review) => [review.seriesId, RATING_WEIGHTS[review.rating] ?? DEFAULT_SEED_WEIGHT]));

  // Fase 4 (INSERIES-DASHBOARD-PREMIUM-01) — the user's collectionTags/keywords
  // "fingerprint" (editorialProvider). INSERIES-RECOMMENDATION-ENGINE-02 extends the same
  // bounded query with the remaining seed-profile fields (creator/cast/network/language/
  // country/platform) — still one query, never per-series.
  const seedSeriesIds = [...completed, ...watching].map((status) => status.seriesId);
  const seedDetailsRows = seedSeriesIds.length
    ? await prisma.series.findMany({ where: { id: { in: seedSeriesIds } }, select: CANDIDATE_SEED_SELECT })
    : [];
  const seedDetailsById = new Map(seedDetailsRows.map((row) => [row.id, row]));

  const seedSeries: SeedSeries[] = [...completed, ...watching].map((status) => {
    const details = seedDetailsById.get(status.seriesId);
    const isCompleted = exclusions.completed.has(status.seriesId);
    const ratingWeight = ratingBySeriesId.get(status.seriesId);
    // No review: COMPLETED gets full weight (real interest signal per the ticket), WATCHING
    // (not finished yet, weaker signal) gets a reduced default.
    const weight = ratingWeight ?? (isCompleted ? DEFAULT_SEED_WEIGHT : DEFAULT_SEED_WEIGHT * 0.7);
    return {
      id: status.seriesId,
      title: status.seriesTitle,
      genres: status.seriesGenres,
      collectionTags: details?.collectionTags ?? [],
      keywords: details?.keywords ?? [],
      createdBy: details?.createdBy ?? [],
      networks: details?.networks ?? [],
      castNames: castNamesOf(details?.cast),
      language: details?.language ?? null,
      originCountry: details?.originCountry ?? [],
      watchProviders: details?.watchProviders ?? [],
      weight
    };
  });

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

  // "Caso o usuario tenha abandonado uma serie, reduzir significativamente recomendacoes
  // parecidas" — every dropped series (and every NOT_INTERESTED feedback) multiplies its
  // genres' suppression, floored so it's deprioritized rather than erased.
  const suppressedGenres = new Map<string, number>();
  const applyDropSuppression = (genres: string[]) => {
    for (const genre of genres) {
      const current = suppressedGenres.get(genre) ?? 1;
      suppressedGenres.set(genre, Math.max(MIN_GENRE_SUPPRESSION, current * DROPPED_GENRE_PENALTY));
    }
  };
  for (const status of dropped) applyDropSuppression(status.seriesGenres);
  for (const row of feedbackRows) {
    if (row.action === "NOT_INTERESTED") applyDropSuppression(row.series.genres);
  }

  const genreAffinity = computeGenreStats(dataset.watchedEpisodes);
  const topGenres = genreAffinity.ranking.slice(0, 3).map((stat) => stat.genre);

  const excludedFromQuery = [...exclusions.completed, ...exclusions.dropped, ...exclusions.listed, ...exclusions.feedbackExcluded];
  const rawCandidates = await prisma.series.findMany({
    where: excludedFromQuery.length ? { id: { notIn: excludedFromQuery } } : undefined,
    orderBy: [{ popularityScore: "desc" }],
    take: config.recommendations.candidatePoolSize,
    select: CANDIDATE_SELECT
  });
  const candidates: CandidateSeries[] = rawCandidates.map((row) => ({
    ...row,
    createdBy: row.createdBy,
    networks: row.networks,
    originCountry: row.originCountry,
    castNames: castNamesOf(row.cast)
  }));

  const context: RecommendationContext = {
    userId,
    candidates,
    seedSeries,
    genreAffinity,
    genreCompletedCounts,
    positivelyReviewedGenres,
    suppressedGenres,
    topGenres
  };

  return { context, exclusions };
}

/**
 * Runs every provider, combines their signals into a weighted score per
 * series, applies the exclusion filters, mixes in diversity, and limits.
 * `service.ts` only adds caching around this function.
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

  const eligible = combined.filter((entry) => eligibleIds.has(entry.seriesId));

  // INSERIES-RECOMMENDATION-ENGINE-02 — "reservar no maximo 20% para tendencias" +
  // "70% forte afinidade / 20% media / 10% descobertas": both rules only make sense once
  // there's an actual scored, personalized pool (a brand-new user has none of that yet —
  // every provider except popular/rating/trending returns []).
  const hasPersonalSignal = context.seedSeries.length > 0;
  const ranked = hasPersonalSignal ? applyDiversityMix(eligible, limit, config.recommendations.trendingMaxShare) : eligible.slice(0, limit);

  return ranked
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

/**
 * "Talvez voce goste" (INSERIES-RECOMMENDATION-ENGINE-02) — a deliberately separate section,
 * never mixed into the main list: candidates outside the user's top-3 genres, still eligible
 * (same exclusions) and still reasonably well-regarded (voteAverage >= 6), so "fora da zona de
 * conforto" never means "low quality". Empty for users with no genre affinity yet — there's no
 * "comfort zone" to step outside of.
 */
export async function computeDiscoveryRecommendations(userId: string, limit = 10): Promise<ScoredRecommendation[]> {
  const { context, exclusions } = await buildContext(userId);
  if (context.topGenres.length === 0) return [];

  const eligibleIds = new Set(excludeIneligibleSeries(context.candidates, exclusions, {}).map((c) => c.id));
  const topGenreSet = new Set(context.topGenres);

  const candidates = context.candidates.filter(
    (candidate) =>
      eligibleIds.has(candidate.id) &&
      !candidate.genres.some((genre) => topGenreSet.has(genre)) &&
      (candidate.voteAverage ?? 0) >= 6
  );

  return candidates
    .sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0))
    .slice(0, limit)
    .map((series) => ({
      series,
      score: Math.round((series.voteAverage ?? 0) * 10),
      primaryReason: `Uma descoberta fora do seu genero habitual — ${series.genres[0] ?? "novo estilo"}.`,
      primaryProvider: "popular" as const,
      reasons: []
    }));
}
