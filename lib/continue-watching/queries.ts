import { prisma } from "@/lib/db/prisma";
import { getWatchNextForUser } from "@/lib/watch-next";
import type { ContinueWatchingItem, ContinueWatchingResult } from "@/lib/continue-watching/types";

/**
 * Fase 2/6/9 (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) — "Continuar assistindo" never
 * recomputes which episode is next: it calls the exact same `getWatchNextForUser`
 * (lib/watch-next/queries.ts) every other consumer (/watch-next, GET /api/me/watch-next)
 * uses, unlimited (no `limit`) so this section can apply its own ordering (Fase 3) over
 * the full set before slicing. If that algorithm ever changes, this section changes with
 * it automatically — no parallel rule.
 *
 * Everything added on top (backdrop, series/season progress, last watched episode, next
 * episode runtime) comes from a fixed, small number of additional batched queries — never
 * one query per series/episode (Fase 9): every extra query below is a single
 * `WHERE ... IN (...)`, bounded by how many series the user tracks, not by catalog size.
 */
export async function getContinueWatchingForUser(userId: string, options: { limit?: number } = {}): Promise<ContinueWatchingResult> {
  const watchNext = await getWatchNextForUser(userId);

  if (!watchNext.items.length) {
    return { items: [], hasTrackedSeries: watchNext.hasTrackedSeries };
  }

  const seriesIds = watchNext.items.map((item) => item.series.id);
  const nextEpisodeIds = watchNext.items.map((item) => item.episode.id);

  const [seriesRows, statusRows, seasonRows, watchedProgressRows, nextEpisodeRows] = await Promise.all([
    prisma.series.findMany({ where: { id: { in: seriesIds } }, select: { id: true, backdropUrl: true } }),
    prisma.userSeriesStatus.findMany({
      where: { userId, seriesId: { in: seriesIds } },
      select: { seriesId: true, completionPercent: true, lastActivityAt: true, startedAt: true }
    }),
    prisma.season.findMany({ where: { seriesId: { in: seriesIds } }, select: { seriesId: true, number: true, episodeCount: true } }),
    prisma.userEpisodeProgress.findMany({
      where: { userId, watched: true, episode: { season: { seriesId: { in: seriesIds } } } },
      orderBy: { watchedAt: "desc" },
      select: {
        watchedAt: true,
        episode: { select: { number: true, title: true, season: { select: { number: true, seriesId: true } } } }
      }
    }),
    prisma.episode.findMany({ where: { id: { in: nextEpisodeIds } }, select: { id: true, runtimeMinutes: true } })
  ]);

  const backdropBySeriesId = new Map(seriesRows.map((row) => [row.id, row.backdropUrl]));
  const statusBySeriesId = new Map(statusRows.map((row) => [row.seriesId, row]));
  const seasonTotalsBySeriesAndNumber = new Map(seasonRows.map((row) => [`${row.seriesId}:${row.number}`, row.episodeCount]));
  const runtimeByEpisodeId = new Map(nextEpisodeRows.map((row) => [row.id, row.runtimeMinutes]));

  // Fase 2 — last watched episode + watched-count-per-season, both derived from the same
  // single query above (rows already ordered watchedAt desc, so the first occurrence per
  // seriesId is the most recent).
  const lastWatchedBySeriesId = new Map<string, { seasonNumber: number; number: number; title: string; watchedAt: Date }>();
  const watchedCountBySeasonKey = new Map<string, number>();
  for (const row of watchedProgressRows) {
    if (!row.watchedAt) continue;
    const seriesId = row.episode.season.seriesId;
    const seasonKey = `${seriesId}:${row.episode.season.number}`;
    watchedCountBySeasonKey.set(seasonKey, (watchedCountBySeasonKey.get(seasonKey) ?? 0) + 1);

    if (!lastWatchedBySeriesId.has(seriesId)) {
      lastWatchedBySeriesId.set(seriesId, {
        seasonNumber: row.episode.season.number,
        number: row.episode.number,
        title: row.episode.title,
        watchedAt: row.watchedAt
      });
    }
  }

  const items: ContinueWatchingItem[] = watchNext.items.map((item) => {
    const status = statusBySeriesId.get(item.series.id);
    const seasonKey = `${item.series.id}:${item.episode.seasonNumber}`;
    const seasonTotal = seasonTotalsBySeriesAndNumber.get(seasonKey) ?? 0;
    const seasonWatched = watchedCountBySeasonKey.get(seasonKey) ?? 0;

    return {
      series: {
        id: item.series.id,
        slug: item.series.slug,
        title: item.series.title,
        posterUrl: item.series.posterUrl,
        backdropUrl: backdropBySeriesId.get(item.series.id) ?? null
      },
      userState: item.userState,
      episode: {
        id: item.episode.id,
        seasonNumber: item.episode.seasonNumber,
        number: item.episode.number,
        title: item.episode.title,
        stillUrl: item.episode.stillUrl,
        airedAt: item.episode.airedAt,
        runtimeMinutes: runtimeByEpisodeId.get(item.episode.id) ?? null
      },
      pendingAfterNext: item.pendingAfterNext,
      totalPending: item.totalPending,
      isOverdue: item.isOverdue,
      isNew: item.isNew,
      isPremiere: item.isPremiere,
      seriesProgressPercent: status?.completionPercent ?? 0,
      seasonProgressPercent: seasonTotal > 0 ? Math.round((seasonWatched / seasonTotal) * 100) : 0,
      lastWatchedEpisode: lastWatchedBySeriesId.get(item.series.id) ?? null,
      lastActivityAt: status?.lastActivityAt ?? null
    };
  });

  // Fase 3 — ordering: (1) most recent user activity on the series, (2+3) every item here
  // already has a pending episode by construction (getWatchNextForUser only ever returns
  // series with one), so the next tiebreak is "acompanhada recentemente" (startedAt desc),
  // (4) falling back to Watch Next's own order (oldest pending episode first).
  const startedAtBySeriesId = new Map(statusRows.map((row) => [row.seriesId, row.startedAt]));
  items.sort((a, b) => {
    const activityDiff = (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0);
    if (activityDiff !== 0) return activityDiff;

    const startedA = startedAtBySeriesId.get(a.series.id)?.getTime() ?? 0;
    const startedB = startedAtBySeriesId.get(b.series.id)?.getTime() ?? 0;
    if (startedB !== startedA) return startedB - startedA;

    return a.episode.airedAt.getTime() - b.episode.airedAt.getTime();
  });

  return {
    items: options.limit ? items.slice(0, options.limit) : items,
    hasTrackedSeries: watchNext.hasTrackedSeries
  };
}
