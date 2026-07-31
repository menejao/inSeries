import { seriesSource } from "../series-source";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const LIMIT = 10;

/** most-completed (UserSeriesStatus) and most-rated (Review) rankings — explicit `criterion` recorded in payload extra so the caption/template knows which list it's presenting. */
export const rankingFormat: ContentFormatSelector = {
  key: "ranking",
  async selectCandidates(_ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const [mostCompleted, mostRated] = await Promise.all([seriesSource.mostCompleted(LIMIT), seriesSource.mostRated(LIMIT)]);

    const candidates: FormatCandidate[] = [];

    if (mostCompleted.length > 0) {
      candidates.push({
        score: 100,
        sourceSeriesId: mostCompleted[0].id,
        series: mostCompleted,
        extra: {
          criterion: "most-completed",
          ranking: mostCompleted.map((s) => ({ seriesId: s.id, completedCount: s.completedCount }))
        }
      });
    }

    if (mostRated.length > 0) {
      candidates.push({
        score: 90,
        sourceSeriesId: mostRated[0].id,
        series: mostRated,
        extra: {
          criterion: "most-rated",
          ranking: mostRated.map((s) => ({ seriesId: s.id, avgRating: s.avgRating, reviewCount: s.reviewCount }))
        }
      });
    }

    return candidates;
  }
};
