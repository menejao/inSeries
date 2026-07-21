import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableList } from "@/components/ui/expandable-list";

/**
 * Fase 10 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — `initialVisible` evita listas
 * verticais longas (ex.: "Atrasados"/"Assistidos Recentemente" sem limite de itens antes) sem
 * truncar dado: o resto so fica atras de um "Mostrar mais" (`ExpandableList`), nunca cortado
 * de verdade.
 */
export function CalendarSection<T>({
  title,
  items,
  renderItem,
  emptyTitle,
  emptyCopy,
  layout = "list",
  initialVisible,
  itemLabel = "episodio"
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  emptyTitle: string;
  emptyCopy: string;
  layout?: "list" | "grid";
  initialVisible?: number;
  itemLabel?: string;
}) {
  const rendered = items.map((item, index) => renderItem(item, index));
  const listClassName = layout === "grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3";

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {items.length ? (
        initialVisible && items.length > initialVisible ? (
          <ExpandableList initialVisible={initialVisible} itemLabel={itemLabel} listClassName={listClassName}>
            {rendered}
          </ExpandableList>
        ) : (
          <div className={listClassName}>{rendered}</div>
        )
      ) : (
        <EmptyState title={emptyTitle} copy={emptyCopy} />
      )}
    </section>
  );
}
