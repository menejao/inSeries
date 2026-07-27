import { Filters } from "@/components/series/filters";
import { EmptyState } from "@/components/ui/empty-state";
import { CompassIcon } from "@/components/ui/icons";
import { CatalogSearchBar } from "@/components/catalog/catalog-search-bar";
import { CatalogSortSelect } from "@/components/catalog/catalog-sort-select";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { CatalogDiscoverySections } from "@/components/catalog/catalog-discovery-sections";
import { HybridSearchResults } from "@/components/catalog/hybrid-search-results";
import { getCatalogFilterMetadata, searchSeries, type SeriesSortOption } from "@/lib/discovery/search";
import { getCatalogDiscoverySections } from "@/lib/catalog/discovery-sections";

const SORT_OPTIONS: SeriesSortOption[] = ["popular", "latest", "title", "rating", "quality", "discovery", "seasons", "episodes"];

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
 * INSERIES-CATALOG-SERIES-EXPERIENCE-01 — Catalogo como plataforma de descoberta, nao CRUD.
 * Fase 2/3: busca (hibrida: local -> TMDb) e a peca central. Fase 4/5: filtros num Sheet
 * (auto-apply) + ordenacao dedicada, form tradicional removido. Fase 6/7/8/9: grid mais denso,
 * cards com hover rico, "Carregar mais" no lugar de paginacao, secoes editoriais quando nao ha
 * busca/filtro ativo. Ver docs/catalog-series-experience-01.md pro audit completo.
 */
export default async function SeriesPage({ searchParams }: { searchParams: Promise<SeriesPageSearchParams> }) {
  const params = await searchParams;
  const sort: SeriesSortOption = SORT_OPTIONS.includes(params.sort as SeriesSortOption) ? (params.sort as SeriesSortOption) : "popular";
  const year = params.year ? Number(params.year) : undefined;
  const page = params.page ? Number(params.page) : 1;

  const hasActiveFilters = Boolean(
    params.q || params.genre || params.status || params.year || params.tag || params.provider || params.country || params.language
  );

  const [result, metadata, discoverySections] = await Promise.all([
    searchSeries({
      q: params.q,
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
    getCatalogFilterMetadata(),
    hasActiveFilters ? Promise.resolve(null) : getCatalogDiscoverySections()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Descoberta</p>
        <h1 className="section-title">Catalogo</h1>
        <p className="section-copy">O que vale a pena descobrir hoje?</p>
      </div>

      <div className="space-y-3">
        <CatalogSearchBar defaultValue={params.q} />
        <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {discoverySections ? <CatalogDiscoverySections sections={discoverySections} /> : null}

      <div className="space-y-3">
        {discoverySections ? <h2 className="text-lg font-semibold text-ink">Todos os resultados</h2> : null}
        <p className="text-sm text-muted">
          {result.total} serie{result.total === 1 ? "" : "s"} encontrada{result.total === 1 ? "" : "s"}
          {params.q ? (
            <>
              {" "}
              para <span className="font-semibold text-ink">&ldquo;{params.q}&rdquo;</span>
            </>
          ) : null}
          .
        </p>

        {result.items.length ? (
          <CatalogGrid initialItems={result.items} initialPage={result.page} totalPages={result.totalPages} />
        ) : params.q ? (
          <HybridSearchResults query={params.q} />
        ) : (
          <EmptyState icon={<CompassIcon className="h-6 w-6" />} title="Nenhuma serie encontrada" copy="Ajuste os filtros ou tente outro termo de busca." />
        )}
      </div>
    </div>
  );
}
