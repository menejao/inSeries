import type { MyListItem } from "@/lib/my-list/types";

export type MyListSortField =
  | "lastActivity"
  | "updatedAt"
  | "addedAt"
  | "title"
  | "popularity"
  | "qualityScore"
  | "discoveryScore"
  | "voteAverage"
  | "episodeCount"
  | "seasonCount";

export type MyListSortDirection = "asc" | "desc";

export type MyListFilters = {
  query: string;
  genre: string | null;
  year: number | null;
  language: string | null;
  country: string | null;
  provider: string | null;
  tag: string | null;
  keyword: string | null;
  minQualityScore: number | null;
  minDiscoveryScore: number | null;
};

export const EMPTY_MY_LIST_FILTERS: MyListFilters = {
  query: "",
  genre: null,
  year: null,
  language: null,
  country: null,
  provider: null,
  tag: null,
  keyword: null,
  minQualityScore: null,
  minDiscoveryScore: null
};

/**
 * Fase 8 (INSERIES-MY-LISTS-PREMIUM-01) — busca instantanea, so dentro da Minha Lista, sem
 * endpoint novo: filtra o array ja carregado por titulo/keywords/Collection Tags/providers.
 */
function matchesQuery(item: MyListItem, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    item.series.title.toLowerCase().includes(normalized) ||
    item.series.keywords.some((keyword) => keyword.toLowerCase().includes(normalized)) ||
    item.series.collectionTags.some((tag) => tag.toLowerCase().includes(normalized)) ||
    item.series.watchProviders.some((provider) => provider.toLowerCase().includes(normalized))
  );
}

/** Fase 5 — todos os filtros reutilizam campos ja presentes em `MyListSeriesCard`; nenhuma consulta nova. */
export function filterMyListItems(items: MyListItem[], filters: MyListFilters): MyListItem[] {
  return items.filter((item) => {
    if (!matchesQuery(item, filters.query)) return false;
    if (filters.genre && !item.series.genres.includes(filters.genre)) return false;
    if (filters.year && item.series.year !== filters.year) return false;
    if (filters.language && item.series.language !== filters.language) return false;
    if (filters.country && !item.series.originCountry.includes(filters.country)) return false;
    if (filters.provider && !item.series.watchProviders.includes(filters.provider)) return false;
    if (filters.tag && !item.series.collectionTags.includes(filters.tag)) return false;
    if (filters.keyword && !item.series.keywords.includes(filters.keyword)) return false;
    if (filters.minQualityScore && (item.series.qualityScore ?? 0) < filters.minQualityScore) return false;
    if (filters.minDiscoveryScore && (item.series.discoveryScore ?? 0) < filters.minDiscoveryScore) return false;
    return true;
  });
}

function sortValue(item: MyListItem, field: MyListSortField): number | string {
  switch (field) {
    case "lastActivity":
      return (item.lastActivityAt ?? item.addedAt).getTime();
    case "updatedAt":
      return item.updatedAt.getTime();
    case "addedAt":
      return item.addedAt.getTime();
    case "title":
      return item.series.title.toLowerCase();
    case "popularity":
      return item.series.popularityScore ?? 0;
    case "qualityScore":
      return item.series.qualityScore ?? 0;
    case "discoveryScore":
      return item.series.discoveryScore ?? 0;
    case "voteAverage":
      return item.series.voteAverage ?? 0;
    case "episodeCount":
      return item.series.numberOfEpisodes ?? 0;
    case "seasonCount":
      return item.series.numberOfSeasons ?? 0;
  }
}

/** Fase 6 — ordenacao sobre o array ja carregado, nunca uma nova query com ORDER BY. */
export function sortMyListItems(items: MyListItem[], field: MyListSortField, direction: MyListSortDirection): MyListItem[] {
  const sorted = [...items].sort((a, b) => {
    const valueA = sortValue(a, field);
    const valueB = sortValue(b, field);
    if (typeof valueA === "string" || typeof valueB === "string") {
      return String(valueA).localeCompare(String(valueB));
    }
    return valueA - valueB;
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

/** Distinct values present in the user's own list, for populating filter dropdown options — never the whole catalog. */
export function getMyListFilterOptions(items: MyListItem[]) {
  const genres = new Set<string>();
  const years = new Set<number>();
  const languages = new Set<string>();
  const countries = new Set<string>();
  const providers = new Set<string>();
  const tags = new Set<string>();
  const keywords = new Set<string>();

  for (const item of items) {
    item.series.genres.forEach((genre) => genres.add(genre));
    if (item.series.year) years.add(item.series.year);
    if (item.series.language) languages.add(item.series.language);
    item.series.originCountry.forEach((country) => countries.add(country));
    item.series.watchProviders.forEach((provider) => providers.add(provider));
    item.series.collectionTags.forEach((tag) => tags.add(tag));
    item.series.keywords.forEach((keyword) => keywords.add(keyword));
  }

  return {
    genres: [...genres].sort(),
    years: [...years].sort((a, b) => b - a),
    languages: [...languages].sort(),
    countries: [...countries].sort(),
    providers: [...providers].sort(),
    tags: [...tags].sort(),
    keywords: [...keywords].sort()
  };
}
