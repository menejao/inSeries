import type { WatchState } from "@prisma/client";

/**
 * One watched episode, denormalized with just enough of its series/season
 * context that every calculator in this layer can work from this single
 * array without re-querying the database (see dataset.ts).
 *
 * `watchedAt` is guaranteed non-null: `lib/progress/mutations.ts` always
 * clears it back to `null` when an episode is unmarked, so any row that
 * survives the `watched: true` filter always has a real timestamp.
 */
export type WatchedEpisodeRecord = {
  episodeId: string;
  episodeTitle: string;
  seriesId: string;
  seriesTitle: string;
  seriesGenres: string[];
  seasonId: string;
  seasonNumber: number;
  seasonEpisodeCount: number;
  episodeNumber: number;
  runtimeMinutes: number | null;
  watchedAt: Date;
};

/** One series the user has an explicit status for (watching, completed, etc). */
export type SeriesStatusRecord = {
  seriesId: string;
  seriesTitle: string;
  seriesGenres: string[];
  state: WatchState;
  completionPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  totalEpisodes: number;
};

/** The single read model every stat in this layer is derived from — see dataset.ts. */
export type AnalyticsDataset = {
  userId: string;
  memberSince: Date;
  watchedEpisodes: WatchedEpisodeRecord[];
  seriesStatuses: SeriesStatusRecord[];
};

export type OverviewStats = {
  seriesCompleted: number;
  seriesWatching: number;
  seriesPaused: number;
  seriesDropped: number;
  seriesPlanned: number;
  seriesTracked: number;
  seasonsCompleted: number;
  episodesWatched: number;
  episodesRemaining: number;
  averageCompletionPercent: number;
  averageEpisodesPerSeries: number;
  daysSinceSignup: number;
};

export type WatchTimeStats = {
  minutesWatched: number;
  hoursWatched: number;
  daysWatched: number;
  averageMinutesPerEpisode: number | null;
  averageMinutesPerSeries: number | null;
  episodesWithoutRuntime: number;
};

export type GenreStat = {
  genre: string;
  episodeCount: number;
  percentage: number;
};

export type GenreStats = {
  ranking: GenreStat[];
  topGenre: GenreStat | null;
};

export type TimelineBucket = { key: string; count: number };

export type TimelineStats = {
  perDay: TimelineBucket[];
  perWeek: TimelineBucket[];
  perMonth: TimelineBucket[];
  perYear: TimelineBucket[];
};

export type MonthlyRecapData = {
  year: number;
  month: number;
  episodesWatched: number;
  minutesWatched: number;
  topGenre: GenreStat | null;
  seriesCompleted: string[];
};

export type YearlyRecapData = {
  year: number;
  episodesWatched: number;
  minutesWatched: number;
  topGenre: GenreStat | null;
  seriesCompleted: string[];
  activeDays: number;
};

export type StreakStats = {
  currentStreakDays: number;
  longestStreakDays: number;
  activeDays: number;
  firstWatchedAt: Date | null;
  lastWatchedAt: Date | null;
};

export type Insight = {
  id: string;
  text: string;
};

export type UserStats = {
  generatedAt: string;
  overview: OverviewStats;
  watchTime: WatchTimeStats;
  genres: GenreStats;
  timeline: TimelineStats;
  streaks: StreakStats;
  insights: Insight[];
};
