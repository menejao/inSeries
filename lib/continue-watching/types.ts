import type { WatchNextUserState } from "@/lib/watch-next";

/**
 * Fase 2 (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) — same episode-selection shape as
 * WatchNextItem (lib/watch-next/types.ts) plus the extra display fields this section needs
 * (backdrop, series/season progress, last watched episode, last activity, runtime). Never a
 * parallel "what's next" type — every field describing *which* episode is next comes
 * straight from the reused WatchNextItem.
 */
export type ContinueWatchingItem = {
  series: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
  };
  userState: WatchNextUserState;
  episode: {
    id: string;
    seasonNumber: number;
    number: number;
    title: string;
    stillUrl: string | null;
    airedAt: Date;
    runtimeMinutes: number | null;
  };
  pendingAfterNext: number;
  totalPending: number;
  isOverdue: boolean;
  isNew: boolean;
  isPremiere: boolean;
  /** From UserSeriesStatus.completionPercent — already maintained by toggleEpisodeProgress/upsertSeriesStatus, never recomputed here. */
  seriesProgressPercent: number;
  /** Watched-episodes / total-episodes within the season the next episode belongs to. */
  seasonProgressPercent: number;
  lastWatchedEpisode: {
    seasonNumber: number;
    number: number;
    title: string;
    watchedAt: Date;
  } | null;
  /** From UserSeriesStatus.lastActivityAt — drives the Fase 3 ordering. */
  lastActivityAt: Date | null;
};

export type ContinueWatchingResult = {
  items: ContinueWatchingItem[];
  /** Reused meaning from WatchNextResult — distinguishes "nothing tracked" from "tracked but nothing pending". */
  hasTrackedSeries: boolean;
};
