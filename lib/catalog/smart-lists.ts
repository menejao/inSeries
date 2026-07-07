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

// Fase 6 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — thresholds for the new Discovery-Score-
// powered collections, same "local documented constant, not a magic number" treatment as
// MIN_VOTES_FOR_RATED above (these are judgment calls specific to this sprint's editorial
// framing, not knobs an operator needs to retune — unlike config.discoveryEngine.*, which
// controls the score/blacklist computation itself).
const MIN_DISCOVERY_FOR_ASSISTIDAS = 40;
const MIN_DISCOVERY_FOR_IMPERDIVEIS = 70;
const MIN_QUALITY_FOR_IMPERDIVEIS = 70;
const LANCAMENTOS_WINDOW_YEARS = 1;

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
  | "PREMIADAS"
  | "BOMBANDO_AGORA"
  | "MAIS_ASSISTIDAS"
  | "EM_ALTA_NOS_STREAMINGS"
  | "LANCAMENTOS"
  | "IMPERDIVEIS"
  | "TOP_100"
  | "TOP_250";

type SmartListDefinition = {
  /** A function instead of a plain object when the filter depends on "now" (e.g. LANCAMENTOS' rolling year window) — evaluated fresh on every call, never frozen at module load. */
  where?: Prisma.SeriesWhereInput | (() => Prisma.SeriesWhereInput);
  orderBy: Prisma.SeriesOrderByWithRelationInput | Prisma.SeriesOrderByWithRelationInput[];
};

function resolveWhere(definition: SmartListDefinition): Prisma.SeriesWhereInput | undefined {
  return typeof definition.where === "function" ? definition.where() : definition.where;
}

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
  PREMIADAS: { where: { collectionTags: { has: "Premiada" } }, orderBy: { voteAverage: "desc" } },
  // Fase 6 — Trending Collections, all derived from `discoveryScore` (persisted by
  // lib/discovery/engine.ts), never from Popular directly (Fase 9's own requirement).
  // A series with discoveryScore null was never processed by the Discovery Engine yet
  // (e.g. seeded/imported only by the old pipeline) and is excluded from every list here.
  BOMBANDO_AGORA: { where: { discoveryScore: { not: null } }, orderBy: { discoveryScore: "desc" } },
  MAIS_ASSISTIDAS: {
    where: { discoveryScore: { gte: MIN_DISCOVERY_FOR_ASSISTIDAS } },
    orderBy: [{ popularityScore: "desc" }, { discoveryScore: "desc" }]
  },
  EM_ALTA_NOS_STREAMINGS: {
    where: { discoveryScore: { not: null }, watchProviders: { hasSome: config.discoveryEngine.streamingPriorityList } },
    orderBy: { discoveryScore: "desc" }
  },
  LANCAMENTOS: {
    where: () => ({ discoveryScore: { not: null }, firstAirYear: { gte: new Date().getFullYear() - LANCAMENTOS_WINDOW_YEARS } }),
    orderBy: [{ firstAirYear: "desc" }, { discoveryScore: "desc" }]
  },
  IMPERDIVEIS: {
    where: { discoveryScore: { gte: MIN_DISCOVERY_FOR_IMPERDIVEIS }, qualityScore: { gte: MIN_QUALITY_FOR_IMPERDIVEIS } },
    orderBy: { discoveryScore: "desc" }
  },
  TOP_100: { where: { discoveryScore: { not: null } }, orderBy: { discoveryScore: "desc" } },
  TOP_250: { where: { discoveryScore: { not: null } }, orderBy: { discoveryScore: "desc" } }
};

async function fetchSmartList(key: SmartListKey, limit: number): Promise<Series[]> {
  const { orderBy } = SMART_LISTS[key];
  const where = resolveWhere(SMART_LISTS[key]);
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
export const listBombandoAgora = (limit = DEFAULT_LIMIT) => fetchSmartList("BOMBANDO_AGORA", limit);
export const listMaisAssistidas = (limit = DEFAULT_LIMIT) => fetchSmartList("MAIS_ASSISTIDAS", limit);
export const listEmAltaNosStreamings = (limit = DEFAULT_LIMIT) => fetchSmartList("EM_ALTA_NOS_STREAMINGS", limit);
export const listLancamentos = (limit = DEFAULT_LIMIT) => fetchSmartList("LANCAMENTOS", limit);
export const listImperdiveis = (limit = DEFAULT_LIMIT) => fetchSmartList("IMPERDIVEIS", limit);
export const listTop100 = (limit = 100) => fetchSmartList("TOP_100", limit);
export const listTop250 = (limit = 250) => fetchSmartList("TOP_250", limit);

/**
 * Fase 9/12 — how many series currently qualify for each smart list, for the sync report
 * and `sync:stats`. Uses `count()` (never fetches full rows+seasons+episodes just to size
 * a list) — one lightweight query per list, same bounded cost regardless of catalog size.
 */
export async function computeSmartListCounts(): Promise<Record<SmartListKey, number>> {
  const keys = Object.keys(SMART_LISTS) as SmartListKey[];
  const counts = await Promise.all(keys.map((key) => prisma.series.count({ where: resolveWhere(SMART_LISTS[key]) })));
  return Object.fromEntries(keys.map((key, index) => [key, counts[index]])) as Record<SmartListKey, number>;
}
