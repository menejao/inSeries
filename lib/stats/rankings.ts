import type { AnalyticsDataset } from "@/lib/analytics/types";
import type { GenreStats, ProviderStats } from "@/lib/analytics/types";
import type { RankingEntry, StatsRankings } from "@/lib/stats/types";

function rankBy(counts: Map<string, number>, limit: number): RankingEntry[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: total ? Math.round((count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** INSERIES-STATISTICS-ENGINE-01 — "Rankings pessoais": series/generos/plataformas/emissoras/paises/idiomas, top 10 each. */
export function computeStatsRankings(dataset: AnalyticsDataset, genres: GenreStats, providers: ProviderStats): StatsRankings {
  const seriesCounts = new Map<string, number>();
  for (const episode of dataset.watchedEpisodes) {
    seriesCounts.set(episode.seriesTitle, (seriesCounts.get(episode.seriesTitle) ?? 0) + 1);
  }

  const networkCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  for (const status of dataset.seriesStatuses) {
    for (const network of status.networks) networkCounts.set(network, (networkCounts.get(network) ?? 0) + 1);
    for (const country of status.originCountry) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    for (const language of status.spokenLanguages) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  const genreTotal = genres.ranking.reduce((sum, g) => sum + g.episodeCount, 0);
  const providerTotal = providers.ranking.reduce((sum, p) => sum + p.seriesCount, 0);

  return {
    topSeries: rankBy(seriesCounts, 10),
    topGenres: genres.ranking
      .slice(0, 10)
      .map((g) => ({ label: g.genre, count: g.episodeCount, percentage: genreTotal ? Math.round((g.episodeCount / genreTotal) * 1000) / 10 : 0 })),
    topPlatforms: providers.ranking
      .slice(0, 10)
      .map((p) => ({ label: p.provider, count: p.seriesCount, percentage: providerTotal ? Math.round((p.seriesCount / providerTotal) * 1000) / 10 : 0 })),
    topNetworks: rankBy(networkCounts, 10),
    topCountries: rankBy(countryCounts, 10),
    topLanguages: rankBy(languageCounts, 10)
  };
}
