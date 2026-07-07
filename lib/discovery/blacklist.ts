import { config } from "@/lib/config";
import { mapStatusToPrisma, type NormalizedCatalogSeries, type TmdbListSeriesItem } from "@/lib/catalog/normalize";

/**
 * Fase 5 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — a dedicated blacklist for the Discovery
 * Engine's own candidate intake (lib/discovery/engine.ts). Deliberately separate from
 * lib/catalog/curation.ts, which keeps gating the pre-existing syncPopularSeries/
 * syncCoverage/syncDiscoverSeries/etc. pipelines exactly as before ("não alterar pipeline
 * já existente"). This module's defaults are stricter on purpose — the whole point of this
 * sprint is that "hundreds of obscure series" should stop reaching Trending Collections,
 * the Hero and "Bombando Agora", even though the underlying sync pipeline itself still
 * imports them under the old, looser curation rules.
 */
export type BlacklistVerdict = { passes: boolean; reason?: string };

const PASS: BlacklistVerdict = { passes: true };
const DAY_MS = 24 * 60 * 60 * 1000;

/** List-item level (cheap fields only) — runs before any full TMDb detail fetch, same two-checkpoint shape as curation.ts. */
export function passesListItemBlacklist(item: TmdbListSeriesItem): BlacklistVerdict {
  const { blacklist } = config.discoveryEngine;
  if (!blacklist.enabled) return PASS;

  if (blacklist.minVoteCount > 0 && (item.vote_count ?? 0) < blacklist.minVoteCount) {
    return { passes: false, reason: `poucos votos (${item.vote_count ?? 0} abaixo do minimo ${blacklist.minVoteCount})` };
  }

  if (blacklist.minVoteAverage > 0 && (item.vote_count ?? 0) > 0 && (item.vote_average ?? 0) < blacklist.minVoteAverage) {
    return { passes: false, reason: `nota ${item.vote_average ?? 0} abaixo do minimo (${blacklist.minVoteAverage})` };
  }

  return PASS;
}

/** Detail level (full normalized series) — catches what a list item can't show. */
export function passesDetailBlacklist(series: NormalizedCatalogSeries, now: Date = new Date()): BlacklistVerdict {
  const { blacklist } = config.discoveryEngine;
  if (!blacklist.enabled) return PASS;

  if (blacklist.requirePoster && !series.posterUrl) {
    return { passes: false, reason: "sem poster" };
  }

  if (blacklist.requireBackdrop && !series.backdropUrl) {
    return { passes: false, reason: "sem backdrop" };
  }

  if (blacklist.requireOverview && !series.overview?.trim()) {
    return { passes: false, reason: "sem overview" };
  }

  if (mapStatusToPrisma(series.status) === "PILOT" && series.year) {
    const firstAirDate = new Date(series.year, 0, 1);
    const ageDays = (now.getTime() - firstAirDate.getTime()) / DAY_MS;
    if (ageDays > blacklist.maxPilotAgeDays) {
      return { passes: false, reason: `piloto abandonado (${Math.round(ageDays)} dias sem avancar de PILOT)` };
    }
  }

  const hasNoEpisodes = series.seasons.length === 0 || series.seasons.every((season) => season.episodes.length === 0);
  if (blacklist.requireEpisodes && hasNoEpisodes && (series.numberOfEpisodes ?? 0) === 0) {
    return { passes: false, reason: "conteudo experimental (nenhum episodio retornado)" };
  }

  return PASS;
}
