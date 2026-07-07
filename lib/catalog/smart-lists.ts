import type { Prisma } from "@prisma/client";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db/prisma";
import { toSeriesSummary } from "@/lib/discovery/search";
import type { Series } from "@/lib/types";

/**
 * Fase 10 (INSERIES-TMDB-CATALOG-QUALITY-01), wired into the UI by
 * INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01 — named lists derived entirely from metadata
 * already on `Series` (popularity/nota/status/collectionTags/counts) — no duplicated
 * filtering rules, no new tables, no manual per-series curation.
 *
 * Fase 12 — `fetchSmartList` never includes seasons/episodes: every consumer of these
 * lists so far (Landing carousels, poster cards) only needs poster-card-level fields, so
 * pulling the full season/episode tree for every series in every list would be a pure
 * cost with no UI benefit. Reuses the same "card-only" mapper as catalog search
 * (`toSeriesSummary`) instead of duplicating it.
 */
const DEFAULT_LIMIT = 20;
const MIN_VOTES_FOR_RATED = 20;

export type SmartListKey =
  | "MAIS_POPULARES"
  | "MAIS_BEM_AVALIADAS"
  | "NOVIDADES"
  | "MINISSERIES"
  | "MARATONAS"
  | "EM_EXIBICAO"
  | "FINALIZADAS"
  | "LONGA_DURACAO"
  | "CURTAS"
  | "EM_ALTA"
  | "MAIS_COMENTADAS"
  | "BASEADAS_EM_LIVROS"
  | "PREMIADAS";

type SmartListDefinition = {
  where?: Prisma.SeriesWhereInput;
  orderBy: Prisma.SeriesOrderByWithRelationInput | Prisma.SeriesOrderByWithRelationInput[];
};

const SMART_LISTS: Record<SmartListKey, SmartListDefinition> = {
  MAIS_POPULARES: { orderBy: { popularityScore: "desc" } },
  MAIS_BEM_AVALIADAS: { where: { voteCount: { gte: MIN_VOTES_FOR_RATED } }, orderBy: { voteAverage: "desc" } },
  NOVIDADES: { orderBy: [{ firstAirYear: "desc" }, { createdAt: "desc" }] },
  MINISSERIES: { where: { collectionTags: { has: "Minissérie" } }, orderBy: { qualityScore: "desc" } },
  MARATONAS: { where: { collectionTags: { has: "Maratona" } }, orderBy: { numberOfEpisodes: "desc" } },
  EM_EXIBICAO: { where: { status: { in: ["RETURNING", "IN_PRODUCTION", "PILOT"] } }, orderBy: { popularityScore: "desc" } },
  FINALIZADAS: { where: { status: { in: ["ENDED", "CANCELED"] } }, orderBy: { qualityScore: "desc" } },
  LONGA_DURACAO: { where: { collectionTags: { has: "Longa Duração" } }, orderBy: { numberOfSeasons: "desc" } },
  CURTAS: {
    where: { numberOfEpisodes: { gt: 0, lte: config.catalogQuality.tags.minisserieMaxEpisodes } },
    orderBy: { qualityScore: "desc" }
  },
  EM_ALTA: { where: { collectionTags: { has: "Em Alta" } }, orderBy: { popularityScore: "desc" } },
  MAIS_COMENTADAS: { orderBy: { voteCount: "desc" } },
  BASEADAS_EM_LIVROS: { where: { collectionTags: { has: "Baseada em Livro" } }, orderBy: { qualityScore: "desc" } },
  PREMIADAS: { where: { collectionTags: { has: "Premiada" } }, orderBy: { voteAverage: "desc" } }
};

async function fetchSmartList(key: SmartListKey, limit: number): Promise<Series[]> {
  const { where, orderBy } = SMART_LISTS[key];
  const rows = await prisma.series.findMany({ where, orderBy, take: limit });
  return rows.map(toSeriesSummary);
}

export const listMaisPopulares = (limit = DEFAULT_LIMIT) => fetchSmartList("MAIS_POPULARES", limit);
export const listMaisBemAvaliadas = (limit = DEFAULT_LIMIT) => fetchSmartList("MAIS_BEM_AVALIADAS", limit);
export const listNovidades = (limit = DEFAULT_LIMIT) => fetchSmartList("NOVIDADES", limit);
export const listMinisseries = (limit = DEFAULT_LIMIT) => fetchSmartList("MINISSERIES", limit);
export const listMaratonas = (limit = DEFAULT_LIMIT) => fetchSmartList("MARATONAS", limit);
export const listEmExibicao = (limit = DEFAULT_LIMIT) => fetchSmartList("EM_EXIBICAO", limit);
export const listFinalizadas = (limit = DEFAULT_LIMIT) => fetchSmartList("FINALIZADAS", limit);
export const listLongaDuracao = (limit = DEFAULT_LIMIT) => fetchSmartList("LONGA_DURACAO", limit);
export const listCurtas = (limit = DEFAULT_LIMIT) => fetchSmartList("CURTAS", limit);
export const listEmAlta = (limit = DEFAULT_LIMIT) => fetchSmartList("EM_ALTA", limit);
export const listMaisComentadas = (limit = DEFAULT_LIMIT) => fetchSmartList("MAIS_COMENTADAS", limit);
export const listBaseadasEmLivros = (limit = DEFAULT_LIMIT) => fetchSmartList("BASEADAS_EM_LIVROS", limit);
export const listPremiadas = (limit = DEFAULT_LIMIT) => fetchSmartList("PREMIADAS", limit);

/**
 * Fase 9/12 — how many series currently qualify for each smart list, for the sync report
 * and `sync:stats`. Uses `count()` (never fetches full rows+seasons+episodes just to size
 * a list) — one lightweight query per list, same bounded cost regardless of catalog size.
 */
export async function computeSmartListCounts(): Promise<Record<SmartListKey, number>> {
  const keys = Object.keys(SMART_LISTS) as SmartListKey[];
  const counts = await Promise.all(keys.map((key) => prisma.series.count({ where: SMART_LISTS[key].where })));
  return Object.fromEntries(keys.map((key, index) => [key, counts[index]])) as Record<SmartListKey, number>;
}
