import type { Prisma, SeriesLifecycleStatus } from "@prisma/client";
import { canUseDatabase, isMissingTableError } from "@/lib/db/health";
import { prisma } from "@/lib/db/prisma";
import { mockSeries } from "@/lib/catalog/mock-data";
import type { Series } from "@/lib/types";

export type SeriesSortOption = "popular" | "latest" | "title" | "rating";

export type SeriesDiscoveryParams = {
  q?: string;
  genre?: string;
  status?: string;
  year?: number;
  sort?: SeriesSortOption;
  page?: number;
  pageSize?: number;
};

export type SeriesSearchResult = {
  items: Series[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CatalogFilterMetadata = {
  genres: string[];
  years: number[];
  statuses: string[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const VALID_STATUSES: SeriesLifecycleStatus[] = ["RETURNING", "ENDED", "CANCELED", "IN_PRODUCTION", "PILOT"];

function normalizePagination(page?: number, pageSize?: number) {
  return {
    page: Math.max(1, Math.trunc(page ?? 1) || 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))
  };
}

function normalizeStatusFilter(status?: string): SeriesLifecycleStatus | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase().replaceAll(" ", "_") as SeriesLifecycleStatus;
  return VALID_STATUSES.includes(normalized) ? normalized : undefined;
}

function toSeriesSummary(model: {
  id: string;
  slug: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  firstAirYear: number | null;
  language: string | null;
  network: string | null;
  genres: string[];
  status: SeriesLifecycleStatus;
  popularityScore: number | null;
  voteAverage: number | null;
}): Series {
  return {
    id: model.id,
    slug: model.slug,
    title: model.title,
    originalTitle: model.originalTitle ?? model.title,
    year: model.firstAirYear ?? 0,
    status: model.status.replaceAll("_", " "),
    overview: model.overview ?? "Sinopse indisponivel no momento.",
    genres: model.genres,
    language: model.language ?? "PT-BR",
    platform: model.network ?? "Catalogo interno",
    popularity: model.popularityScore ? model.popularityScore.toFixed(0) : "0",
    posterUrl: model.posterUrl ?? "",
    backdropUrl: model.backdropUrl ?? "",
    voteAverage: model.voteAverage,
    seasons: []
  };
}

function buildOrderBy(sort?: SeriesSortOption): Prisma.SeriesOrderByWithRelationInput[] {
  switch (sort) {
    case "title":
      return [{ title: "asc" }];
    case "latest":
      return [{ firstAirYear: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "rating":
      return [{ voteAverage: { sort: "desc", nulls: "last" } }, { popularityScore: "desc" }];
    case "popular":
    default:
      return [{ popularityScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
  }
}

function matchesMock(series: (typeof mockSeries)[number], params: SeriesDiscoveryParams) {
  if (params.q) {
    const normalized = params.q.toLowerCase();
    const matchesText =
      series.title.toLowerCase().includes(normalized) ||
      series.originalTitle.toLowerCase().includes(normalized) ||
      series.genres.some((genre) => genre.toLowerCase().includes(normalized));
    if (!matchesText) return false;
  }

  if (params.genre && !series.genres.some((genre) => genre.toLowerCase() === params.genre?.toLowerCase())) {
    return false;
  }

  if (params.status && series.status.replaceAll(" ", "_").toUpperCase() !== params.status.replaceAll(" ", "_").toUpperCase()) {
    return false;
  }

  if (params.year && series.year !== params.year) {
    return false;
  }

  return true;
}

function fallbackSearch(params: SeriesDiscoveryParams): SeriesSearchResult {
  const { page, pageSize } = normalizePagination(params.page, params.pageSize);
  const filtered = mockSeries.filter((series) => matchesMock(series, params));
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
  };
}

/**
 * Query layer for series discovery. Isolated from the /series page so it can be
 * reused by the catalog, calendar, lists, profile and a future dedicated search
 * engine (see lib/discovery/provider.ts).
 */
export async function searchSeries(params: SeriesDiscoveryParams): Promise<SeriesSearchResult> {
  const { page, pageSize } = normalizePagination(params.page, params.pageSize);

  if (!(await canUseDatabase())) {
    return fallbackSearch({ ...params, page, pageSize });
  }

  const status = normalizeStatusFilter(params.status);
  const where: Prisma.SeriesWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { originalTitle: { contains: params.q, mode: "insensitive" } },
            { overview: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(params.genre ? { genres: { has: params.genre } } : {}),
    ...(status ? { status } : {}),
    ...(params.year ? { firstAirYear: params.year } : {})
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy: buildOrderBy(params.sort),
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.series.count({ where })
    ]);

    return {
      items: rows.map(toSeriesSummary),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return fallbackSearch({ ...params, page, pageSize });
    }
    throw error;
  }
}

/** Filter option metadata sourced from the database, never hardcoded. */
export async function getCatalogFilterMetadata(): Promise<CatalogFilterMetadata> {
  if (!(await canUseDatabase())) {
    return {
      genres: [...new Set(mockSeries.flatMap((series) => series.genres))].sort(),
      years: [...new Set(mockSeries.map((series) => series.year).filter(Boolean))].sort((a, b) => b - a),
      statuses: [...new Set(mockSeries.map((series) => series.status.replaceAll(" ", "_").toUpperCase()))],
      total: mockSeries.length
    };
  }

  try {
    const [genreRows, yearRows, statusRows, total] = await Promise.all([
      prisma.series.findMany({ select: { genres: true } }),
      prisma.series.findMany({ select: { firstAirYear: true }, distinct: ["firstAirYear"] }),
      prisma.series.findMany({ select: { status: true }, distinct: ["status"] }),
      prisma.series.count()
    ]);

    return {
      genres: [...new Set(genreRows.flatMap((row) => row.genres))].sort(),
      years: yearRows
        .map((row) => row.firstAirYear)
        .filter((year): year is number => Boolean(year))
        .sort((a, b) => b - a),
      statuses: statusRows.map((row) => row.status),
      total
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { genres: [], years: [], statuses: [], total: 0 };
    }
    throw error;
  }
}

export type UserSearchResult = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
};

/** Prepared for the future global search UI; respects privacy by only exposing already-public profile fields. */
export async function searchUsers(q: string, limit = 10): Promise<UserSearchResult[]> {
  if (!q || !(await canUseDatabase())) return [];

  try {
    const rows = await prisma.user.findMany({
      where: {
        OR: [{ username: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }]
      },
      select: { id: true, username: true, name: true, avatarUrl: true },
      take: Math.min(limit, MAX_PAGE_SIZE)
    });
    return rows;
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export type ListSearchResult = {
  id: string;
  title: string;
  description: string | null;
  author: { username: string; name: string };
};

/** Prepared for the future global search UI; only public lists are ever returned. */
export async function searchPublicLists(q: string, limit = 10): Promise<ListSearchResult[]> {
  if (!q || !(await canUseDatabase())) return [];

  try {
    const rows = await prisma.list.findMany({
      where: { visibility: "PUBLIC", title: { contains: q, mode: "insensitive" } },
      include: { user: { select: { username: true, name: true } } },
      take: Math.min(limit, MAX_PAGE_SIZE)
    });
    return rows.map((row) => ({ id: row.id, title: row.title, description: row.description, author: row.user }));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export type ReviewSearchResult = {
  id: string;
  body: string;
  rating: number;
  author: { username: string; name: string };
  series: { slug: string; title: string };
};

/** Prepared for the future global search UI; only public reviews are ever returned. */
export async function searchPublicReviews(q: string, limit = 10): Promise<ReviewSearchResult[]> {
  if (!q || !(await canUseDatabase())) return [];

  try {
    const rows = await prisma.review.findMany({
      where: { visibility: "PUBLIC", body: { contains: q, mode: "insensitive" } },
      include: {
        user: { select: { username: true, name: true } },
        series: { select: { slug: true, title: true } }
      },
      take: Math.min(limit, MAX_PAGE_SIZE)
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      rating: row.rating,
      author: row.user,
      series: row.series
    }));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}
