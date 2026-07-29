import { config } from "@/lib/config";
import { fetchAnalyticsDataset } from "@/lib/analytics/dataset";
import { computeOverviewStats } from "@/lib/analytics/overview";
import { computeWatchTimeStats } from "@/lib/analytics/watch-time";
import { computeGenreStats } from "@/lib/analytics/genres";
import { computeTimelineStats } from "@/lib/analytics/timeline";
import { computeStreakStats } from "@/lib/analytics/streaks";
import { computeProviderStats } from "@/lib/analytics/providers";
import { generateInsights } from "@/lib/analytics/insights";
import { classifyViewerPersona } from "@/lib/stats/persona";
import { computeFunRecords } from "@/lib/stats/records";
import { computeGrowthStats } from "@/lib/stats/growth";
import { computeStatsRankings } from "@/lib/stats/rankings";
import { computeMilestones } from "@/lib/stats/milestones";
import { computeGoalsProgress } from "@/lib/stats/goals";
import { computeCommunityComparison } from "@/lib/stats/community";
import { getCachedStats, setCachedStats } from "@/lib/stats/cache";
import type { DayDetailEpisode, StatsPageData } from "@/lib/stats/types";

function buildCuriosities(data: Omit<StatsPageData, "curiosities">): string[] {
  const candidates: string[] = [];

  if (data.genres.topGenre) {
    candidates.push(`${data.genres.topGenre.genre} representa ${data.genres.topGenre.percentage}% de tudo que voce assistiu.`);
  }
  if (data.records.favoriteWeekday) {
    candidates.push(`Voce assiste mais aos ${data.records.favoriteWeekday.label.toLowerCase()}s.`);
  }
  if (data.records.favoriteHour) {
    candidates.push(`Seu horario favorito para assistir episodios e por volta das ${data.records.favoriteHour.label}.`);
  }
  if (data.records.lateNightEpisodes > 0) {
    candidates.push(`Voce ja assistiu ${data.records.lateNightEpisodes} episodio(s) depois da meia-noite.`);
  }
  if (data.records.biggestBingeDay) {
    candidates.push(`Sua maior maratona foi de ${data.records.biggestBingeDay.episodeCount} episodios em um unico dia.`);
  }
  const topSeries = data.rankings.topSeries[0];
  if (topSeries) {
    candidates.push(`${topSeries.label} e a serie que voce mais assistiu, com ${topSeries.count} episodios.`);
  }
  if (data.streaks.longestStreakDays > 1) {
    candidates.push(`Voce ja manteve uma sequencia de ${data.streaks.longestStreakDays} dias seguidos assistindo series.`);
  }
  if (data.watchTime.daysWatched > 0) {
    candidates.push(`Voce ja passou ${data.watchTime.daysWatched} dia(s) da sua vida assistindo series.`);
  }
  if (data.community.ratioToAverage !== null) {
    candidates.push(`Voce assiste ${data.community.ratioToAverage}x a media de episodios da comunidade.`);
  }

  // Different each visit (ticket: "cada acesso pode exibir curiosidades diferentes") — the
  // underlying facts are always real, only the sampling order is randomized per request.
  return candidates.sort(() => Math.random() - 0.5).slice(0, 5);
}

function buildDayDetails(dataset: Awaited<ReturnType<typeof fetchAnalyticsDataset>>): Record<string, DayDetailEpisode[]> {
  const byDay: Record<string, DayDetailEpisode[]> = {};
  for (const episode of dataset.watchedEpisodes) {
    const key = episode.watchedAt.toISOString().slice(0, 10);
    (byDay[key] ??= []).push({ seriesTitle: episode.seriesTitle, episodeTitle: episode.episodeTitle, watchedAt: episode.watchedAt.toISOString() });
  }
  return byDay;
}

async function computeStatsPageData(userId: string): Promise<StatsPageData> {
  const dataset = await fetchAnalyticsDataset(userId);

  const overview = computeOverviewStats(dataset);
  const watchTime = computeWatchTimeStats(dataset);
  const genres = computeGenreStats(dataset.watchedEpisodes);
  const timeline = computeTimelineStats(dataset.watchedEpisodes);
  const streaks = computeStreakStats(dataset.watchedEpisodes);
  const providers = computeProviderStats(dataset);
  const insights = generateInsights({ overview, watchTime, genres, streaks, watchedEpisodes: dataset.watchedEpisodes });

  const records = computeFunRecords(dataset);
  const persona = classifyViewerPersona({ overview, genres, streaks, records, dataset });
  const rankings = computeStatsRankings(dataset, genres, providers);
  const growth = computeGrowthStats(dataset);
  const milestones = computeMilestones(dataset, streaks, records);
  const goals = computeGoalsProgress(overview, watchTime);
  const community = await computeCommunityComparison(userId, overview.episodesWatched);
  const dayDetails = buildDayDetails(dataset);

  const base = {
    generatedAt: new Date().toISOString(),
    hasData: overview.episodesWatched > 0 || overview.seriesTracked > 0,
    overview,
    watchTime,
    genres,
    timeline,
    streaks,
    providers,
    insights,
    persona,
    rankings,
    records,
    growth,
    milestones,
    goals,
    community,
    dayDetails
  };

  return { ...base, curiosities: buildCuriosities(base) };
}

/** INSERIES-STATISTICS-ENGINE-01 — single entry point for the redesigned /me/stats page, cached (see lib/stats/cache.ts). */
export async function getStatsPageData(userId: string): Promise<StatsPageData> {
  const cached = getCachedStats(userId);
  if (cached) return cached;

  const data = await computeStatsPageData(userId);
  setCachedStats(userId, data, config.stats.cacheTtlSeconds);
  return data;
}
