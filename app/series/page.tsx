import { Filters } from "@/components/series/filters";
import { SeriesCard } from "@/components/series/series-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listCatalogSeries } from "@/lib/catalog/repository";

export default async function SeriesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const series = await listCatalogSeries(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Catalogo de series</h1>
        <p className="section-copy">Catalogo real usa banco quando disponivel e cai para mock apenas como fallback de desenvolvimento.</p>
      </div>
      <Filters query={q} />
      {series.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {series.map((item) => (
            <SeriesCard key={item.id} series={item} />
          ))}
        </div>
      ) : (
        <EmptyState title="Catalogo vazio" copy="Rode seed de catalogo ou ajuste busca para encontrar series importadas." cta="Rodar seed" />
      )}
    </div>
  );
}
