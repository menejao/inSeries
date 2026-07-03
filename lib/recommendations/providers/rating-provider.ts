import type { ProviderSignal, RecommendationContext, RecommendationProvider } from "@/lib/recommendations/types";
import { positiveReviewReason, ratingReason } from "@/lib/recommendations/reasons";

const POSITIVE_REVIEW_BOOST = 20;

/**
 * Two signals, either of which is enough to produce a score:
 *  - the catalog's own TMDb `voteAverage` (0-10, scaled to 0-100) — a
 *    quality signal that needs no user history;
 *  - a personalization boost when the candidate shares a genre with a
 *    series the user rated highly in their own reviews (rating >= 4/5),
 *    which is what Fase 6's "Baseado nas suas avaliacoes" reason refers to.
 * The personalized reason wins when both apply — it's the more specific,
 * more useful explanation of the two.
 */
export const ratingProvider: RecommendationProvider = {
  id: "rating",
  label: "Bem avaliadas",
  run(context: RecommendationContext): ProviderSignal[] {
    const signals: ProviderSignal[] = [];

    for (const candidate of context.candidates) {
      const personalizedGenre = candidate.genres.find((genre) => (context.positivelyReviewedGenres.get(genre) ?? 0) > 0);
      const baseScore = candidate.voteAverage ? candidate.voteAverage * 10 : 0;

      if (!personalizedGenre && baseScore <= 0) continue;

      const score = Math.min(100, baseScore + (personalizedGenre ? POSITIVE_REVIEW_BOOST : 0));
      const reason = personalizedGenre ? positiveReviewReason() : ratingReason(candidate.voteAverage ?? 0);

      signals.push({ seriesId: candidate.id, score, reason });
    }

    return signals;
  }
};
