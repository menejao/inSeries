import { NextResponse } from "next/server";
import { searchSeries, type SeriesSortOption } from "@/lib/discovery/search";
import { withApiObservability } from "@/lib/http/api-handler";

const SORT_OPTIONS: SeriesSortOption[] = ["popular", "latest", "title", "rating", "quality", "discovery", "seasons", "episodes", "onair"];

/** Fase 8 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — pagina seguinte de resultados, consumida pelo "Carregar mais" client-side (components/catalog/catalog-grid.tsx). Mesma query do server-rendered /series, so em JSON. */
async function browseHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get("sort");
  const sort: SeriesSortOption = SORT_OPTIONS.includes(sortParam as SeriesSortOption) ? (sortParam as SeriesSortOption) : "popular";
  const yearParam = searchParams.get("year");

  const result = await searchSeries({
    q: searchParams.get("q") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    year: yearParam ? Number(yearParam) : undefined,
    tag: searchParams.get("tag") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    language: searchParams.get("language") ?? undefined,
    sort,
    page: Number(searchParams.get("page") ?? "1")
  });

  return NextResponse.json({ data: result });
}

export const GET = withApiObservability("catalog.browse", browseHandler);
