import type { WatchState } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { diffInCalendarDays } from "@/lib/calendar/dates";
import type { WatchNextItem, WatchNextResult, WatchNextUserState } from "@/lib/watch-next/types";

/** Fase 4 — only series actively being watched or planned; completed/dropped/paused never appear. */
const ELIGIBLE_STATES: WatchState[] = ["WATCHING", "WANT_TO_WATCH"];

/** An episode aired within this many days counts as "recently released" instead of "overdue" (Fase 8). */
const RECENT_THRESHOLD_DAYS = 3;

/**
 * The only place that decides "what should I watch next" — reused by the Dashboard
 * ("Novos para voce"/"Pendencias", via lib/continue-watching), `GET /api/me/watch-next`,
 * `/series/[id]` and `/profile/[username]`'s own continue-watching blocks. The standalone
 * `/watch-next` page was retired (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01, Fase 2) — its
 * queue now lives on the Dashboard. Never touches progress data itself;
 * `toggleEpisodeProgress` (lib/progress/mutations.ts) remains the single place that writes
 * UserEpisodeProgress/UserSeriesStatus.
 */
export async function getWatchNextForUser(userId: string, options: { limit?: number } = {}): Promise<WatchNextResult> {
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId, state: { in: ELIGIBLE_STATES } },
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

  const now = new Date();
  const items: WatchNextItem[] = [];

  for (const status of statuses) {
    const orderedEpisodes = status.series.seasons.flatMap((season) =>
      season.episodes.map((episode) => ({ episode, seasonNumber: season.number }))
    );

    // Fase 4: an episode that hasn't aired yet is never counted as "pending" — the user simply can't watch it yet.
    const airedUnwatched = orderedEpisodes.filter(
      ({ episode }) => episode.airedAt !== null && episode.airedAt <= now && !episode.progress[0]?.watched
    );

    if (airedUnwatched.length === 0) continue;

    const next = airedUnwatched[0];
    const airedAt = next.episode.airedAt as Date;
    const daysSinceAired = diffInCalendarDays(now, airedAt);

    items.push({
      series: {
        id: status.series.id,
        slug: status.series.slug,
        title: status.series.title,
        posterUrl: status.series.posterUrl
      },
      userState: status.state as WatchNextUserState,
      episode: {
        id: next.episode.id,
        seasonNumber: next.seasonNumber,
        number: next.episode.number,
        title: next.episode.title,
        stillUrl: next.episode.stillUrl,
        airedAt
      },
      pendingAfterNext: airedUnwatched.length - 1,
      totalPending: airedUnwatched.length,
      isOverdue: daysSinceAired > RECENT_THRESHOLD_DAYS,
      isNew: daysSinceAired <= RECENT_THRESHOLD_DAYS,
      isPremiere: next.episode.number === 1
    });
  }

  // Oldest pending episode first — the most overdue series is what the user most needs to catch up on.
  items.sort((a, b) => a.episode.airedAt.getTime() - b.episode.airedAt.getTime());

  return {
    items: options.limit ? items.slice(0, options.limit) : items,
    hasTrackedSeries: statuses.length > 0
  };
}
