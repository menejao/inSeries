/**
 * Template map: `templateKey` (from the Content Engine) -> the composition module.
 *
 * The registry (registry/) declares *metadata* (which formats are supported, max slides…);
 * this file binds those ids to the actual builders. Both are keyed by the same TemplateKey union,
 * so a new template cannot be added to one without the compiler demanding the other.
 */
import { seriesOfTheDayTemplate } from "./series-of-the-day";
import { similarSeriesTemplate } from "./similar-series";
import { trendingTemplate } from "./trending";
import { rankingTemplate } from "./ranking";
import { pollTemplate } from "./poll";
import { weeklyPremieresTemplate } from "./weekly-premieres";
import { themedListTemplate } from "./themed-list";
import { inseriesFeatureTemplate } from "./inseries-feature";
import { isTemplateKey } from "../registry";
import { TemplateEngineError, type SocialTemplate, type TemplateKey } from "../types";

export const templates: Record<TemplateKey, SocialTemplate> = {
  "series-of-the-day": seriesOfTheDayTemplate,
  "similar-series": similarSeriesTemplate,
  trending: trendingTemplate,
  ranking: rankingTemplate,
  poll: pollTemplate,
  "weekly-premieres": weeklyPremieresTemplate,
  "themed-list": themedListTemplate,
  "inseries-feature": inseriesFeatureTemplate
};

export function getTemplate(key: string): SocialTemplate | null {
  return isTemplateKey(key) ? templates[key] : null;
}

/** Same lookup, but throwing — used by the package builder where an unknown key is a real bug. */
export function requireTemplate(key: string): SocialTemplate {
  const template = getTemplate(key);
  if (!template) {
    throw new TemplateEngineError(`templateKey "${key}" desconhecido — nenhum template registrado para essa chave.`);
  }
  return template;
}

export {
  seriesOfTheDayTemplate,
  similarSeriesTemplate,
  trendingTemplate,
  rankingTemplate,
  pollTemplate,
  weeklyPremieresTemplate,
  themedListTemplate,
  inseriesFeatureTemplate
};
