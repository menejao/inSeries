import { parseCsv, headerIndex } from "@/lib/import/csv-parse";
import { normalizeRating, type ImportItem, type ImportManifest } from "@/lib/import/types";

/**
 * Fase 4 — arquitetura por adaptadores: cada fonte identifica o proprio formato pelo CONTEUDO
 * (cabecalhos/campos), nunca so pelo nome do arquivo, e produz o mesmo `ImportManifest`
 * normalizado. `detectAndParse` tenta na ordem mais especifica -> mais generica; CSV que
 * nenhum adaptador reconhece cai no generico (mapeamento por aliases de coluna).
 *
 * Limitacao documentada: ZIP nao e aceito diretamente (sem lib de descompactacao no projeto)
 * — as instrucoes de cada fonte orientam extrair e enviar o CSV/JSON interno.
 */

export type AdapterResult = ImportManifest | null;

function parseDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Formatos comuns: ISO, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
  const iso = /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed : undefined;
  if (iso) {
    const date = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00Z` : trimmed);
    if (!Number.isNaN(date.getTime()) && date.getTime() <= Date.now() + 86_400_000) return date.toISOString();
    return undefined;
  }
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, a, b, year] = slash;
    // Ambiguo: assume DD/MM quando o primeiro numero > 12.
    const day = Number(a) > 12 ? Number(a) : Number(b) > 12 ? Number(b) : Number(a);
    const month = Number(a) > 12 ? Number(b) : Number(b) > 12 ? Number(a) : Number(b);
    const date = new Date(Date.UTC(Number(year), month - 1, day));
    if (!Number.isNaN(date.getTime()) && date.getTime() <= Date.now() + 86_400_000) return date.toISOString();
  }
  return undefined;
}

function parseYear(raw: string): number | undefined {
  const match = raw.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

// ---------------------------------------------------------------------------
// TV Time — exportacao GDPR: CSVs como "seen_episode.csv" / "tracking-prod-records*.csv"
// com colunas variando por geracao do export. Reconhecido por combinacoes de cabecalho
// tipicas ("tv_show_name" + "episode_season_number", ou "series_name" + "s_number").
// ---------------------------------------------------------------------------
export function parseTvTime(text: string, fileName: string): AdapterResult {
  let csv;
  try {
    csv = parseCsv(text);
  } catch {
    return null;
  }
  const idx = headerIndex(csv.headers);

  const seriesCol = idx.find("tv_show_name", "series_name", "show_name", "show");
  const seasonCol = idx.find("episode_season_number", "season_number", "s_number", "season");
  const episodeCol = idx.find("episode_number", "e_number", "episode", "number");
  const dateCol = idx.find("created_at", "watched_at", "date_watched", "first_watch_date");

  if (seriesCol === -1 || seasonCol === -1 || episodeCol === -1) return null;

  const items: ImportItem[] = [];
  const warnings: string[] = [];

  csv.rows.forEach((row, rowIndex) => {
    const title = row[seriesCol]?.trim();
    const seasonNumber = Number(row[seasonCol]);
    const episodeNumber = Number(row[episodeCol]);
    if (!title || !Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return;

    items.push({
      mediaType: "episode",
      title,
      seasonNumber,
      episodeNumber,
      watched: true,
      watchedAt: dateCol !== -1 ? parseDate(row[dateCol] ?? "") : undefined,
      sourceRow: rowIndex + 2
    });
  });

  if (!items.length) warnings.push("Nenhum episodio valido encontrado no arquivo do TV Time.");

  return { source: "tvtime", fileName, items, warnings, errors: [] };
}

// ---------------------------------------------------------------------------
// IMDb — ratings.csv (Const,Your Rating,Date Rated,Title,...,Title Type,...,Year) e
// watchlist export (mesma familia de colunas). "Const" = IMDb ID (tt...).
// ---------------------------------------------------------------------------
export function parseImdb(text: string, fileName: string): AdapterResult {
  let csv;
  try {
    csv = parseCsv(text);
  } catch {
    return null;
  }
  const idx = headerIndex(csv.headers);

  const constCol = idx.find("const");
  const titleCol = idx.find("title");
  const typeCol = idx.find("title type", "titletype");
  const yearCol = idx.find("year");
  const ratingCol = idx.find("your rating");
  const dateCol = idx.find("date rated", "created", "date added");

  if (constCol === -1 || titleCol === -1) return null;

  const items: ImportItem[] = [];
  let ignoredMovies = 0;
  const isWatchlist = ratingCol === -1;

  csv.rows.forEach((row, rowIndex) => {
    const imdbId = row[constCol]?.trim();
    const title = row[titleCol]?.trim();
    if (!imdbId || !title) return;

    const type = typeCol !== -1 ? (row[typeCol] ?? "").toLowerCase() : "";
    const isSeries = type.includes("series") || type.includes("mini");
    const isMovie = type.includes("movie") || type === "video" || type === "short";

    if (isMovie) {
      ignoredMovies += 1;
      return;
    }

    const rawRating = ratingCol !== -1 ? Number(row[ratingCol]) : undefined;
    items.push({
      mediaType: isSeries ? "series" : "unknown",
      imdbId,
      title,
      year: yearCol !== -1 ? parseYear(row[yearCol] ?? "") : undefined,
      rating: rawRating && Number.isFinite(rawRating) ? normalizeRating(rawRating, "10") : undefined,
      originalRating: rawRating && Number.isFinite(rawRating) ? rawRating : undefined,
      originalScale: rawRating ? "10" : undefined,
      watchlist: isWatchlist ? true : undefined,
      status: isWatchlist ? "WANT_TO_WATCH" : undefined,
      watchedAt: dateCol !== -1 ? parseDate(row[dateCol] ?? "") : undefined,
      sourceRow: rowIndex + 2
    });
  });

  const warnings: string[] = [];
  if (ignoredMovies > 0) {
    warnings.push(`${ignoredMovies} itens de filme foram ignorados porque o inSeries atualmente importa apenas series.`);
  }

  return { source: "imdb", fileName, items, warnings, errors: [] };
}

// ---------------------------------------------------------------------------
// Letterboxd — watched.csv / ratings.csv (Date,Name,Year,Letterboxd URI[,Rating]).
// Centrado em filmes: tudo e ignorado como filme, exceto quando nao ha como afirmar.
// ---------------------------------------------------------------------------
export function parseLetterboxd(text: string, fileName: string): AdapterResult {
  let csv;
  try {
    csv = parseCsv(text);
  } catch {
    return null;
  }
  const idx = headerIndex(csv.headers);

  const uriCol = idx.find("letterboxd uri");
  const nameCol = idx.find("name");
  if (uriCol === -1 || nameCol === -1) return null;

  const total = csv.rows.length;
  return {
    source: "letterboxd",
    fileName,
    items: [],
    warnings: [
      `${total} itens de filme foram ignorados porque o inSeries atualmente importa apenas series.`
    ],
    errors: []
  };
}

// ---------------------------------------------------------------------------
// JSON oficial do inSeries (Fase 9) — schema_version + blocos de dados.
// ---------------------------------------------------------------------------
export const INSERIES_SCHEMA_VERSION = 1;

type InSeriesBackup = {
  schema_version?: number;
  series?: Array<{ tmdbId?: string; title?: string; year?: number; status?: string; rating?: number }>;
  episodes?: Array<{ tmdbId?: string; seriesTitle?: string; seasonNumber?: number; episodeNumber?: number; watchedAt?: string }>;
  lists?: Array<{ title?: string; items?: Array<{ tmdbId?: string; title?: string }> }>;
};

const VALID_STATUSES = new Set(["WATCHING", "COMPLETED", "WANT_TO_WATCH", "PAUSED", "DROPPED"]);

export function parseInSeriesJson(text: string, fileName: string): AdapterResult {
  let payload: InSeriesBackup;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null || typeof payload.schema_version !== "number") return null;

  if (payload.schema_version > INSERIES_SCHEMA_VERSION) {
    return {
      source: "inseries",
      fileName,
      items: [],
      warnings: [],
      errors: [`Este backup usa a versao ${payload.schema_version} do formato, mais nova do que esta versao do inSeries suporta.`]
    };
  }

  const items: ImportItem[] = [];

  for (const series of payload.series ?? []) {
    if (!series.tmdbId && !series.title) continue;
    const status = series.status && VALID_STATUSES.has(series.status) ? (series.status as ImportItem["status"]) : undefined;
    items.push({
      mediaType: "series",
      tmdbId: series.tmdbId ? String(series.tmdbId) : undefined,
      title: series.title,
      year: series.year,
      status,
      rating: series.rating && series.rating >= 1 && series.rating <= 5 ? Math.round(series.rating) : undefined
    });
  }

  for (const episode of payload.episodes ?? []) {
    if ((!episode.tmdbId && !episode.seriesTitle) || episode.seasonNumber == null || episode.episodeNumber == null) continue;
    items.push({
      mediaType: "episode",
      tmdbId: episode.tmdbId ? String(episode.tmdbId) : undefined,
      title: episode.seriesTitle,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      watched: true,
      watchedAt: episode.watchedAt ? parseDate(episode.watchedAt) : undefined
    });
  }

  for (const list of payload.lists ?? []) {
    if (!list.title) continue;
    for (const item of list.items ?? []) {
      if (!item.tmdbId && !item.title) continue;
      items.push({
        mediaType: "series",
        tmdbId: item.tmdbId ? String(item.tmdbId) : undefined,
        title: item.title,
        listName: list.title
      });
    }
  }

  return { source: "inseries", fileName, items, warnings: [], errors: [] };
}

// ---------------------------------------------------------------------------
// CSV generico (Fase 10) — aliases amplos de coluna; requer no minimo um titulo ou TMDB ID.
// ---------------------------------------------------------------------------
export function parseGenericCsv(text: string, fileName: string): AdapterResult {
  let csv;
  try {
    csv = parseCsv(text);
  } catch {
    return null;
  }
  const idx = headerIndex(csv.headers);

  const titleCol = idx.find("titulo", "título", "title", "name", "serie", "series", "show");
  const tmdbCol = idx.find("tmdb id", "tmdb_id", "tmdbid");
  const imdbCol = idx.find("imdb id", "imdb_id", "imdbid", "const");
  if (titleCol === -1 && tmdbCol === -1) return null;

  const yearCol = idx.find("ano", "year");
  const seasonCol = idx.find("temporada", "season", "season_number", "s");
  const episodeCol = idx.find("episodio", "episódio", "episode", "episode_number", "e");
  const dateCol = idx.find("data assistida", "watched_at", "date", "data");
  const watchedCol = idx.find("assistido", "watched");
  const ratingCol = idx.find("nota", "rating", "avaliacao", "avaliação");
  const statusCol = idx.find("status");
  const listCol = idx.find("lista", "list", "list_name");

  const statusMap: Record<string, ImportItem["status"]> = {
    assistindo: "WATCHING",
    watching: "WATCHING",
    concluida: "COMPLETED",
    concluída: "COMPLETED",
    completed: "COMPLETED",
    "quero assistir": "WANT_TO_WATCH",
    "plan to watch": "WANT_TO_WATCH",
    watchlist: "WANT_TO_WATCH",
    pausada: "PAUSED",
    paused: "PAUSED",
    abandonada: "DROPPED",
    dropped: "DROPPED"
  };

  const items: ImportItem[] = [];
  csv.rows.forEach((row, rowIndex) => {
    const title = titleCol !== -1 ? row[titleCol]?.trim() : undefined;
    const tmdbId = tmdbCol !== -1 ? row[tmdbCol]?.trim() : undefined;
    if (!title && !tmdbId) return;

    const seasonNumber = seasonCol !== -1 && row[seasonCol]?.trim() ? Number(row[seasonCol]) : undefined;
    const episodeNumber = episodeCol !== -1 && row[episodeCol]?.trim() ? Number(row[episodeCol]) : undefined;
    const isEpisode = Number.isFinite(seasonNumber) && Number.isFinite(episodeNumber);

    const rawRating = ratingCol !== -1 && row[ratingCol]?.trim() ? Number(row[ratingCol]) : undefined;
    const rawStatus = statusCol !== -1 ? (row[statusCol] ?? "").trim().toLowerCase() : "";
    const watchedRaw = watchedCol !== -1 ? (row[watchedCol] ?? "").trim().toLowerCase() : "";

    items.push({
      mediaType: isEpisode ? "episode" : "series",
      tmdbId: tmdbId || undefined,
      imdbId: imdbCol !== -1 ? row[imdbCol]?.trim() || undefined : undefined,
      title,
      year: yearCol !== -1 ? parseYear(row[yearCol] ?? "") : undefined,
      seasonNumber: isEpisode ? seasonNumber : undefined,
      episodeNumber: isEpisode ? episodeNumber : undefined,
      watched: isEpisode ? watchedRaw !== "false" && watchedRaw !== "nao" && watchedRaw !== "não" && watchedRaw !== "0" : undefined,
      watchedAt: dateCol !== -1 ? parseDate(row[dateCol] ?? "") : undefined,
      rating:
        rawRating !== undefined && Number.isFinite(rawRating)
          ? normalizeRating(rawRating, rawRating > 10 ? "100" : rawRating > 5 ? "10" : "5")
          : undefined,
      status: statusMap[rawStatus],
      listName: listCol !== -1 ? row[listCol]?.trim() || undefined : undefined,
      sourceRow: rowIndex + 2
    });
  });

  if (!items.length) return null;
  return { source: "csv", fileName, items, warnings: [], errors: [] };
}

// ---------------------------------------------------------------------------
// Deteccao (ordem: mais especifico -> generico).
// ---------------------------------------------------------------------------
export function detectAndParse(text: string, fileName: string, preferredSource?: string): ImportManifest {
  const bySource: Record<string, (t: string, f: string) => AdapterResult> = {
    tvtime: parseTvTime,
    imdb: parseImdb,
    letterboxd: parseLetterboxd,
    inseries: parseInSeriesJson,
    csv: parseGenericCsv
  };

  if (preferredSource && bySource[preferredSource]) {
    const preferred = bySource[preferredSource](text, fileName);
    if (preferred) return preferred;
  }

  for (const parse of [parseInSeriesJson, parseTvTime, parseImdb, parseLetterboxd, parseGenericCsv]) {
    const result = parse(text, fileName);
    if (result) return result;
  }

  return {
    source: preferredSource ?? "unknown",
    fileName,
    items: [],
    warnings: [],
    errors: [
      "Nao foi possivel reconhecer o formato deste arquivo. Verifique se ele e uma exportacao valida da fonte selecionada (CSV ou JSON; se o servico gerou um ZIP, extraia e envie o arquivo interno)."
    ]
  };
}
