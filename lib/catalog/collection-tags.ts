import { config } from "@/lib/config";

/**
 * Fase 7 (INSERIES-TMDB-CATALOG-QUALITY-01) — editorial tags derived purely from metadata
 * already on the normalized series (genres, type, keywords, counts, scores). No manual
 * per-series rule: every tag is a data-driven threshold/pattern, configurable where the
 * threshold is a judgment call (config.catalogQuality.tags), so the same rule applies to
 * every series the pipeline ever sees.
 *
 * "Premiada" has no real awards data available from TMDb's core endpoints — it's a
 * documented proxy (very high vote_average AND vote_count = critically acclaimed at
 * scale), not a claim of actual awards won.
 */
export type CollectionTagInput = {
  genres: string[];
  type?: string | null;
  keywords?: string[] | null;
  originCountry?: string[] | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  status: string;
  popularity?: number | null;
  voteAverage?: number | null;
  voteCount?: number | null;
};

const GENRE_TAGS: Array<{ tag: string; matches: string[] }> = [
  { tag: "Sci-Fi", matches: ["sci-fi", "science fiction", "ficção científica", "ficcao cientifica"] },
  { tag: "Drama", matches: ["drama"] },
  { tag: "Mistério", matches: ["mystery", "mistério", "misterio"] },
  { tag: "Crime", matches: ["crime"] }
];

const BOOK_KEYWORD_MATCHES = ["based on novel", "based on book", "based on comic", "baseado em livro", "baseado em romance"];

function hasGenre(genres: string[], matches: string[]) {
  return genres.some((genre) => matches.some((match) => genre.toLowerCase().includes(match)));
}

function hasKeyword(keywords: string[], matches: string[]) {
  return keywords.some((keyword) => matches.some((match) => keyword.toLowerCase().includes(match)));
}

export function deriveCollectionTags(input: CollectionTagInput): string[] {
  const thresholds = config.catalogQuality.tags;
  const genres = input.genres ?? [];
  const keywords = input.keywords ?? [];
  const seasons = input.numberOfSeasons ?? 0;
  const episodes = input.numberOfEpisodes ?? 0;
  const tags = new Set<string>();

  if (episodes >= thresholds.maratonaMinEpisodes) tags.add("Maratona");

  if (input.type === "Miniseries" || (seasons === 1 && episodes > 0 && episodes <= thresholds.minisserieMaxEpisodes && input.status === "ENDED")) {
    tags.add("Minissérie");
  }

  if (hasKeyword(keywords, BOOK_KEYWORD_MATCHES)) tags.add("Baseada em Livro");

  if ((input.voteAverage ?? 0) >= thresholds.premiadaMinVoteAverage && (input.voteCount ?? 0) >= thresholds.premiadaMinVoteCount) {
    tags.add("Premiada");
  }

  if ((input.popularity ?? 0) >= thresholds.emAltaMinPopularity) tags.add("Em Alta");

  if (seasons >= thresholds.longaDuracaoMinSeasons) tags.add("Longa Duração");

  for (const { tag, matches } of GENRE_TAGS) {
    if (hasGenre(genres, matches)) tags.add(tag);
  }

  const isAnimation = hasGenre(genres, ["animation", "animação", "animacao"]);
  const isJapanese = (input.originCountry ?? []).includes("JP");
  if (isAnimation && isJapanese) tags.add("Anime");

  return Array.from(tags);
}
