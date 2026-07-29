import type { GenreStats, Insight, OverviewStats, ProviderStats, StreakStats, TimelineStats, WatchTimeStats } from "@/lib/analytics/types";

/** INSERIES-STATISTICS-ENGINE-01 — the dynamically-generated "viewer profile" shown in the hero. */
export type ViewerPersona = {
  slug: string;
  emoji: string;
  title: string;
  description: string;
};

export type RankingEntry = { label: string; count: number; percentage: number };

export type StatsRankings = {
  topSeries: RankingEntry[];
  topGenres: RankingEntry[];
  topPlatforms: RankingEntry[];
  topNetworks: RankingEntry[];
  topCountries: RankingEntry[];
  topLanguages: RankingEntry[];
};

export type FunRecords = {
  biggestBingeDay: { date: string; episodeCount: number } | null;
  favoriteHour: { hour: number; label: string; episodeCount: number } | null;
  favoriteWeekday: { weekday: number; label: string; episodeCount: number } | null;
  averageEpisodesPerSession: number | null;
  longestSeriesCompleted: { title: string; episodeCount: number } | null;
  fastestCompletion: { title: string; days: number } | null;
  longestTracked: { title: string; days: number } | null;
  lateNightEpisodes: number;
};

export type GrowthMetric = { current: number; previous: number; deltaPercent: number | null };

export type GrowthStats = {
  episodes: GrowthMetric;
  hours: GrowthMetric;
  seriesCompleted: GrowthMetric;
};

export type MilestoneEvent = {
  id: string;
  label: string;
  date: Date | null;
  achieved: boolean;
};

export type GoalProgress = {
  id: string;
  label: string;
  current: number;
  target: number;
  percent: number;
};

export type CommunityComparison = {
  episodesPercentile: number | null;
  ratioToAverage: number | null;
};

export type DayDetailEpisode = { seriesTitle: string; episodeTitle: string; watchedAt: string };

export type StatsPageData = {
  generatedAt: string;
  hasData: boolean;
  overview: OverviewStats;
  watchTime: WatchTimeStats;
  genres: GenreStats;
  timeline: TimelineStats;
  streaks: StreakStats;
  providers: ProviderStats;
  insights: Insight[];
  persona: ViewerPersona;
  rankings: StatsRankings;
  records: FunRecords;
  growth: GrowthStats;
  milestones: MilestoneEvent[];
  goals: GoalProgress[];
  community: CommunityComparison;
  dayDetails: Record<string, DayDetailEpisode[]>;
  curiosities: string[];
};
