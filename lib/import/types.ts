// INSERIES-HISTORY-IMPORT-AND-DATA-PORTABILITY-01 — Fase 5: toda fonte (TV Time, IMDb,
// Letterboxd, JSON do inSeries, CSV generico) e convertida pra esta estrutura intermediaria
// antes de qualquer correspondencia/persistencia. Parsing NUNCA escreve no banco.

export type ImportMediaType = "series" | "episode" | "movie" | "unknown";

export type ImportItem = {
  mediaType: ImportMediaType;
  tmdbId?: string;
  imdbId?: string;
  tvdbId?: string;
  title?: string;
  originalTitle?: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  watched?: boolean;
  watchedAt?: string; // ISO date ou date-only, preservada como veio (Fase 21)
  watchCount?: number;
  rating?: number; // ja normalizada pra escala interna 1-5
  originalRating?: number;
  originalScale?: string;
  status?: "WATCHING" | "COMPLETED" | "WANT_TO_WATCH" | "PAUSED" | "DROPPED";
  favorite?: boolean;
  watchlist?: boolean;
  listName?: string;
  sourceRow?: number;
};

export type ImportManifest = {
  source: string;
  fileName: string;
  items: ImportItem[];
  warnings: string[];
  errors: string[];
};

export type MatchConfidence = "confirmed" | "probable" | "ambiguous" | "not_found";

/** Item de serie apos correspondencia — agrupa os ImportItems daquela serie. */
export type MatchedSeries = {
  key: string; // tmdbId ou titulo+ano, identificador do grupo dentro do manifesto
  title: string;
  year?: number;
  tmdbId?: string; // definido quando a correspondencia foi resolvida
  localSeriesId?: string; // definido quando a serie ja existe no catalogo
  confidence: MatchConfidence;
  candidates?: Array<{ tmdbId: string; title: string; year?: number }>; // pra revisao manual (ambiguous)
  episodes: Array<{ seasonNumber: number; episodeNumber: number; watchedAt?: string }>;
  rating?: number;
  status?: ImportItem["status"];
  favorite?: boolean;
  watchlist?: boolean;
  listNames: string[];
  skipped?: boolean; // usuario optou por ignorar na revisao
};

export type AnalyzedManifest = {
  source: string;
  fileName: string;
  series: MatchedSeries[];
  warnings: string[];
  errors: string[];
  ignoredItems: number; // filmes/tipos nao suportados (Fase 8)
};

export type ConflictPolicy = "keep_existing" | "use_imported" | "use_newest";

export type ImportTotals = {
  seriesCount: number;
  episodeCount: number;
  ratingCount: number;
  listCount: number;
  confirmed: number;
  probable: number;
  ambiguous: number;
  notFound: number;
  ignored: number;
};

export type ImportReport = {
  seriesCreated: number;
  seriesMatched: number;
  episodesMarked: number;
  episodesAlreadyWatched: number;
  ratingsImported: number;
  ratingsSkippedConflict: number;
  statusesApplied: number;
  listsCreated: number;
  listItemsAdded: number;
  skippedSeries: number;
  failures: Array<{ series: string; error: string }>;
  // Fase 33 — ids criados por ESTA importacao, pro "Desfazer" remover so o que ela criou.
  createdProgressIds: string[];
  createdRatingIds: string[];
  createdStatusIds: string[];
  createdListIds: string[];
};

export function emptyReport(): ImportReport {
  return {
    seriesCreated: 0,
    seriesMatched: 0,
    episodesMarked: 0,
    episodesAlreadyWatched: 0,
    ratingsImported: 0,
    ratingsSkippedConflict: 0,
    statusesApplied: 0,
    listsCreated: 0,
    listItemsAdded: 0,
    skippedSeries: 0,
    failures: [],
    createdProgressIds: [],
    createdRatingIds: [],
    createdStatusIds: [],
    createdListIds: []
  };
}

/** Fase 25 — normalizacao de escalas de avaliacao pra escala interna (1-5, inteiro). */
export function normalizeRating(value: number, scale: "5" | "10" | "100"): number {
  const normalized = scale === "5" ? value : scale === "10" ? value / 2 : value / 20;
  return Math.min(5, Math.max(1, Math.round(normalized)));
}
