import type { WatchState } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addDays, isSameDay, diffInCalendarDays, startOfDay } from "@/lib/calendar/dates";

const ACTIVE_STATES: WatchState[] = ["WATCHING", "WANT_TO_WATCH"];

export type CalendarEpisode = {
  id: string;
  title: string;
  number: number;
  seasonNumber: number;
  airedAt: Date;
  watched: boolean;
  watchedAt: Date | null;
  stillUrl: string | null;
  userState: WatchState;
  series: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
  };
};

export type FutureSeason = {
  seasonId: string;
  seasonNumber: number;
  seasonTitle: string;
  airYear: number | null;
  series: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
  };
};

async function loadUserCalendarData(userId: string) {
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId, state: { in: ACTIVE_STATES } },
    include: {
      series: {
        include: {
          seasons: {
            orderBy: { number: "asc" },
            include: {
              episodes: {
                orderBy: { number: "asc" },
                include: { progress: { where: { userId } } }
              }
            }
          }
        }
      }
    }
  });

  const episodes: CalendarEpisode[] = [];
  const futureSeasons: FutureSeason[] = [];

  for (const status of statuses) {
    for (const season of status.series.seasons) {
      if (season.episodes.length === 0) {
        futureSeasons.push({
          seasonId: season.id,
          seasonNumber: season.number,
          seasonTitle: season.title,
          airYear: season.airYear,
          series: {
            id: status.series.id,
            slug: status.series.slug,
            title: status.series.title,
            posterUrl: status.series.posterUrl
          }
        });
        continue;
      }

      for (const episode of season.episodes) {
        if (!episode.airedAt) continue;

        episodes.push({
          id: episode.id,
          title: episode.title,
          number: episode.number,
          seasonNumber: season.number,
          airedAt: episode.airedAt,
          watched: episode.progress[0]?.watched ?? false,
          watchedAt: episode.progress[0]?.watchedAt ?? null,
          stillUrl: episode.stillUrl,
          userState: status.state,
          series: {
            id: status.series.id,
            slug: status.series.slug,
            title: status.series.title,
            posterUrl: status.series.posterUrl,
            backdropUrl: status.series.backdropUrl
          }
        });
      }
    }
  }

  return { episodes, futureSeasons };
}

export async function getPersonalCalendarSections(userId: string) {
  const { episodes, futureSeasons } = await loadUserCalendarData(userId);
  const now = new Date();
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);

  const todayEpisodes = episodes.filter((episode) => isSameDay(episode.airedAt, now));
  const thisWeek = episodes
    .filter((episode) => episode.airedAt > today && episode.airedAt <= weekEnd && !isSameDay(episode.airedAt, now))
    .sort((a, b) => a.airedAt.getTime() - b.airedAt.getTime());
  const upcoming = episodes
    .filter((episode) => episode.airedAt > weekEnd)
    .sort((a, b) => a.airedAt.getTime() - b.airedAt.getTime())
    .slice(0, 20);
  const overdue = episodes
    .filter((episode) => episode.airedAt < today && !episode.watched)
    .sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime());
  const recentlyWatched = episodes
    .filter((episode) => episode.watched && episode.watchedAt && episode.watchedAt >= addDays(now, -14))
    .sort((a, b) => (b.watchedAt?.getTime() ?? 0) - (a.watchedAt?.getTime() ?? 0))
    .slice(0, 10);

  return {
    today: todayEpisodes,
    thisWeek,
    upcoming,
    futureSeasons,
    overdue,
    recentlyWatched
  };
}

export async function getDashboardCalendarData(userId: string, lastVisitAt: Date) {
  const { episodes } = await loadUserCalendarData(userId);
  const now = new Date();

  const sinceLastVisit = episodes
    .filter((ep) => !ep.watched && ep.airedAt > lastVisitAt && ep.airedAt <= now)
    .sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime())
    .slice(0, 10);

  const upcoming = episodes
    .filter((ep) => !ep.watched && ep.airedAt > now)
    .sort((a, b) => a.airedAt.getTime() - b.airedAt.getTime())
    .slice(0, 5);

  const overdue = episodes
    .filter((ep) => !ep.watched && ep.airedAt <= lastVisitAt)
    .sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime())
    .slice(0, 5);

  return { sinceLastVisit, upcoming, overdue };
}

export async function getUpcomingEpisodesForUser(userId: string, limit = 5) {
  const { episodes } = await loadUserCalendarData(userId);
  const now = new Date();
  const today = startOfDay(now);

  return episodes
    .filter((episode) => episode.airedAt >= today && !episode.watched)
    .sort((a, b) => a.airedAt.getTime() - b.airedAt.getTime())
    .slice(0, limit);
}

export async function getNextEpisodeForSeries(seriesId: string) {
  const now = new Date();
  const today = startOfDay(now);

  const episode = await prisma.episode.findFirst({
    where: {
      season: { seriesId },
      airedAt: { gte: today }
    },
    orderBy: { airedAt: "asc" },
    include: { season: true }
  });

  if (!episode || !episode.airedAt) {
    return null;
  }

  return {
    id: episode.id,
    title: episode.title,
    number: episode.number,
    seasonNumber: episode.season.number,
    airedAt: episode.airedAt,
    daysRemaining: diffInCalendarDays(episode.airedAt, now)
  };
}

export type GlobalCalendarRange = "today" | "week" | "month";

export async function getGlobalCalendarEpisodes(params: {
  range: GlobalCalendarRange;
  genre?: string;
  language?: string;
  onlyMine?: boolean;
  onlyUnwatched?: boolean;
  onlyUnaired?: boolean;
  userId?: string | null;
}) {
  const now = new Date();
  const today = startOfDay(now);
  const rangeDays = params.range === "today" ? 1 : params.range === "week" ? 7 : 30;
  const rangeEnd = addDays(today, rangeDays);

  let seriesIdFilter: string[] | undefined;
  if (params.onlyMine && params.userId) {
    const statuses = await prisma.userSeriesStatus.findMany({
      where: { userId: params.userId },
      select: { seriesId: true }
    });
    seriesIdFilter = statuses.map((status) => status.seriesId);
    if (seriesIdFilter.length === 0) {
      return [];
    }
  }

  const episodes = await prisma.episode.findMany({
    where: {
      airedAt: { gte: today, lt: rangeEnd },
      season: {
        series: {
          ...(seriesIdFilter ? { id: { in: seriesIdFilter } } : {}),
          ...(params.genre ? { genres: { has: params.genre } } : {}),
          ...(params.language ? { language: params.language } : {})
        }
      }
    },
    include: {
      season: { include: { series: true } },
      progress: params.userId ? { where: { userId: params.userId } } : false
    },
    orderBy: { airedAt: "asc" },
    take: 100
  });

  return episodes
    .filter((episode) => {
      if (params.onlyUnaired && episode.airedAt && episode.airedAt < now) return false;
      if (params.onlyUnwatched && params.userId) {
        const watched = "progress" in episode && Array.isArray(episode.progress) && episode.progress[0]?.watched;
        if (watched) return false;
      }
      return true;
    })
    .map((episode) => ({
      id: episode.id,
      title: episode.title,
      number: episode.number,
      seasonNumber: episode.season.number,
      airedAt: episode.airedAt as Date,
      stillUrl: episode.stillUrl,
      series: {
        id: episode.season.series.id,
        slug: episode.season.series.slug,
        title: episode.season.series.title,
        posterUrl: episode.season.series.posterUrl,
        backdropUrl: episode.season.series.backdropUrl,
        genres: episode.season.series.genres,
        language: episode.season.series.language
      }
    }));
}
