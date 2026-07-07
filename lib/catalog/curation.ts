import { config } from "@/lib/config";
import { mapStatusToPrisma, type NormalizedCatalogSeries, type TmdbListSeriesItem } from "@/lib/catalog/normalize";

/**
 * Fase 3 (INSERIES-TMDB-CATALOG-QUALITY-01) — automatic curation, entirely config-driven
 * (`config.catalogQuality.curation`), never a hardcoded per-series rule. Two checkpoints:
 *
 * 1. List-item level (`passesListItemCuration`) — runs before any full TMDb fetch, on the
 *    cheap fields a discovery-list item already has (vote_count/vote_average/year). This
 *    is what decides whether a genuinely new candidate is even worth the full detail+
 *    season+episode fetch (Fase 11 — never spend calls curating something that'll be
 *    discarded anyway).
 * 2. Detail level (`passesDetailCuration`) — runs after the full fetch, on the complete
 *    normalized series, right before it would be upserted for the first time. Catches
 *    what a list item can't show: missing images/overview, an abandoned pilot, or a
 *    "new" series that came back with zero episodes.
 *
 * Both only gate **new** series being imported for the first time — an already-catalogued
 * series is never deleted or rejected by curation (that would be a destructive retroactive
 * purge, out of scope: the ticket asks to "descartar automaticamente" during sync intake,
 * not to prune the existing catalog).
 */
/** Thrown by the repository when a genuinely new series fails detail-level curation — a distinct type so callers can count it as "curated out", not a generic sync error. */
export class CurationRejectedError extends Error {}

export type CurationVerdict = { passes: boolean; reason?: string };

const PASS: CurationVerdict = { passes: true };

export function passesListItemCuration(item: TmdbListSeriesItem): CurationVerdict {
  const { curation } = config.catalogQuality;
  if (!curation.enabled) return PASS;

  if (curation.minVoteAverage > 0 && (item.vote_average ?? 0) < curation.minVoteAverage) {
    return { passes: false, reason: `nota ${item.vote_average ?? 0} abaixo do minimo (${curation.minVoteAverage})` };
  }

  return PASS;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function passesDetailCuration(series: NormalizedCatalogSeries, now: Date = new Date()): CurationVerdict {
  const { curation } = config.catalogQuality;
  if (!curation.enabled) return PASS;

  if (curation.requireImage && !series.posterUrl && !series.backdropUrl) {
    return { passes: false, reason: "sem poster e sem backdrop" };
  }

  if (curation.requireOverview && !series.overview?.trim()) {
    return { passes: false, reason: "sem overview" };
  }

  if (mapStatusToPrisma(series.status) === "PILOT" && series.year) {
    const firstAirDate = new Date(series.year, 0, 1);
    const ageDays = (now.getTime() - firstAirDate.getTime()) / DAY_MS;
    if (ageDays > curation.maxPilotAgeDays) {
      return { passes: false, reason: `piloto abandonado (${Math.round(ageDays)} dias sem avancar de PILOT)` };
    }
  }

  const hasNoEpisodes = series.seasons.length === 0 || series.seasons.every((season) => season.episodes.length === 0);
  if (hasNoEpisodes && (series.numberOfEpisodes ?? 0) === 0) {
    return { passes: false, reason: "conteudo vazio (nenhum episodio retornado)" };
  }

  return PASS;
}
