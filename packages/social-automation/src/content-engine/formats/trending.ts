import { seriesSource } from "../series-source";
import { contentEngineConfig } from "../../config";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const POOL_SIZE = 15;

/** Series.discoveryScore ordered desc with configurable min rating/votes/popularity/recency filters — no score reimplementation needed since discoveryScore is already persisted by lib/catalog/sync.ts. */
export const trendingFormat: ContentFormatSelector = {
  key: "trending",
  async selectCandidates(_ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const series = await seriesSource.topByDiscoveryScore(POOL_SIZE, {
      minVotes: contentEngineConfig.minVotes || undefined,
      minRating: contentEngineConfig.minRating || undefined,
      minPopularity: contentEngineConfig.minPopularity || undefined,
      maxAgeYears: contentEngineConfig.trendingMaxAgeYears
    });

    return series.map((s) => ({
      score: s.discoveryScore ?? 0,
      sourceSeriesId: s.id,
      series: [s],
      extra: { criterion: "discoveryScore" }
    }));
  }
};
