import type { GenreStats } from "@/lib/analytics";

export type RecommendationProviderId =
  | "genre"
  | "similar"
  | "popular"
  | "rating"
  | "trending"
  | "editorial"
  | "creator"
  | "cast"
  | "network"
  | "platform"
  | "language"
  | "country";

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
  // card's visual enrichment (tags/quality/logo).
  qualityScore: number | null;
  collectionTags: string[];
  watchProviders: string[];
  logoUrl: string | null;
  // INSERIES-DASHBOARD-PREMIUM-01 (Fase 4) — read by editorialProvider (providers/editorial-provider.ts).
  discoveryScore: number | null;
  keywords: string[];
  // INSERIES-RECOMMENDATION-ENGINE-02 — the remaining affinity factors from the ticket
  // (criadores/elenco/emissoras/plataformas/idioma/pais), all already synced onto Series.
  createdBy: string[];
  networks: string[];
  castNames: string[];
  language: string | null;
  originCountry: string[];
};

/**
 * One "seed" series the user has engaged with (completed or currently watching), used by
 * SimilarSeriesProvider, editorialProvider and every new affinity provider below.
 *
 * `weight` (INSERIES-RECOMMENDATION-ENGINE-02) — "dar peso maior para series avaliadas com
 * notas altas": 0 for a 1-star review (never used as a positive signal), scaling up to 2x for
 * a 5-star review; unreviewed COMPLETED/WATCHING series get the neutral default (1). This is
 * the single place that encodes "rating > just watched" — every provider that reads seedSeries
 * inherits it for free instead of re-deriving its own rating logic.
 */
export type SeedSeries = {
  id: string;
  title: string;
  genres: string[];
  // INSERIES-DASHBOARD-PREMIUM-01 (Fase 4) — the user's own collectionTags/keywords "fingerprint", read by editorialProvider.
  collectionTags: string[];
  keywords: string[];
  createdBy: string[];
  networks: string[];
  castNames: string[];
  language: string | null;
  originCountry: string[];
  watchProviders: string[];
  weight: number;
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
  /**
   * genre -> 0..1 suppression multiplier from abandoned series (INSERIES-RECOMMENDATION-ENGINE-02
   * — "abandonou anime -> reduzir recomendacoes de anime"), applied by genreProvider. 1 = no
   * suppression, 0 = fully suppressed. Also folds in DISLIKE feedback on the same genre.
   */
  suppressedGenres: Map<string, number>;
  /** The user's top 3 genres by affinity — used by the Discovery section to pick candidates deliberately outside this set. */
  topGenres: string[];
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
