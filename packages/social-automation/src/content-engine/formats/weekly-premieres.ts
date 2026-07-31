import { seriesSource } from "../series-source";
import { logger } from "../../logger";
import type { ContentFormatSelector, FormatCandidate, FormatSelectionContext } from "../types";

const WINDOW_DAYS = 7;
const POOL_SIZE = 10;

/**
 * Real premiere-date data: Episode.airedAt (DateTime?) is the only reliable air-date field in
 * the schema — Season only has `airYear: Int?`, too coarse for a "this week" window, and there
 * is no dedicated "next/last premiere" column on Series. LIMITATION: airedAt is only populated
 * for episodes TMDb has already reported air dates for, and this queries the *past* 7 days
 * (upcoming premieres aren't reliably known — TMDb doesn't guarantee forward-looking air dates
 * for unaired episodes at sync time), so this surfaces "episodes that aired this week" rather
 * than "premiering this week" in the strict future sense. Documented here and logged via
 * history (CONTENT_FALLBACK_APPLIED at the select-topic layer) — the format still runs and
 * returns [] cleanly (never throws) when no episodes aired in the window.
 */
export const weeklyPremieresFormat: ContentFormatSelector = {
  key: "weekly-premieres",
  async selectCandidates(ctx: FormatSelectionContext): Promise<FormatCandidate[]> {
    const until = ctx.date;
    const since = new Date(until);
    since.setDate(since.getDate() - WINDOW_DAYS);

    let series: Awaited<ReturnType<typeof seriesSource.premieresBetween>> = [];
    try {
      series = await seriesSource.premieresBetween(since, until, POOL_SIZE);
    } catch (error) {
      logger.warn("content-engine:weekly-premieres:query-failed", {
        module: "content-engine",
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
      return [];
    }

    return series.map((s) => ({
      score: s.discoveryScore ?? s.qualityScore ?? 0,
      sourceSeriesId: s.id,
      series: [s],
      extra: { criterion: "episode-aired-in-window", windowDays: WINDOW_DAYS }
    }));
  }
};
