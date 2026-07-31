import { seriesSource } from "../series-source";
import { similarityScore } from "../similarity";
import { contentEngineConfig } from "../../config";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const SEED_POOL_SIZE = 10;
const CANDIDATE_POOL_SIZE = 60;

/** Source series (from the top-discovery pool, real data) + N recommendations via the ported similarity blend. */
export const similarSeriesFormat: ContentFormatSelector = {
  key: "similar-series",
  async selectCandidates(_ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const seeds = await seriesSource.randomSeedSeries(SEED_POOL_SIZE);
    if (seeds.length === 0) return [];

    const candidatePool = await seriesSource.candidatesExcluding(
      seeds.map((s) => s.id),
      CANDIDATE_POOL_SIZE
    );

    const results: FormatCandidate[] = [];

    for (const seed of seeds) {
      const scored = candidatePool
        .map((candidate) => ({ candidate, score: similarityScore(seed, candidate) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, contentEngineConfig.recommendationsPerPost);

      if (scored.length === 0) continue;

      const avgScore = scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length;

      results.push({
        score: avgScore,
        sourceSeriesId: seed.id,
        series: [seed, ...scored.map((entry) => entry.candidate)],
        extra: { criterion: "similarity", recommendations: scored.map((entry) => ({ seriesId: entry.candidate.id, score: entry.score })) }
      });
    }

    return results;
  }
};
