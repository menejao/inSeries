import Link from "next/link";
import { Filters } from "@/components/series/filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CompassIcon } from "@/components/ui/icons";
import { CatalogSearchBar } from "@/components/catalog/catalog-search-bar";
import { CatalogSortSelect } from "@/components/catalog/catalog-sort-select";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { getCatalogFilterMetadata, searchSeries, type SeriesSortOption } from "@/lib/discovery/search";
import { getUnifiedSearchResults } from "@/lib/catalog/unified-search";

const SORT_OPTIONS: SeriesSortOption[] = ["discovery", "popular", "latest", "title", "rating", "onair"];

type SeriesPageSearchParams = {
  q?: string;
  genre?: string;
  status?: string;
  year?: string;
  tag?: string;
  provider?: string;
  country?: string;
  language?: string;
  keyword?: string;
  sort?: string;
  page?: string;
};

/**
 * Estrutura: Buscar + Filtros + Ordenacao numa linha so -> Grid -> Paginacao. O total exato de
 * series nunca e mostrado ao usuario (busca sempre pode complementar via TMDb, entao um numero
 * "de X series" seria enganoso — ver HybridSearchResults).
 */
export default async function SeriesPage({ searchParams }: { searchParams: Promise<SeriesPageSearchParams> }) {
  const params = await searchParams;
  // Fase 20 (INSERIES-CATALOG-POPULATION-AND-EXPERIENCE-V3) — "Relevancia" (ranking interno
  // combinado, discoveryScore) e o default, nao popularidade bruta.
  const sort: SeriesSortOption = SORT_OPTIONS.includes(params.sort as SeriesSortOption) ? (params.sort as SeriesSortOption) : "discovery";
  const year = params.year ? Number(params.year) : undefined;
  const hasActiveFilters = Boolean(
    params.genre || params.status || params.year || params.tag || params.provider || params.country || params.language
  );
  const page = params.page ? Number(params.page) : 1;
  const q = params.q?.trim();

  // Fase 4 (INSERIES-CATALOG-TRANSPARENT-SEARCH-AND-SILENT-IMPORT-01) — com termo de busca,
  // local + TMDb sao combinados numa lista unica sem paginacao tradicional (ver
  // getUnifiedSearchResults); sem termo, o catalogo continua sendo so o banco local, paginado
  // normalmente (comportamento anterior, intocado).
  const [searchResult, browseResult, metadata] = await Promise.all([
    q
      ? getUnifiedSearchResults({
          q,
          genre: params.genre,
          status: params.status,
          year,
          tag: params.tag,
          provider: params.provider,
          country: params.country,
          language: params.language,
          keyword: params.keyword,
          sort
        })
      : Promise.resolve(null),
    q
      ? Promise.resolve(null)
      : searchSeries({
          genre: params.genre,
          status: params.status,
          year,
          tag: params.tag,
          provider: params.provider,
          country: params.country,
          language: params.language,
          keyword: params.keyword,
          sort,
          page
        }),
    getCatalogFilterMetadata()
  ]);

  const items = q ? (searchResult?.items ?? []) : (browseResult?.items ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Catalogo</h1>
        <p className="section-copy">Explore series populares, recentes e bem avaliadas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <CatalogSearchBar defaultValue={params.q} />
        </div>
        <Filters
          genre={params.genre}
          status={params.status}
          year={params.year}
          tag={params.tag}
          provider={params.provider}
          country={params.country}
          language={params.language}
          metadata={metadata}
        />
        <CatalogSortSelect sort={sort} />
      </div>

      <div className="space-y-6">
        {q ? (
          <p className="text-sm text-muted">
            Resultados para <span className="font-semibold text-ink">&ldquo;{q}&rdquo;</span>
          </p>
        ) : null}

        {items.length ? (
          <>
            <CatalogGrid items={items} />
            {/* Fase: busca hibrida (local + TMDb combinados) nao usa paginacao tradicional — so o catalogo sem termo de busca pagina. */}
            {!q && browseResult ? <CatalogPagination page={browseResult.page} totalPages={browseResult.totalPages} /> : null}
          </>
        ) : q && searchResult?.bothFailed ? (
          // Fase 21 — so aparece quando NENHUMA fonte (local nem TMDb) respondeu.
          <EmptyState
            icon={<CompassIcon className="h-6 w-6" />}
            title="Nao foi possivel realizar a busca agora."
            copy=""
            action={
              <Link href={`/series?q=${encodeURIComponent(q)}`}>
                <Button variant="secondary" size="sm">
                  Tentar novamente
                </Button>
              </Link>
            }
          />
        ) : q ? (
          // Fase 20 — so aparece depois que local e TMDb ja terminaram e nenhum encontrou nada; nunca menciona catalogo local ou TMDb.
          <EmptyState
            icon={<CompassIcon className="h-6 w-6" />}
            title={`Nenhuma serie encontrada para "${q}".`}
            copy="Tente outro titulo."
          />
        ) : hasActiveFilters ? (
          <EmptyState
            icon={<CompassIcon className="h-6 w-6" />}
            title="Nenhuma serie encontrada com esses filtros."
            copy=""
            action={
              <Link href="/series">
                <Button variant="secondary" size="sm">
                  Limpar filtros
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState icon={<CompassIcon className="h-6 w-6" />} title="Nenhuma serie encontrada" copy="Tente outro termo de busca." />
        )}
      </div>
    </div>
  );
}
