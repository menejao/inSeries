import type { SeriesSummary } from "./types";

/**
 * Ported/simplified from lib/recommendations/providers/similar-series-provider.ts. This package
 * cannot import lib/* (app/-boundary isolation — see db/client.ts's own PrismaClient instead of
 * importing lib/db/prisma.ts), so the genre/keyword/collectionTags Jaccard blend is reimplemented
 * here, plus a few extra light-weight layers the ticket asks for ("mais camadas"): country
 * match, language match, popularity closeness and rating closeness — all small weights that
 * renormalize alongside the original three so the 0-100 scale is preserved.
 */
const GENRE_WEIGHT = 0.45;
const KEYWORD_WEIGHT = 0.25;
const TAG_WEIGHT = 0.12;
const COUNTRY_WEIGHT = 0.06;
const LANGUAGE_WEIGHT = 0.06;
const POPULARITY_WEIGHT = 0.03;
const RATING_WEIGHT = 0.03;

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return a.some((item) => setB.has(item)) ? 1 : 0;
}

function closeness(a: number | null | undefined, b: number | null | undefined, scale: number): number {
  if (a === null || a === undefined || b === null || b === undefined) return 0;
  const diff = Math.abs(a - b);
  return Math.max(0, 1 - diff / scale);
}

/** Blended overlap score (0-1) between a seed series and a candidate. */
export function blendedSimilarity(seed: SeriesSummary, candidate: SeriesSummary): number {
  const genreScore = jaccard(candidate.genres, seed.genres) * GENRE_WEIGHT;
  const keywordScore = jaccard(candidate.keywords, seed.keywords) * KEYWORD_WEIGHT;
  const tagScore = jaccard(candidate.collectionTags, seed.collectionTags) * TAG_WEIGHT;
  const countryScore = overlapRatio(candidate.originCountry, seed.originCountry) * COUNTRY_WEIGHT;
  const languageScore = overlapRatio(candidate.spokenLanguages, seed.spokenLanguages) * LANGUAGE_WEIGHT;
  const popularityScore = closeness(candidate.popularityScore, seed.popularityScore, 100) * POPULARITY_WEIGHT;
  const ratingScore = closeness(candidate.voteAverage, seed.voteAverage, 5) * RATING_WEIGHT;

  return genreScore + keywordScore + tagScore + countryScore + languageScore + popularityScore + ratingScore;
}

/** 0-100, rounded — matches similar-series-provider.ts's output scale. */
export function similarityScore(seed: SeriesSummary, candidate: SeriesSummary): number {
  return Math.round(Math.min(1, blendedSimilarity(seed, candidate)) * 100);
}
