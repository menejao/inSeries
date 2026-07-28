import type { SeriesLifecycleStatus } from "@prisma/client";
import { config } from "@/lib/config";
import { computeStreamingPriorityScore } from "@/lib/discovery/source-weight";

/**
 * Fase 3 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the Premium Discovery Score: a distinct
 * 0-100 signal from `Series.qualityScore` (which measures editorial/metadata completeness).
 * This one measures "how much of a big, current, in-demand title is this right now" —
 * trending presence and streaming priority carry the heaviest weights (see
 * config.discoveryEngine.scoreWeights), where qualityScore weighs editorial completeness
 * more heavily. Same "normalize every signal to 0-1, weight, sum, scale by total weight
 * used" shape as lib/catalog/quality-score.ts, deliberately not reusing its code (the
 * ticket: "Não reutilizar apenas o Quality Score") — qualityScore is only one of many
 * normalized inputs here, not the whole score.
 */
const POPULARITY_CAP = 200;
const VOTE_COUNT_CAP = 2000;
const SEASONS_CAP = 5;
const EPISODES_CAP = 50;
const RECENCY_DECAY_YEARS = 10;
// Fase 7 (INSERIES-CATALOG-POPULATION-AND-EXPERIENCE-V3) — Bayesian/confidence-weighted
// rating: a series with a handful of votes and an inflated average (e.g. 9.5 with 12 votes)
// must not outrank one with a real sample (8.7 with 50k votes). `BAYESIAN_MIN_VOTES` is the
// "weight of the prior" — below it, the score pulls toward `BAYESIAN_PRIOR_MEAN` (a
// conservative catalog-wide estimate); well above it, the real average dominates.
const BAYESIAN_MIN_VOTES = 300;
const BAYESIAN_PRIOR_MEAN = 6.5;

const STATUS_RELEVANCE: Record<SeriesLifecycleStatus, number> = {
  RETURNING: 1,
  IN_PRODUCTION: 1,
  PILOT: 0.5,
  ENDED: 0.7,
  CANCELED: 0.3
};

export type DiscoveryScoreInput = {
  /** 0-1, from lib/discovery/source-weight.ts's computeSourceWeightScore — 0 for series never processed by the Discovery Engine. */
  sourceWeightScore?: number;
  popularity?: number | null;
  voteAverage?: number | null;
  voteCount?: number | null;
  firstAirYear?: number | null;
  status: SeriesLifecycleStatus;
  watchProviders?: string[] | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  collectionTagsCount?: number | null;
  /** Already-computed 0-100 qualityScore, normalized to 0-1 as one input among many. */
  qualityScore?: number | null;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function presence(value: string | null | undefined) {
  return value ? 1 : 0;
}

/** Fase 7 — IMDb/TMDb-style Bayesian average: `(v/(v+m))*R + (m/(v+m))*C`, v=vote count, R=raw average, m=BAYESIAN_MIN_VOTES, C=prior mean. */
function bayesianRating(voteAverage: number | null | undefined, voteCount: number | null | undefined) {
  const v = voteCount ?? 0;
  const R = voteAverage ?? 0;
  if (v <= 0) return BAYESIAN_PRIOR_MEAN;
  return (v / (v + BAYESIAN_MIN_VOTES)) * R + (BAYESIAN_MIN_VOTES / (v + BAYESIAN_MIN_VOTES)) * BAYESIAN_PRIOR_MEAN;
}

function recencyScore(firstAirYear: number | null | undefined, status: SeriesLifecycleStatus, now: Date) {
  if (status === "RETURNING" || status === "IN_PRODUCTION" || status === "PILOT") return 1;
  if (!firstAirYear) return 0;
  const yearsSince = now.getFullYear() - firstAirYear;
  return clamp01(1 - yearsSince / RECENCY_DECAY_YEARS);
}

export function computeDiscoveryScore(input: DiscoveryScoreInput, now: Date = new Date()): number {
  const { scoreWeights: w } = config.discoveryEngine;
  const collectionTagsScore = clamp01((input.collectionTagsCount ?? 0) / 3);

  const signals: Array<[number, number]> = [
    [clamp01(input.sourceWeightScore ?? 0), w.trending],
    [clamp01((input.popularity ?? 0) / POPULARITY_CAP), w.popularity],
    [clamp01(bayesianRating(input.voteAverage, input.voteCount) / 10), w.voteAverage],
    [clamp01((input.voteCount ?? 0) / VOTE_COUNT_CAP), w.voteCount],
    [recencyScore(input.firstAirYear, input.status, now), w.recency],
    [STATUS_RELEVANCE[input.status] ?? 0.5, w.status],
    [computeStreamingPriorityScore(input.watchProviders), w.providers],
    [clamp01((input.numberOfSeasons ?? 0) / SEASONS_CAP), w.seasons],
    [clamp01((input.numberOfEpisodes ?? 0) / EPISODES_CAP), w.episodes],
    [presence(input.backdropUrl), w.backdrop],
    [presence(input.posterUrl), w.poster],
    [collectionTagsScore, w.collectionTags],
    [clamp01((input.qualityScore ?? 0) / 100), w.qualityScore]
  ];

  const totalWeight = signals.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = signals.reduce((sum, [value, weight]) => sum + value * weight, 0);
  return Math.round((weightedSum / totalWeight) * 100 * 100) / 100;
}
