import { prisma } from "../db/client";
import { contentRepo } from "../db/content-repo";
import { recordHistory } from "../history";
import { logger } from "../logger";
import { formatForDate, calendarExplicitlyRepeats } from "./editorial-calendar";
import { getFormatSelector, seriesOfTheDayFormat } from "./formats";
import {
  loadRecentContentWindow,
  isSeriesRepeated,
  isFormatRepeatedConsecutively,
  isRecommendationSetRepeated,
  type RecentContentWindow
} from "./repetition-guard";
import { selectHook } from "./hooks-library";
import { selectCta } from "./cta-engine";
import { generateHashtags } from "./hashtag-generator";
import { buildCaption } from "./caption-builder";
import { checkTextSafety, safeVoteAverage, safeWatchProviders } from "./editorial-safety";
import { getDictionary } from "./i18n";
import type { ContentFormatKey } from "../config";
import type { ContentPayload, FormatCandidate, FormatSelectionContext, SeriesSummary } from "./types";
import type { SocialContent } from "@prisma/client";

export interface SelectTopicOptions {
  date?: Date;
  /** Dry-run/preview: returns the built payload without persisting a SocialContent row. */
  persist?: boolean;
}

export interface SelectTopicResult {
  payload: ContentPayload;
  content: SocialContent | null;
}

async function loadRecentContentForContext(referenceDate: Date): Promise<FormatSelectionContext["recentContent"]> {
  const since = new Date(referenceDate);
  since.setDate(since.getDate() - 14);
  const rows = await prisma.socialContent.findMany({
    where: { createdAt: { gte: since, lt: referenceDate } },
    orderBy: { createdAt: "desc" },
    select: { format: true, sourceSeriesId: true, payload: true, createdAt: true }
  });
  return rows;
}

function pickBestCandidate(
  candidates: FormatCandidate[],
  window: RecentContentWindow
): FormatCandidate | null {
  const nonRepeated = candidates.filter((c) => {
    if (isSeriesRepeated(window, c.sourceSeriesId)) return false;
    const itemIds = c.series.map((s) => s.id);
    if (isRecommendationSetRepeated(window, itemIds)) return false;
    return true;
  });

  const pool = nonRepeated.length > 0 ? nonRepeated : candidates;
  if (pool.length === 0) return null;

  return [...pool].sort((a, b) => b.score - a.score)[0];
}

function primaryTitle(candidate: FormatCandidate, formatKey: ContentFormatKey, extra: Record<string, unknown> | undefined): string {
  if (formatKey === "inseries-feature") {
    return (extra?.featureTitle as string) ?? "inSeries";
  }
  return candidate.series[0]?.title ?? "inSeries";
}

function buildContext(series: SeriesSummary[]): string {
  if (series.length === 0) return "";
  const [first] = series;
  const parts: string[] = [];
  if (first.overview) parts.push(first.overview.length > 220 ? `${first.overview.slice(0, 217)}...` : first.overview);
  const providers = safeWatchProviders(first.watchProviders);
  if (providers.length > 0) {
    const dict = getDictionary();
    parts.push(dict.captionConnectors.watchProviders.replace("{providers}", providers.join(", ")));
  }
  return parts.join(" ");
}

/**
 * Orchestration pipeline: calendar -> format for date -> fetch candidates -> score -> filter via
 * repetition-guard -> pick best -> build structured payload -> persist as SocialContent DRAFT
 * (or return payload only in dry-run/preview mode).
 */
export async function selectTopic(options: SelectTopicOptions = {}): Promise<SelectTopicResult> {
  const date = options.date ?? new Date();
  const persist = options.persist ?? true;

  await recordHistory({ action: "CONTENT_SELECTION_STARTED", detail: { date: date.toISOString() } });

  let formatKey = formatForDate(date);
  const recentContentRows = await loadRecentContentForContext(date);
  const window = await loadRecentContentWindow(date);

  const selectionContext: FormatSelectionContext = { date, recentContent: recentContentRows };

  let candidates = await getFormatSelector(formatKey).selectCandidates(selectionContext);

  await recordHistory({
    action: "CONTENT_CANDIDATES_ANALYZED",
    detail: { format: formatKey, candidateCount: candidates.length }
  });

  let usedFallback = false;
  if (candidates.length === 0 && formatKey !== "series-of-the-day") {
    usedFallback = true;
    await recordHistory({
      action: "CONTENT_FALLBACK_APPLIED",
      detail: { reason: `format "${formatKey}" returned no candidates`, fallbackFormat: "series-of-the-day" }
    });
    logger.warn("content-engine:select-topic:fallback", { module: "content-engine", metadata: { originalFormat: formatKey } });
    formatKey = "series-of-the-day";
    candidates = await seriesOfTheDayFormat.selectCandidates(selectionContext);
  }

  const chosen = pickBestCandidate(candidates, window);
  if (!chosen) {
    throw new Error(`selectTopic: no candidates available for format "${formatKey}" (including fallback)`);
  }

  const extra = (chosen.extra ?? {}) as Record<string, unknown>;
  const title = primaryTitle(chosen, formatKey, extra);
  const sourceSeries = chosen.series[0] ?? null;

  const hook = selectHook(window, title);
  const cta = selectCta(window, formatKey, title);

  const context = formatKey === "poll" ? (extra.question as string) ?? "" : buildContext(chosen.series);
  const contentBody =
    formatKey === "inseries-feature" ? (extra.featureDescription as string) ?? "" : sourceSeries?.overview ?? "";

  const hashtags = generateHashtags(window, {
    seriesTitles: chosen.series.map((s) => s.title),
    genres: chosen.series.flatMap((s) => s.genres),
    contentType: formatKey
  });

  const caption = buildCaption({ hook: hook.text, context, content: contentBody, cta: cta.text }, hashtags);

  const safety = checkTextSafety([hook.text, caption, cta.text, sourceSeries?.overview ?? ""]);
  if (safety.flags.length > 0) {
    await recordHistory({
      action: "CONTENT_REJECTED_SAFETY",
      detail: { flags: safety.flags, note: "flagged, not auto-rejected — requires human review via approval.ts" }
    });
  }

  const items = chosen.series.slice(1).map((s) => ({ ...s, voteAverage: safeVoteAverage(s.voteAverage), watchProviders: safeWatchProviders(s.watchProviders) }));

  const payload: ContentPayload = {
    type: formatKey,
    title,
    hook: hook.text,
    sourceSeries: sourceSeries
      ? { ...sourceSeries, voteAverage: safeVoteAverage(sourceSeries.voteAverage), watchProviders: safeWatchProviders(sourceSeries.watchProviders) }
      : null,
    items,
    caption,
    cta: { id: cta.id, text: cta.text },
    hashtags,
    templateKey: formatKey,
    requiresApproval: true,
    format: formatKey,
    hookId: hook.id,
    extra: { ...extra, usedFallback, calendarRepeatsConsecutive: calendarExplicitlyRepeats(date) }
  };

  await recordHistory({
    action: "CONTENT_TOPIC_SELECTED",
    detail: { format: formatKey, sourceSeriesId: sourceSeries?.id ?? null, title, usedFallback }
  });

  if (!persist) {
    return { payload, content: null };
  }

  const guardBlocksFormatRepeat = isFormatRepeatedConsecutively(window, formatKey, calendarExplicitlyRepeats(date));
  if (guardBlocksFormatRepeat) {
    logger.warn("content-engine:select-topic:format-repeat-guard", {
      module: "content-engine",
      metadata: { format: formatKey, note: "format repeated from yesterday without calendar allowance — persisting anyway, flagged in payload.extra" }
    });
    payload.extra = { ...payload.extra, formatRepeatWarning: true };
  }

  const content = await contentRepo.createWithPayload({
    type: formatKey,
    title,
    description: caption,
    status: "DRAFT",
    format: formatKey,
    sourceSeriesId: sourceSeries?.id ?? null,
    ctaId: cta.id,
    hookId: hook.id,
    payload: payload as unknown as Record<string, unknown>
  });

  await recordHistory({
    action: "CONTENT_GENERATED",
    contentId: content.id,
    detail: { format: formatKey, source: "content-engine" }
  });

  return { payload, content };
}
