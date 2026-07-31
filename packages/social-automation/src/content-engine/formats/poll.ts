import { seriesSource } from "../series-source";
import { getDictionary } from "../i18n";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const OPTION_COUNT = 3;

/** Question template bank (i18n) + real candidate series as poll options. */
export const pollFormat: ContentFormatSelector = {
  key: "poll",
  async selectCandidates(_ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const options = await seriesSource.topByDiscoveryScore(OPTION_COUNT * 3);
    if (options.length < 2) return [];

    const dict = getDictionary();
    const chosenOptions = options.slice(0, OPTION_COUNT);
    const questionTemplate = dict.pollQuestions[0];
    const question = questionTemplate.replace("{options}", chosenOptions.map((s) => s.title).join(", "));

    return [
      {
        score: chosenOptions.reduce((sum, s) => sum + (s.discoveryScore ?? 0), 0) / chosenOptions.length,
        sourceSeriesId: chosenOptions[0].id,
        series: chosenOptions,
        extra: { criterion: "poll", question, options: chosenOptions.map((s) => ({ seriesId: s.id, label: s.title })) }
      }
    ];
  }
};
