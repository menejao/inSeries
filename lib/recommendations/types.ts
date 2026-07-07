import type { GenreStats } from "@/lib/analytics";

export type RecommendationProviderId = "genre" | "similar" | "popular" | "rating" | "trending";

/** The catalog fields every provider needs — fetched once by the engine, never re-queried per provider. */
export type CandidateSeries = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  status: string;
  popularityScore: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  firstAirYear: number | null;
  // INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01 (Fase 9) — additive only, purely for the
  // card's visual enrichment (tags/quality/logo). No provider/scoring logic reads these.
  qualityScore: number | null;
  collectionTags: string[];
  watchProviders: string[];
  logoUrl: string | null;
};

/** One "seed" series the user has engaged with (completed or currently watching) — used by SimilarSeriesProvider. */
export type SeedSeries = {
  id: string;
  title: string;
  genres: string[];
};

/**
 * Precomputed, reusable context handed to every provider. Built once by the
 * engine (engine.ts) from the Analytics Layer + a couple of small queries —
 * no provider queries the database directly.
 */
export type RecommendationContext = {
  userId: string;
  candidates: CandidateSeries[];
  seedSeries: SeedSeries[];
  genreAffinity: GenreStats;
  /** genre -> number of series the user has marked COMPLETED with that genre (feeds reason text). */
  genreCompletedCounts: Map<string, number>;
  /** genre -> number of the user's own reviews rating >= 4/5 for a series with that genre ("positive reviews"). */
  positivelyReviewedGenres: Map<string, number>;
};

export type ProviderSignal = {
  seriesId: string;
  /** 0-100, comparable across providers before weighting. */
  score: number;
  reason: string;
};

export interface RecommendationProvider {
  id: RecommendationProviderId;
  label: string;
  run(context: RecommendationContext): ProviderSignal[];
}

export type RecommendationReason = {
  provider: RecommendationProviderId;
  text: string;
  score: number;
};

export type ScoredRecommendation = {
  series: CandidateSeries;
  score: number;
  primaryReason: string;
  primaryProvider: RecommendationProviderId;
  reasons: RecommendationReason[];
};

export type RecommendationOptions = {
  limit?: number;
  /** Default true — a series already on any of the user's WANT_TO_WATCH statuses is not "new" to suggest. */
  excludeWatchlisted?: boolean;
  /** Default true — a series already WATCHING is already in the user's hands, not a discovery suggestion. */
  excludeWatching?: boolean;
};

export type RecommendationResult = {
  generatedAt: string;
  fromCache: boolean;
  /** false when the `recommendations` feature flag is off — the engine never ran. */
  enabled: boolean;
  items: ScoredRecommendation[];
};
