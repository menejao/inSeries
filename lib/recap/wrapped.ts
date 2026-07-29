import { prisma } from "@/lib/db/prisma";
import { fetchAnalyticsDataset } from "@/lib/analytics/dataset";
import { computeGenreStats } from "@/lib/analytics/genres";
import { computeStreakStats } from "@/lib/analytics/streaks";
import { computeProviderStats } from "@/lib/analytics/providers";
import { getMostWatchedSeries } from "@/lib/analytics/insights";
import type { AnalyticsDataset } from "@/lib/analytics/types";
import { classifyViewerPersona } from "@/lib/stats/persona";
import { computeFunRecords } from "@/lib/stats/records";
import { computeStatsRankings } from "@/lib/stats/rankings";
import { computeCommunityComparison } from "@/lib/stats/community";
import { sliceEpisodesForYear, sliceStatusesCompletedInYear } from "@/lib/recap/yearly";
import type { WrappedData, WrappedFavoriteSeries, WrappedSlide } from "@/lib/recap/wrapped-types";

const AVERAGE_MOVIE_MINUTES = 110;
const MONTH_LABELS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function yearScopedDataset(dataset: AnalyticsDataset, year: number): AnalyticsDataset {
  const yearEpisodes = sliceEpisodesForYear(dataset.watchedEpisodes, year);
  // Broad inclusion (any activity touching the year) so persona/rankings/records still see
  // series the user was actively tracking that year, not only ones with a watched episode.
  const yearStatuses = dataset.seriesStatuses.filter((status) => {
    const dates = [status.startedAt, status.completedAt, status.lastActivityAt, status.addedAt].filter((d): d is Date => d !== null);
    return dates.some((date) => date.getUTCFullYear() === year);
  });
  return { ...dataset, watchedEpisodes: yearEpisodes, seriesStatuses: yearStatuses };
}

async function loadFavoriteSeries(seriesId: string, episodeCount: number): Promise<WrappedFavoriteSeries | null> {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true, slug: true, title: true, posterUrl: true, backdropUrl: true, logoUrl: true }
  });
  if (!series) return null;
  return {
    seriesId: series.id,
    slug: series.slug,
    title: series.title,
    episodeCount,
    posterUrl: series.posterUrl,
    backdropUrl: series.backdropUrl,
    logoUrl: series.logoUrl
  };
}

/**
 * INSERIES-RECAP-ENGINE-01 — the entire Wrapped, precomputed in one call (see wrapped-cache.ts
 * for the caching wrapper). Reuses the Analytics Layer + the persona/records/rankings/
 * community calculators built for INSERIES-STATISTICS-ENGINE-01, scoped to a single year via
 * `yearScopedDataset` instead of re-deriving any of that logic.
 */
export async function computeWrappedData(userId: string, year: number): Promise<WrappedData> {
  const dataset = await fetchAnalyticsDataset(userId);
  const yearDataset = yearScopedDataset(dataset, year);
  const yearEpisodes = yearDataset.watchedEpisodes;

  const hasData = yearEpisodes.length > 0;

  const genres = computeGenreStats(yearEpisodes);
  const streaks = computeStreakStats(yearEpisodes);
  const providers = computeProviderStats(yearDataset);
  const records = computeFunRecords(yearDataset);
  const rankings = computeStatsRankings(yearDataset, genres, providers);
  const persona = classifyViewerPersona({ overview: buildOverviewLike(yearDataset), genres, streaks, records, dataset: yearDataset });
  const community = await computeCommunityComparison(userId, dataset.watchedEpisodes.length);

  const minutesWatched = yearEpisodes.reduce((sum, episode) => sum + (episode.runtimeMinutes ?? 0), 0);
  const hoursWatched = Math.round((minutesWatched / 60) * 10) / 10;
  const daysWatched = Math.round((minutesWatched / 60 / 24) * 10) / 10;

  const previousYearMinutes = sliceEpisodesForYear(dataset.watchedEpisodes, year - 1).reduce(
    (sum, episode) => sum + (episode.runtimeMinutes ?? 0),
    0
  );
  const growthPercent = previousYearMinutes > 0 ? Math.round(((minutesWatched - previousYearMinutes) / previousYearMinutes) * 1000) / 10 : null;

  const seriesStarted = new Set(yearDataset.seriesStatuses.filter((s) => s.startedAt?.getUTCFullYear() === year).map((s) => s.seriesId)).size;
  const completedInYear = sliceStatusesCompletedInYear(dataset.seriesStatuses, year);
  const seasonsCompletedApprox = completedInYear.length; // one full-series completion ~= at least one season completed each — a reasonable proxy, no per-season completion date exists.

  const mostWatched = getMostWatchedSeries(yearEpisodes);
  const favoriteSeries = mostWatched ? await loadFavoriteSeries(mostWatched.seriesId, mostWatched.count) : null;

  const monthCounts = new Map<number, number>();
  for (const episode of yearEpisodes) monthCounts.set(episode.watchedAt.getUTCMonth(), (monthCounts.get(episode.watchedAt.getUTCMonth()) ?? 0) + 1);
  const activeMonthEntry = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const activeMonth = activeMonthEntry ? MONTH_LABELS[activeMonthEntry[0]] : null;

  const movieEquivalent = Math.round(minutesWatched / AVERAGE_MOVIE_MINUTES);

  const slides: WrappedSlide[] = [{ kind: "welcome", year }];

  slides.push({
    kind: "numbers",
    episodesWatched: yearEpisodes.length,
    seriesStarted,
    seriesCompleted: completedInYear.length,
    seasonsCompleted: seasonsCompletedApprox,
    insight: `Voce assistiu ${yearEpisodes.length} episodio${yearEpisodes.length === 1 ? "" : "s"} em ${year}.`
  });

  slides.push({
    kind: "time",
    hoursWatched,
    daysWatched,
    comparisons: [
      { label: "dias assistindo sem parar", value: `${daysWatched}` },
      { label: "filmes (media de 110 min)", value: `${movieEquivalent}+` },
      { label: "semanas de maratona", value: `${Math.round((daysWatched / 7) * 10) / 10}` }
    ],
    insight: `Voce passou mais de ${Math.ceil(daysWatched)} dia${Math.ceil(daysWatched) === 1 ? "" : "s"} da sua vida assistindo series em ${year}.`
  });

  if (favoriteSeries) {
    slides.push({
      kind: "favorite-series",
      series: favoriteSeries,
      insight: `${favoriteSeries.title} foi sua companhia durante o ano, com ${favoriteSeries.episodeCount} episodios assistidos.`
    });
  }

  if (genres.topGenre) {
    slides.push({
      kind: "favorite-genre",
      genre: genres.topGenre.genre,
      percentage: genres.topGenre.percentage,
      insight:
        genres.topGenre.percentage >= 40
          ? `${genres.topGenre.genre} dominou completamente seu ano — ${genres.topGenre.percentage}% de tudo que voce assistiu.`
          : `${genres.topGenre.genre} foi seu genero favorito, com ${genres.topGenre.percentage}% do seu tempo.`
    });
  }

  const topPlatform = rankings.topPlatforms[0]?.label ?? null;
  const topLanguage = rankings.topLanguages[0]?.label ?? null;
  const topCountry = rankings.topCountries[0]?.label ?? null;
  if (topPlatform || topLanguage || topCountry) {
    slides.push({
      kind: "platform-language-country",
      platform: topPlatform,
      language: topLanguage,
      country: topCountry,
      insight: topPlatform ? `Voce viveu principalmente na ${topPlatform} este ano.` : "Voce circulou por varias plataformas este ano."
    });
  }

  if (records.biggestBingeDay) {
    slides.push({
      kind: "biggest-binge",
      episodeCount: records.biggestBingeDay.episodeCount,
      date: records.biggestBingeDay.date,
      longestStreakDays: streaks.longestStreakDays,
      insight: `Sua maior maratona foi de ${records.biggestBingeDay.episodeCount} episodios em um unico dia.`
    });
  }

  if (records.favoriteWeekday || records.favoriteHour || activeMonth) {
    slides.push({
      kind: "habits",
      favoriteWeekday: records.favoriteWeekday?.label ?? null,
      favoriteHour: records.favoriteHour?.label ?? null,
      activeMonth,
      insight: records.favoriteWeekday
        ? `Voce assistiu mais series aos ${records.favoriteWeekday.label.toLowerCase()}s.`
        : "Seus habitos de maratona ficaram bem espalhados pelo ano."
    });
  }

  slides.push({ kind: "persona", persona });

  slides.push({
    kind: "comparison",
    percentile: community.episodesPercentile,
    ratioToAverage: community.ratioToAverage,
    growthPercent,
    insight:
      growthPercent !== null
        ? `Seu ritmo ${growthPercent >= 0 ? "aumentou" : "diminuiu"} ${Math.abs(growthPercent)}% em relacao ao ano passado.`
        : community.episodesPercentile !== null
          ? `Voce assistiu mais episodios do que ${community.episodesPercentile}% dos usuarios.`
          : "Cada ano sua jornada fica mais unica."
  });

  slides.push({ kind: "thanks", year });
  slides.push({ kind: "share", year });

  return {
    year,
    hasData,
    slides,
    persona,
    favoriteSeries,
    shareStats: {
      episodesWatched: yearEpisodes.length,
      hoursWatched,
      favoriteGenre: genres.topGenre?.genre ?? null,
      favoriteSeriesTitle: favoriteSeries?.title ?? null,
      biggestBingeEpisodeCount: records.biggestBingeDay?.episodeCount ?? null,
      currentStreakDays: streaks.currentStreakDays
    }
  };
}

/** classifyViewerPersona only reads a handful of OverviewStats fields (seriesTracked/seriesWatching/seriesDropped/seriesCompleted) — build just those from the year-scoped dataset instead of pulling in the full overview calculator (which also computes unrelated fields like daysSinceSignup). */
function buildOverviewLike(dataset: AnalyticsDataset) {
  const completed = dataset.seriesStatuses.filter((s) => s.state === "COMPLETED").length;
  const watching = dataset.seriesStatuses.filter((s) => s.state === "WATCHING").length;
  const dropped = dataset.seriesStatuses.filter((s) => s.state === "DROPPED").length;
  return {
    seriesCompleted: completed,
    seriesWatching: watching,
    seriesPaused: dataset.seriesStatuses.filter((s) => s.state === "PAUSED").length,
    seriesDropped: dropped,
    seriesPlanned: dataset.seriesStatuses.filter((s) => s.state === "WANT_TO_WATCH").length,
    seriesTracked: dataset.seriesStatuses.length,
    seasonsCompleted: 0,
    episodesWatched: dataset.watchedEpisodes.length,
    episodesRemaining: 0,
    averageCompletionPercent: 0,
    averageEpisodesPerSeries: 0,
    daysSinceSignup: 0
  };
}
