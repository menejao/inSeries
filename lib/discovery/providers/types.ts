import type { SourceDefinition } from "@/lib/catalog/aggregator";

/**
 * Fase 8 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the abstraction the ticket asks to
 * "prepare" (never implement) for Trakt: any discovery backend that can hand the engine
 * a set of weighted, page-fetchable sources satisfies this contract. `TmdbDiscoveryProvider`
 * (tmdb-provider.ts) is the only implementation this sprint — a future `TraktDiscoveryProvider`
 * would fetch from Trakt's own trending/popular/anticipated endpoints, normalize them into the
 * same `TmdbListSeriesItem`-shaped candidates (or a shared superset type), and plug in here
 * without the Discovery Engine (lib/discovery/engine.ts) changing at all.
 */
export type DiscoveryProviderOptions = {
  pages?: Partial<Record<string, number>>;
};

export type WeightedSourceDefinition = SourceDefinition & { weight: number };

export type DiscoveryProvider = {
  /** Unique key, surfaced in observability (e.g. run metadata) so multi-provider setups can tell sources apart. */
  key: string;
  /** Human-readable name for CLI/report output. */
  name: string;
  /** Every source this provider can contribute, each with its configured ranking weight (Fase 2). */
  buildWeightedSources(options?: DiscoveryProviderOptions): WeightedSourceDefinition[];
};
