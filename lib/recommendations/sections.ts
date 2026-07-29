import { prisma } from "@/lib/db/prisma";
import { toSeriesSummary } from "@/lib/discovery/search";
import { getRecommendationsForUser, getDiscoveryRecommendations } from "@/lib/recommendations/service";
import {
  countSmartList,
  listEmAlta,
  listEmExibicao,
  listLancamentos,
  listMaisPopulares,
  listPremiadas
} from "@/lib/catalog/smart-lists";
import type { CandidateSeries } from "@/lib/recommendations/types";
import type { Series } from "@/lib/types";

/**
 * INSERIES-RECOMMENDATIONS-REDESIGN-01 — the 7 fixed categories, in this exact order. No
 * "dezenas de categorias": this list IS the whole scope, on purpose.
 */
export type RecommendationCategory = "for-you" | "because-you-watched" | "trending" | "new" | "upcoming" | "popular" | "awards";

export const CATEGORY_META: Record<RecommendationCategory, { title: string; description: string }> = {
  "for-you": {
    title: "Recomendadas para voce",
    description: "Baseado no que voce assistiu, concluiu, avaliou e favoritou."
  },
  "because-you-watched": { title: "Porque voce assistiu", description: "" },
  trending: { title: "Em alta", description: "Series crescendo em popularidade na plataforma." },
  new: { title: "Lancamentos", description: "Series lancadas recentemente." },
  upcoming: { title: "Mais aguardadas", description: "Series e temporadas com maior expectativa." },
  popular: { title: "Populares", description: "As series com maior popularidade geral." },
  awards: { title: "Premiadas", description: "Series vencedoras ou indicadas aos principais premios." }
};

const ITEMS_PER_SECTION = 12;
const OVERFETCH = 36;

export type RecommendationSection = {
  category: RecommendationCategory | "discovery";
  title: string;
  description: string;
  /** Undefined for "Talvez voce goste" — a deliberately separate section with no dedicated "Ver mais" page (INSERIES-RECOMMENDATION-ENGINE-02). */
  href?: string;
  items: Series[];
};

function candidateToSeries(candidate: CandidateSeries): Series {
  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
    originalTitle: candidate.title,
    year: candidate.firstAirYear ?? 0,
    status: candidate.status.replaceAll("_", " "),
    overview: "",
    genres: candidate.genres,
    language: candidate.language ?? "",
    platform: "",
    popularity: candidate.popularityScore ? candidate.popularityScore.toFixed(0) : "0",
    posterUrl: candidate.posterUrl ?? "",
    backdropUrl: candidate.backdropUrl ?? "",
    voteAverage: candidate.voteAverage,
    qualityScore: candidate.qualityScore,
    discoveryScore: candidate.discoveryScore,
    collectionTags: candidate.collectionTags,
    watchProviders: candidate.watchProviders,
    keywords: candidate.keywords,
    logoUrl: candidate.logoUrl,
    originCountry: candidate.originCountry,
    spokenLanguages: [],
    createdBy: candidate.createdBy,
    networks: candidate.networks,
    productionCompanies: [],
    productionCountries: [],
    numberOfSeasons: null,
    numberOfEpisodes: null,
    seasons: []
  };
}

/** True when the user has enough signal for personalized sections ("for you"/"porque voce assistiu"). */
async function hasWatchHistory(userId: string): Promise<boolean> {
  const count = await prisma.userSeriesStatus.count({ where: { userId, state: { in: ["COMPLETED", "WATCHING"] } } });
  return count > 0;
}

/** Most recently completed series (fallback: most recent 4-5 star review) — the seed for "Porque voce assistiu X". */
async function findWatchedReference(userId: string) {
  const completed = await prisma.userSeriesStatus.findFirst({
    where: { userId, state: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { series: true }
  });
  if (completed) return completed.series;

  const reviewed = await prisma.review.findFirst({
    where: { userId, rating: { gte: 4 } },
    orderBy: { createdAt: "desc" },
    select: { series: true }
  });
  return reviewed?.series ?? null;
}

/**
 * Diversity rule (INSERIES-RECOMMENDATIONS-REDESIGN-01): a series already shown in an earlier
 * section of this page is skipped in favor of the next eligible one — `used` is mutated across
 * every call so sections built later see everything built before them.
 */
function pickUnique(items: Series[], used: Set<string>, limit: number): Series[] {
  const picked: Series[] = [];
  for (const item of items) {
    if (used.has(item.id)) continue;
    used.add(item.id);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Builds every home-page section for a user, applying the ordering, diversity (no repeated
 * series across sections) and "sem historico" rules from the ticket. Each underlying query is
 * independent and cheap (local Postgres only, no live TMDb calls) — run sequentially so the
 * diversity rule can see what earlier sections already used.
 */
export async function getRecommendationHomeSections(userId: string): Promise<RecommendationSection[]> {
  const used = new Set<string>();
  const withHistory = await hasWatchHistory(userId);
  const sections: RecommendationSection[] = [];

  async function addSmartList(category: RecommendationCategory, fetcher: (limit: number) => Promise<Series[]>) {
    const items = pickUnique(await fetcher(OVERFETCH), used, ITEMS_PER_SECTION);
    if (!items.length) return;
    sections.push({ category, title: CATEGORY_META[category].title, description: CATEGORY_META[category].description, href: `/recommendations/${category}`, items });
  }

  async function addForYou() {
    const result = await getRecommendationsForUser(userId, { limit: OVERFETCH, excludeWatchlisted: true, excludeWatching: true });
    if (!result.enabled) return;
    const items = pickUnique(result.items.map((entry) => candidateToSeries(entry.series)), used, ITEMS_PER_SECTION);
    if (!items.length) return;
    sections.push({
      category: "for-you",
      title: CATEGORY_META["for-you"].title,
      description: CATEGORY_META["for-you"].description,
      href: "/recommendations/for-you",
      items
    });
  }

  async function addBecauseYouWatched() {
    const reference = await findWatchedReference(userId);
    if (!reference || !reference.genres.length) return;

    const alreadyTracked = new Set(
      (await prisma.userSeriesStatus.findMany({ where: { userId }, select: { seriesId: true } })).map((row) => row.seriesId)
    );

    const rows = await prisma.series.findMany({
      where: { id: { notIn: [reference.id, ...alreadyTracked] }, genres: { hasSome: reference.genres } },
      orderBy: { voteAverage: "desc" },
      take: OVERFETCH
    });
    const items = pickUnique(rows.map(toSeriesSummary), used, ITEMS_PER_SECTION);
    if (!items.length) return;
    sections.push({
      category: "because-you-watched",
      title: `Porque voce assistiu ${reference.title}`,
      description: "",
      href: `/recommendations/because-you-watched`,
      items
    });
  }

  async function addDiscovery() {
    // INSERIES-RECOMMENDATION-ENGINE-02 — "Talvez voce goste": deliberately NOT mixed into
    // "Recomendadas para voce" (that section's own diversity mix already reserves a small
    // tail for variety) — this is the stronger, dedicated "fora da zona de conforto" shelf.
    const result = await getDiscoveryRecommendations(userId, OVERFETCH);
    if (!result.enabled) return;
    const items = pickUnique(result.items.map((entry) => candidateToSeries(entry.series)), used, ITEMS_PER_SECTION);
    if (!items.length) return;
    sections.push({ category: "discovery", title: "Talvez voce goste", description: "Um pouco fora do que voce costuma assistir.", items });
  }

  if (withHistory) {
    await addForYou();
    await addBecauseYouWatched();
    await addSmartList("trending", listEmAlta);
    await addSmartList("new", listLancamentos);
    await addSmartList("upcoming", listEmExibicao);
    await addSmartList("popular", listMaisPopulares);
    await addSmartList("awards", listPremiadas);
    await addDiscovery();
  } else {
    await addSmartList("trending", listEmAlta);
    await addSmartList("popular", listMaisPopulares);
    await addSmartList("new", listLancamentos);
    await addSmartList("upcoming", listEmExibicao);
    await addSmartList("awards", listPremiadas);
  }

  return sections;
}

export type CategoryPageResult = {
  title: string;
  description: string;
  items: Series[];
  page: number;
  totalPages: number;
};

const CATEGORY_PAGE_SIZE = 24;

/** Data for a "Ver mais" dedicated category page — real offset pagination, no diversity/dedup rule (that rule only applies to the home page's mixed sections). */
export async function getRecommendationCategoryPage(
  userId: string,
  category: RecommendationCategory,
  page: number
): Promise<CategoryPageResult | null> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const skip = (safePage - 1) * CATEGORY_PAGE_SIZE;
  const meta = CATEGORY_META[category];

  if (category === "for-you") {
    const result = await getRecommendationsForUser(userId, { limit: safePage * CATEGORY_PAGE_SIZE, excludeWatchlisted: true, excludeWatching: true });
    if (!result.enabled) return null;
    const items = result.items.slice(skip, skip + CATEGORY_PAGE_SIZE).map((entry) => candidateToSeries(entry.series));
    const totalPages = Math.max(1, Math.ceil(result.items.length / CATEGORY_PAGE_SIZE));
    return { title: meta.title, description: meta.description, items, page: safePage, totalPages };
  }

  if (category === "because-you-watched") {
    const reference = await findWatchedReference(userId);
    if (!reference || !reference.genres.length) return null;
    const alreadyTracked = new Set(
      (await prisma.userSeriesStatus.findMany({ where: { userId }, select: { seriesId: true } })).map((row) => row.seriesId)
    );
    const where = { id: { notIn: [reference.id, ...alreadyTracked] }, genres: { hasSome: reference.genres } };
    const [rows, total] = await Promise.all([
      prisma.series.findMany({ where, orderBy: { voteAverage: "desc" }, take: CATEGORY_PAGE_SIZE, skip }),
      prisma.series.count({ where })
    ]);
    return {
      title: `Porque voce assistiu ${reference.title}`,
      description: "",
      items: rows.map(toSeriesSummary),
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE))
    };
  }

  const SMART_LIST_BY_CATEGORY = {
    trending: { list: listEmAlta, key: "EM_ALTA" as const },
    new: { list: listLancamentos, key: "LANCAMENTOS" as const },
    upcoming: { list: listEmExibicao, key: "EM_EXIBICAO" as const },
    popular: { list: listMaisPopulares, key: "MAIS_POPULARES" as const },
    awards: { list: listPremiadas, key: "PREMIADAS" as const }
  };
  const config = SMART_LIST_BY_CATEGORY[category];
  const [items, total] = await Promise.all([config.list(CATEGORY_PAGE_SIZE, skip), countSmartList(config.key)]);
  return { title: meta.title, description: meta.description, items, page: safePage, totalPages: Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE)) };
}
