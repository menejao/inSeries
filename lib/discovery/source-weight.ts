import { config } from "@/lib/config";
import type { DiscoverySourceKey } from "@/lib/catalog/aggregator";
import type { WeightedSourceDefinition } from "@/lib/discovery/providers/types";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Fase 2 — a candidate's "how many, and how strong, of the weighted discovery sources
 * surfaced it" signal, normalized to 0-1. A series found only in Discover (weight 0.10)
 * scores low; one found in Trending + On The Air scores near 1. This is what actually
 * decides ranking order within the Discovery Engine (lib/discovery/engine.ts) — distinct
 * from lib/catalog/aggregator.ts's `priorityScore`, which the existing coverage pipeline
 * still uses unchanged.
 */
export function computeSourceWeightScore(sources: DiscoverySourceKey[], weightedSources: WeightedSourceDefinition[]): number {
  const weightByKey = new Map(weightedSources.map((source) => [source.key, source.weight]));
  const totalConfiguredWeight = weightedSources.reduce((sum, source) => sum + source.weight, 0);
  if (totalConfiguredWeight <= 0) return 0;

  const matchedWeight = sources.reduce((sum, key) => sum + (weightByKey.get(key) ?? 0), 0);
  return clamp01(matchedWeight / totalConfiguredWeight);
}

/** Fase 4 — 0-1 score reflecting whether (and how strongly) a series is on a prioritized streaming service. */
export function computeStreamingPriorityScore(watchProviders: string[] | null | undefined): number {
  const priorityList = config.discoveryEngine.streamingPriorityList;
  if (!watchProviders?.length || !priorityList.length) return 0;

  const matches = watchProviders.some((provider) => priorityList.includes(provider));
  return matches ? 1 : 0;
}
