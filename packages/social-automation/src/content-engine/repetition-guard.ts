import { prisma } from "../db/client";
import { contentEngineConfig } from "../config";
import type { SocialContent } from "@prisma/client";

export interface RecentContentWindow {
  bySourceSeriesId: Set<string>;
  formatYesterday: string | null;
  usedCtaIds: Set<string>;
  usedHookIds: Set<string>;
  usedHashtagSets: Set<string>;
  usedRecommendationSets: Set<string>;
  raw: SocialContent[];
}

/**
 * Loads the repetition-relevant window of recent SocialContent rows once per pipeline run —
 * every guard check below reads from this instead of re-querying, and every format/CTA/hook/
 * hashtag module that needs a repetition check calls into this module rather than reimplementing
 * "same X within N days" logic itself.
 */
export async function loadRecentContentWindow(referenceDate: Date = new Date()): Promise<RecentContentWindow> {
  const since = new Date(referenceDate);
  since.setDate(since.getDate() - contentEngineConfig.repetitionIntervalDays);

  const recent = await prisma.socialContent.findMany({
    where: { createdAt: { gte: since, lt: referenceDate } },
    orderBy: { createdAt: "desc" }
  });

  const bySourceSeriesId = new Set(recent.map((c) => c.sourceSeriesId).filter((id): id is string => Boolean(id)));
  const usedCtaIds = new Set(recent.map((c) => c.ctaId).filter((id): id is string => Boolean(id)));
  const usedHookIds = new Set(recent.map((c) => c.hookId).filter((id): id is string => Boolean(id)));

  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEntry = recent.find((c) => {
    const created = new Date(c.createdAt);
    return created.toDateString() === yesterday.toDateString();
  });

  const usedHashtagSets = new Set<string>();
  const usedRecommendationSets = new Set<string>();
  for (const item of recent) {
    const payload = item.payload as { hashtags?: string[]; items?: Array<{ id: string }> } | null;
    if (payload?.hashtags && payload.hashtags.length > 0) {
      usedHashtagSets.add([...payload.hashtags].sort().join("|"));
    }
    if (payload?.items && payload.items.length > 0) {
      usedRecommendationSets.add(
        payload.items
          .map((s) => s.id)
          .sort()
          .join("|")
      );
    }
  }

  return {
    bySourceSeriesId,
    formatYesterday: yesterdayEntry?.format ?? null,
    usedCtaIds,
    usedHookIds,
    usedHashtagSets,
    usedRecommendationSets,
    raw: recent
  };
}

/** Blocks reusing the same sourceSeriesId within `repetitionIntervalDays` (default 30). */
export function isSeriesRepeated(window: RecentContentWindow, seriesId: string | null): boolean {
  return seriesId ? window.bySourceSeriesId.has(seriesId) : false;
}

/** Blocks the same format on consecutive days, unless the editorial calendar explicitly repeats it (e.g. themed-list on fri+sat). */
export function isFormatRepeatedConsecutively(window: RecentContentWindow, format: string, calendarAllowsRepeat: boolean): boolean {
  if (calendarAllowsRepeat) return false;
  return window.formatYesterday === format;
}

export function isCtaRepeated(window: RecentContentWindow, ctaId: string): boolean {
  return window.usedCtaIds.has(ctaId);
}

export function isHookRepeated(window: RecentContentWindow, hookId: string): boolean {
  return window.usedHookIds.has(hookId);
}

export function isHashtagSetRepeated(window: RecentContentWindow, hashtags: string[]): boolean {
  return window.usedHashtagSets.has([...hashtags].sort().join("|"));
}

export function isRecommendationSetRepeated(window: RecentContentWindow, seriesIds: string[]): boolean {
  if (seriesIds.length === 0) return false;
  return window.usedRecommendationSets.has([...seriesIds].sort().join("|"));
}
