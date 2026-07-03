import type { GenreStats, Insight } from "@/lib/analytics";

/** `month` is `null` for a yearly recap, 1-12 for a monthly recap. */
export type RecapPeriod = {
  year: number;
  month: number | null;
};

export type RecapMostWatchedSeries = {
  seriesId: string;
  seriesTitle: string;
  episodeCount: number;
} | null;

export type RecapRecentEpisode = {
  seriesId: string;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  watchedAt: string;
} | null;

export type RecapReview = {
  seriesId: string;
  seriesTitle: string;
  rating: number;
  body: string;
  createdAt: string;
};

/** Internal shape used while filtering by period — `createdAt` stays a `Date` until the final slice is built (see service.ts). */
export type RecapReviewRecord = {
  seriesId: string;
  seriesTitle: string;
  rating: number;
  body: string;
  createdAt: Date;
};

export type RecapSharing = {
  /** Deterministic, not persisted — see sharing.ts. Not resolvable by any route yet. */
  shareSlug: string;
  /** Always false this sprint (Fase 11) — recaps are private by default and never auto-published. */
  isPublic: boolean;
};

export type RecapData = {
  period: RecapPeriod;
  label: string;
  episodesWatched: number;
  seriesWatchedCount: number;
  seriesWatched: string[];
  seriesCompletedCount: number;
  seriesCompleted: string[];
  minutesWatched: number;
  hoursWatched: number;
  activeDays: number;
  longestStreakDays: number;
  genres: GenreStats;
  mostWatchedSeries: RecapMostWatchedSeries;
  mostRecentEpisode: RecapRecentEpisode;
  topReviews: RecapReview[];
  insights: Insight[];
  sharing: RecapSharing;
  generatedAt: string;
};

export type RecapValidationError = "invalid_year" | "invalid_month" | "future_period";

export type RecapOutcome =
  | { ok: true; enabled: true; data: RecapData }
  | { ok: false; enabled: false }
  | { ok: false; enabled: true; error: RecapValidationError };

export type RecapPeriodSummary = {
  year: number;
  month: number | null;
  label: string;
  episodesWatched: number;
};

export type RecapAvailability = {
  years: RecapPeriodSummary[];
  months: RecapPeriodSummary[];
};

export type RecapAvailabilityOutcome = { enabled: true; availability: RecapAvailability } | { enabled: false; availability: null };
