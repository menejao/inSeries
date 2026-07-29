import type { ViewerPersona } from "@/lib/stats/types";

export type WrappedComparison = { label: string; value: string };

export type WrappedFavoriteSeries = {
  seriesId: string;
  slug: string;
  title: string;
  episodeCount: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
};

export type WrappedSlide =
  | { kind: "welcome"; year: number }
  | { kind: "numbers"; episodesWatched: number; seriesStarted: number; seriesCompleted: number; seasonsCompleted: number; insight: string }
  | { kind: "time"; hoursWatched: number; daysWatched: number; comparisons: WrappedComparison[]; insight: string }
  | { kind: "favorite-series"; series: WrappedFavoriteSeries; insight: string }
  | { kind: "favorite-genre"; genre: string; percentage: number; insight: string }
  | { kind: "platform-language-country"; platform: string | null; language: string | null; country: string | null; insight: string }
  | { kind: "biggest-binge"; episodeCount: number; date: string | null; longestStreakDays: number; insight: string }
  | { kind: "habits"; favoriteWeekday: string | null; favoriteHour: string | null; activeMonth: string | null; insight: string }
  | { kind: "persona"; persona: ViewerPersona }
  | { kind: "comparison"; percentile: number | null; ratioToAverage: number | null; growthPercent: number | null; insight: string }
  | { kind: "thanks"; year: number }
  | { kind: "share"; year: number };

export type WrappedData = {
  year: number;
  hasData: boolean;
  slides: WrappedSlide[];
  persona: ViewerPersona;
  favoriteSeries: WrappedFavoriteSeries | null;
  shareStats: {
    episodesWatched: number;
    hoursWatched: number;
    favoriteGenre: string | null;
    favoriteSeriesTitle: string | null;
    biggestBingeEpisodeCount: number | null;
    currentStreakDays: number;
  };
};
