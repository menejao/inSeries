import { Filters } from "@/components/series/filters";
import { Pagination } from "@/components/series/pagination";
import { SeriesCard } from "@/components/series/series-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCatalogFilterMetadata, searchSeries, type SeriesSortOption } from "@/lib/discovery/search";

const SORT_OPTIONS: SeriesSortOption[] = ["popular", "latest", "title", "rating"];

type SeriesPageSearchParams = {
  q?: string;
  genre?: string;
  status?: string;
  year?: string;
  sort?: string;
  page?: string;
};

export default async function SeriesPage({ searchParams }: { searchParams: Promise<SeriesPageSearchParams> }) {
  const params = await searchParams;
  const sort: SeriesSortOption = SORT_OPTIONS.includes(params.sort as SeriesSortOption)
    ? (params.sort as SeriesSortOption)
    : "popular";
  const year = params.year ? Number(params.year) : undefined;
  const page = params.page ? Number(params.page) : 1;

  const [result, metadata] = await Promise.all([
    searchSeries({ q: params.q, genre: params.genre, status: params.status, year, sort, page }),
    getCatalogFilterMetadata()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Catalogo de series</h1>
        <p className="section-copy">
          {result.total} serie(s) encontrada(s){params.q ? ` para "${params.q}"` : ""}.
        </p>
      </div>
      <Filters query={params.q} genre={params.genre} status={params.status} year={params.year} sort={sort} metadata={metadata} />
      {result.items.length ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <SeriesCard key={item.id} series={item} />
            ))}
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} params={params} />
        </>
      ) : (
        <EmptyState title="Nenhuma serie encontrada" copy="Ajuste os filtros ou tente outro termo de busca." />
      )}
    </div>
  );
}
