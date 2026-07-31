import { getDictionary } from "../i18n";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

/** Configurable list of real product features (see i18n/pt-BR.ts's `inseriesFeatures`); must not repeat on consecutive days — checked directly against ctx.recentContent's payload.extra.featureId. */
export const inseriesFeatureFormat: ContentFormatSelector = {
  key: "inseries-feature",
  async selectCandidates(ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const dict = getDictionary();

    const recentFeatureIds = new Set(
      ctx.recentContent
        .map((c) => (c.payload as { extra?: { featureId?: string } } | null)?.extra?.featureId)
        .filter((id): id is string => Boolean(id))
    );

    const available = dict.inseriesFeatures.filter((feature) => !recentFeatureIds.has(feature.id));
    const pool = available.length > 0 ? available : dict.inseriesFeatures;

    return pool.map((feature, index) => ({
      score: 100 - index,
      sourceSeriesId: null,
      series: [],
      extra: { criterion: "product-feature", featureId: feature.id, featureTitle: feature.title, featureDescription: feature.description }
    }));
  }
};
