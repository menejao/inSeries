import type { ReactNode } from "react";
import { ExpandableList } from "@/components/ui/expandable-list";

/**
 * Fase 10 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — `initialVisible` evita listas
 * verticais longas sem truncar dado: o resto so fica atras de um "Mostrar mais"
 * (`ExpandableList`), nunca cortado de verdade.
 *
 * Fase 17 (INSERIES-CALENDAR-EXPERIENCE-01) — "se uma secao nao possuir dados: ocultar a
 * secao... evitar grandes areas vazias": uma secao vazia nao renderiza mais nenhum Empty
 * State proprio, simplesmente nao aparece (`emptyTitle`/`emptyCopy` viraram opcionais, so
 * usados pelo Empty State de pagina inteira em `PersonalCalendar`, nao aqui).
 */
export function CalendarSection<T>({
  title,
  items,
  renderItem,
  layout = "list",
  initialVisible,
  itemLabel = "episodio"
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  layout?: "list" | "grid";
  initialVisible?: number;
  itemLabel?: string;
}) {
  if (!items.length) return null;

  const rendered = items.map((item, index) => renderItem(item, index));
  const listClassName = layout === "grid" ? "grid gap-3 md:grid-cols-2" : "space-y-3";

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {initialVisible && items.length > initialVisible ? (
        <ExpandableList initialVisible={initialVisible} itemLabel={itemLabel} listClassName={listClassName}>
          {rendered}
        </ExpandableList>
      ) : (
        <div className={listClassName}>{rendered}</div>
      )}
    </section>
  );
}
