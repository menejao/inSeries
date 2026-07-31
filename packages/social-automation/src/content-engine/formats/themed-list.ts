import { seriesSource } from "../series-source";
import { getDictionary } from "../i18n";
import { contentEngineConfig } from "../../config";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

/** Configurable theme -> genre/keyword filter mapping (see i18n/pt-BR.ts's `themedLists`). Rotates themes day to day using the date so consecutive runs don't always pick the same theme. */
export const themedListFormat: ContentFormatSelector = {
  key: "themed-list",
  async selectCandidates(ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const dict = getDictionary();
    const themeKeys = Object.keys(dict.themedLists);
    if (themeKeys.length === 0) return [];

    const dayIndex = Math.floor(ctx.date.getTime() / (24 * 60 * 60 * 1000));
    const results: FormatCandidate[] = [];

    for (let offset = 0; offset < themeKeys.length; offset++) {
      const themeKey = themeKeys[(dayIndex + offset) % themeKeys.length];
      const theme = dict.themedLists[themeKey];
      const series = await seriesSource.byGenreOrKeyword(theme.genres ?? [], theme.keywords ?? [], contentEngineConfig.recommendationsPerPost + 2);
      if (series.length === 0) continue;

      results.push({
        score: series.reduce((sum, s) => sum + (s.discoveryScore ?? 0), 0) / series.length,
        sourceSeriesId: series[0].id,
        series,
        extra: { criterion: "themed-list", themeKey, themeLabel: theme.label }
      });
    }

    return results;
  }
};
