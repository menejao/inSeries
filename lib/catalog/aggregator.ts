import { config } from "@/lib/config";
import { describeTmdbError } from "@/lib/tmdb/errors";
import type { TmdbListSeriesItem } from "@/lib/catalog/normalize";
import type { SyncCache } from "@/lib/catalog/sync-cache";

/**
 * Fase 2 (INSERIES-TMDB-CATALOG-COVERAGE-01) — the six discovery sources the ticket wants
 * consolidated before any sync work begins.
 */
export type DiscoverySourceKey = "POPULAR_SERIES" | "DISCOVER" | "TOP_RATED" | "ON_THE_AIR" | "AIRING_TODAY" | "TRENDING";

export type SourceDefinition = {
  key: DiscoverySourceKey;
  pages: number;
  fetchPage: (page: number) => Promise<TmdbListSeriesItem[]>;
};

export type AggregatedCandidate = {
  tmdbId: string;
  item: TmdbListSeriesItem;
  /** Every source that surfaced this id — used both for the report and for the priority bonuses below. */
  sources: DiscoverySourceKey[];
  priorityScore: number;
};

export type AggregationError = { source: string; message: string };

export type AggregationResult = {
  perSourceCounts: Record<DiscoverySourceKey, number>;
  totalCollected: number;
  uniqueCount: number;
  duplicatesRemoved: number;
  /** Successfully fetched pages across every source, for the observability report. */
  pagesProcessed: number;
  /** Deduplicated, sorted by priorityScore descending (Fase 4). */
  candidates: AggregatedCandidate[];
  errors: AggregationError[];
};

/**
 * Fase 4 — a single weighted score, same shape as the recommendation engine's provider
 * scoring (lib/recommendations/scoring.ts): every signal contributes `value * weight`,
 * summed. `vote_count`/`popularity`/`vote_average` come straight from the list item — no
 * extra TMDb call. "Em exibicao" and "novos episodios" bonuses come from which source(s)
 * surfaced the candidate (On The Air literally means airing now; Airing Today literally
 * means an episode airs today) — again, zero extra calls.
 */
function computePriorityScore(item: TmdbListSeriesItem, sources: DiscoverySourceKey[]): number {
  const { priorityWeightPopularity, priorityWeightVoteCount, priorityWeightVoteAverage, priorityOnAirBonus, priorityNewEpisodeBonus } =
    config.catalogSync;

  let score = 0;
  score += (item.popularity ?? 0) * priorityWeightPopularity;
  score += (item.vote_count ?? 0) * priorityWeightVoteCount;
  score += (item.vote_average ?? 0) * priorityWeightVoteAverage;
  if (sources.includes("ON_THE_AIR") || sources.includes("AIRING_TODAY")) score += priorityOnAirBonus;
  if (sources.includes("AIRING_TODAY")) score += priorityNewEpisodeBonus;

  return score;
}

/**
 * Fase 2/3 — fetches every configured page of every source, merges every item into one
 * map keyed by TMDb id (the "chave primaria da fila" the ticket asks for), tracking which
 * source(s) contributed each id, then scores and sorts the deduplicated result (Fase 4).
 * A page that fails to fetch is reported as an error and skipped — never aborts the rest.
 */
export async function collectCandidates(sources: SourceDefinition[], cache: SyncCache): Promise<AggregationResult> {
  const perSourceCounts = {} as Record<DiscoverySourceKey, number>;
  const merged = new Map<string, AggregatedCandidate>();
  const errors: AggregationError[] = [];
  let totalCollected = 0;
  let pagesProcessed = 0;

  for (const source of sources) {
    let sourceCount = 0;

    for (let page = 1; page <= source.pages; page += 1) {
      let items: TmdbListSeriesItem[];
      try {
        items = await cache.getOrFetchPage(source.key, page, () => source.fetchPage(page));
      } catch (error) {
        errors.push({ source: `${source.key} pagina ${page}`, message: describeTmdbError(error) });
        continue;
      }

      pagesProcessed += 1;
      sourceCount += items.length;
      totalCollected += items.length;

      for (const item of items) {
        const tmdbId = String(item.id);
        const existing = merged.get(tmdbId);
        if (existing) {
          if (!existing.sources.includes(source.key)) existing.sources.push(source.key);
          continue;
        }
        merged.set(tmdbId, { tmdbId, item, sources: [source.key], priorityScore: 0 });
      }
    }

    perSourceCounts[source.key] = sourceCount;
  }

  const candidates = Array.from(merged.values());
  for (const candidate of candidates) {
    candidate.priorityScore = computePriorityScore(candidate.item, candidate.sources);
  }
  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    perSourceCounts,
    totalCollected,
    uniqueCount: candidates.length,
    duplicatesRemoved: totalCollected - candidates.length,
    pagesProcessed,
    candidates,
    errors
  };
}
