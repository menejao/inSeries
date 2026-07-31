import { seriesOfTheDayFormat } from "./series-of-the-day";
import { similarSeriesFormat } from "./similar-series";
import { trendingFormat } from "./trending";
import { weeklyPremieresFormat } from "./weekly-premieres";
import { rankingFormat } from "./ranking";
import { pollFormat } from "./poll";
import { themedListFormat } from "./themed-list";
import { inseriesFeatureFormat } from "./inseries-feature";
import type { ContentFormatKey } from "../../config";
import type { ContentFormatSelector } from "../types";

export const formatRegistry: Record<ContentFormatKey, ContentFormatSelector> = {
  "series-of-the-day": seriesOfTheDayFormat,
  "similar-series": similarSeriesFormat,
  trending: trendingFormat,
  "weekly-premieres": weeklyPremieresFormat,
  ranking: rankingFormat,
  poll: pollFormat,
  "themed-list": themedListFormat,
  "inseries-feature": inseriesFeatureFormat
};

export function getFormatSelector(key: ContentFormatKey): ContentFormatSelector {
  return formatRegistry[key];
}

export type { ContentFormatSelector } from "../types";
export {
  seriesOfTheDayFormat,
  similarSeriesFormat,
  trendingFormat,
  weeklyPremieresFormat,
  rankingFormat,
  pollFormat,
  themedListFormat,
  inseriesFeatureFormat
};
