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
  // INSERIES-RECOMMENDATION-ENGINE-01 — "Populares" sem piso deixava passar series com
  // popularityScore ruidoso (poucos votos, pouco engajamento real) na frente de series
  // genuinamente populares; exige o mesmo piso de votos usado por "Mais bem avaliadas".
  MAIS_POPULARES: { where: { voteCount: { gte: MIN_VOTES_FOR_RATED } }, orderBy: { popularityScore: "desc" } },
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
  // INSERIES-RECOMMENDATION-ENGINE-01 — "combinar alta popularidade, nota elevada e nao
  // utilizar apenas popularidade historica": alem da tag "Em Alta" (que ja aplica esses
  // mesmos pisos no momento do sync, ver collection-tags.ts), repete os pisos de nota/votos
  // diretamente na query — asim series ja sincronizadas ANTES desse piso existir tambem
  // ficam de fora sem precisar esperar um resync do catalogo pra retaggear.
  EM_ALTA: {
    where: {
      collectionTags: { has: "Em Alta" },
      voteAverage: { gte: config.catalogQuality.tags.emAltaMinVoteAverage },
      voteCount: { gte: config.catalogQuality.tags.emAltaMinVoteCount }
    },
    // discoveryScore (crescimento/tendencia real, ver lib/discovery/discovery-score.ts) desempata
    // popularidade — duas series igualmente populares, a que esta "crescendo" aparece primeiro.
    orderBy: [{ popularityScore: "desc" }, { discoveryScore: "desc" }]
  },
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

async function fetchSmartList(key: SmartListKey, limit: number, skip = 0): Promise<Series[]> {
  const { orderBy } = SMART_LISTS[key];
  const where = resolveWhere(SMART_LISTS[key]);
  const rows = await prisma.series.findMany({ where, orderBy, take: limit, skip });
  return rows.map((row) => toSeriesSummary(row));
}

export const listMaisPopulares = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MAIS_POPULARES", limit, skip);
export const listMaisBemAvaliadas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MAIS_BEM_AVALIADAS", limit, skip);
export const listNovidades = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("NOVIDADES", limit, skip);
export const listMinisseries = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MINISSERIES", limit, skip);
export const listMaratonas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MARATONAS", limit, skip);
export const listEmExibicao = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("EM_EXIBICAO", limit, skip);
export const listFinalizadas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("FINALIZADAS", limit, skip);
export const listLongaDuracao = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("LONGA_DURACAO", limit, skip);
export const listCurtas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("CURTAS", limit, skip);
export const listEmAlta = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("EM_ALTA", limit, skip);
export const listMaisComentadas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MAIS_COMENTADAS", limit, skip);
export const listBaseadasEmLivros = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("BASEADAS_EM_LIVROS", limit, skip);
export const listPremiadas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("PREMIADAS", limit, skip);
export const listBombandoAgora = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("BOMBANDO_AGORA", limit, skip);
export const listMaisAssistidas = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("MAIS_ASSISTIDAS", limit, skip);
export const listEmAltaNosStreamings = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("EM_ALTA_NOS_STREAMINGS", limit, skip);
export const listLancamentos = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("LANCAMENTOS", limit, skip);
export const listImperdiveis = (limit = DEFAULT_LIMIT, skip = 0) => fetchSmartList("IMPERDIVEIS", limit, skip);
export const listTop100 = (limit = 100, skip = 0) => fetchSmartList("TOP_100", limit, skip);
export const listTop250 = (limit = 250, skip = 0) => fetchSmartList("TOP_250", limit, skip);

/** Same filter as the smart list, without a take/skip — for "Ver mais" pages to compute totalPages. */
export async function countSmartList(key: SmartListKey): Promise<number> {
  return prisma.series.count({ where: resolveWhere(SMART_LISTS[key]) });
}

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
