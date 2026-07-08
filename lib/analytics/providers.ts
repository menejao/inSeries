import type { AnalyticsDataset, ProviderStats } from "@/lib/analytics/types";

/**
 * Fase 6 (INSERIES-DASHBOARD-PREMIUM-01) — "provedor predominante": which streaming
 * service shows up most often across the series the user actually tracks (any status),
 * counted once per series (a series available on 3 providers doesn't inflate the count
 * 3x — it contributes 1 to each of its providers, same weight as any other series).
 * Purely derived from `AnalyticsDataset.seriesStatuses` — no extra query.
 */
export function computeProviderStats(dataset: AnalyticsDataset): ProviderStats {
  const seriesCountByProvider = new Map<string, number>();

  for (const status of dataset.seriesStatuses) {
    for (const provider of status.seriesWatchProviders) {
      seriesCountByProvider.set(provider, (seriesCountByProvider.get(provider) ?? 0) + 1);
    }
  }

  const ranking = [...seriesCountByProvider.entries()]
    .map(([provider, seriesCount]) => ({ provider, seriesCount }))
    .sort((a, b) => b.seriesCount - a.seriesCount);

  return {
    ranking,
    topProvider: ranking[0] ?? null
  };
}
