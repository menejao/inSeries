import { seriesSource } from "../series-source";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const POOL_SIZE = 15;

/** Scores by discoveryScore/qualityScore (both already persisted columns) — the fallback format used whenever another format runs out of real candidates. */
export const seriesOfTheDayFormat: ContentFormatSelector = {
  key: "series-of-the-day",
  async selectCandidates(_ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const series = await seriesSource.topByQualityAndDiscovery(POOL_SIZE);

    return series.map((s) => ({
      score: s.discoveryScore ?? s.qualityScore ?? 0,
      sourceSeriesId: s.id,
      series: [s]
    }));
  }
};
