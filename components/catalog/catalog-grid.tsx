import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesCard } from "@/components/series/series-card";
import type { Series } from "@/lib/types";

/**
 * Paginacao tradicional (numero de pagina na URL, ver CatalogPagination) substituiu "Carregar
 * mais" — cada pagina e server-rendered do zero, sem estado client acumulando itens.
 */
export function CatalogGrid({ items, showQuickActions = false }: { items: Series[]; showQuickActions?: boolean }) {
  return (
    <FixedGrid mobile={2} tablet={4} desktop={5} wide={6}>
      {items.map((item) => (
        <SeriesCard key={item.id} series={item} showQuickActions={showQuickActions} />
      ))}
    </FixedGrid>
  );
}
