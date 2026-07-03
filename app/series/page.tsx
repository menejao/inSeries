import { Filters } from "@/components/series/filters";
import { Pagination } from "@/components/ui/pagination";
import { SeriesCard } from "@/components/series/series-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CompassIcon } from "@/components/ui/icons";
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
        <p className="eyebrow">Exploracao</p>
        <h1 className="section-title">Catalogo</h1>
        <p className="section-copy">
          {result.total} serie{result.total === 1 ? "" : "s"} encontrada{result.total === 1 ? "" : "s"}
          {params.q ? (
            <>
              {" "}
              para <span className="font-semibold text-ink">&ldquo;{params.q}&rdquo;</span>
            </>
          ) : null}
          .
        </p>
      </div>
      <Filters query={params.q} genre={params.genre} status={params.status} year={params.year} sort={sort} metadata={metadata} />
      {result.items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => (
              <SeriesCard key={item.id} series={item} />
            ))}
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} params={params} basePath="/series" />
        </>
      ) : (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Nenhuma serie encontrada"
          copy="Ajuste os filtros ou tente outro termo de busca."
        />
      )}
    </div>
  );
}
