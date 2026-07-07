import type { SeriesLifecycleStatus } from "@prisma/client";
import { config } from "@/lib/config";

/**
 * Fase 2 (INSERIES-TMDB-CATALOG-QUALITY-01) — a single 0-100 editorial quality score,
 * same "weighted sum of normalized signals" shape as priority (lib/catalog/aggregator.ts)
 * and recommendations (lib/recommendations/scoring.ts). Every signal is normalized to
 * 0-1 first (so no single raw scale — popularity vs. vote_average vs. episode count —
 * can dominate just because its numbers are bigger), then multiplied by its configured
 * weight and summed, scaled to 0-100 by the sum of the weights actually used.
 *
 * Caps below turn unbounded TMDb numbers (popularity, vote_count, seasons, episodes) into
 * a 0-1 signal. They're not exposed as env vars (unlike the weights) to keep the knob
 * surface manageable — same judgment call as SAFETY_MAX_PAGES/genreMap elsewhere in this
 * pipeline: a documented constant, not a magic number.
 */
const POPULARITY_CAP = 200;
const VOTE_COUNT_CAP = 1000;
const SEASONS_CAP = 5;
const EPISODES_CAP = 50;
/** How many years of "no longer airing" it takes for the recency signal to fully decay to 0. */
const RECENCY_DECAY_YEARS = 15;

const STATUS_RELEVANCE: Record<SeriesLifecycleStatus, number> = {
  RETURNING: 1,
  IN_PRODUCTION: 1,
  PILOT: 0.6,
  ENDED: 0.8,
  CANCELED: 0.4
};

export type QualityScoreInput = {
  popularity?: number | null;
  voteAverage?: number | null;
  voteCount?: number | null;
  firstAirYear?: number | null;
  status: SeriesLifecycleStatus;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  logoUrl?: string | null;
  watchProviders?: string[] | null;
  originCountry?: string[] | null;
  language?: string | null;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function presence(value: string | null | undefined) {
  return value ? 1 : 0;
}

function recencyScore(firstAirYear: number | null | undefined, status: SeriesLifecycleStatus, now: Date) {
  if (status === "RETURNING" || status === "IN_PRODUCTION" || status === "PILOT") return 1;
  if (!firstAirYear) return 0;
  const yearsSince = now.getFullYear() - firstAirYear;
  return clamp01(1 - yearsSince / RECENCY_DECAY_YEARS);
}

/** Fase 2 — computes the persisted `Series.qualityScore` (0-100). Pure function, no I/O. */
export function computeQualityScore(input: QualityScoreInput, now: Date = new Date()): number {
  const { qualityWeights: w } = config.catalogQuality;

  const signals: Array<[number, number]> = [
    [clamp01((input.popularity ?? 0) / POPULARITY_CAP), w.popularity],
    [clamp01((input.voteAverage ?? 0) / 10), w.voteAverage],
    [clamp01((input.voteCount ?? 0) / VOTE_COUNT_CAP), w.voteCount],
    [recencyScore(input.firstAirYear, input.status, now), w.recency],
    [STATUS_RELEVANCE[input.status] ?? 0.5, w.status],
    [clamp01((input.numberOfSeasons ?? 0) / SEASONS_CAP), w.seasons],
    [clamp01((input.numberOfEpisodes ?? 0) / EPISODES_CAP), w.episodes],
    [presence(input.backdropUrl), w.backdrop],
    [presence(input.posterUrl), w.poster],
    [presence(input.overview), w.overview],
    [presence(input.logoUrl), w.logo],
    [input.watchProviders?.length ? 1 : 0, w.providers],
    [input.originCountry?.length ? 1 : 0, w.originCountry],
    [presence(input.language), w.language]
  ];

  const totalWeight = signals.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = signals.reduce((sum, [value, weight]) => sum + value * weight, 0);
  return Math.round((weightedSum / totalWeight) * 100 * 100) / 100;
}
