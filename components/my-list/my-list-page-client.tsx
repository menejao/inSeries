"use client";

import { useMemo, useState } from "react";
import { MyListToolbar } from "@/components/my-list/my-list-toolbar";
import { MyListGroup } from "@/components/my-list/my-list-group";
import { MyListBulkBar } from "@/components/my-list/my-list-bulk-bar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EMPTY_MY_LIST_FILTERS,
  filterMyListItems,
  getMyListFilterOptions,
  sortMyListItems,
  type MyListSortDirection,
  type MyListSortField
} from "@/lib/my-list/filter-sort";
import { MY_LIST_GROUP_LABELS, type MyListGroupKey, type MyListItem } from "@/lib/my-list/types";
import type { WatchNextItem } from "@/lib/watch-next/types";

/**
 * Fase 11 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — ordem sugerida pelo ticket:
 * Assistindo, Quero assistir, Concluidas, Favoritas, Pausadas, Abandonadas.
 */
const GROUP_ORDER: MyListGroupKey[] = ["WATCHING", "WANT_TO_WATCH", "COMPLETED", "FAVORITES", "PAUSED", "DROPPED"];

/**
 * INSERIES-MY-LIST-REDESIGN-01 — o orquestrador client da pagina: mantem busca/filtros/
 * ordenacao/selecao em estado local e deriva os 6 grupos por `useMemo`, sempre sobre o array
 * ja carregado pelo servidor (`getMyListFullForUser`, uma unica vez). O filtro "Status" (novo)
 * so restringe QUAIS grupos aparecem — nunca filtra itens dentro de um grupo, ja que cada
 * grupo ja e um recorte por status.
 */
export function MyListPageClient({
  items,
  lists,
  watchNextBySeriesId
}: {
  items: MyListItem[];
  lists: Array<{ id: string; title: string }>;
  watchNextBySeriesId: Record<string, WatchNextItem>;
}) {
  const [filters, setFilters] = useState(EMPTY_MY_LIST_FILTERS);
  const [sortField, setSortField] = useState<MyListSortField>("lastActivity");
  const [sortDirection, setSortDirection] = useState<MyListSortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const watchNextMap = useMemo(() => new Map(Object.entries(watchNextBySeriesId)), [watchNextBySeriesId]);
  const filterOptions = useMemo(() => getMyListFilterOptions(items), [items]);

  const visibleItems = useMemo(
    () => sortMyListItems(filterMyListItems(items, filters), sortField, sortDirection),
    [items, filters, sortField, sortDirection]
  );

  const groups = useMemo(() => {
    const byState = new Map<MyListGroupKey, MyListItem[]>(GROUP_ORDER.map((key) => [key, []]));
    for (const item of visibleItems) {
      if (item.state) byState.get(item.state)?.push(item);
      if (item.isFavorite) byState.get("FAVORITES")?.push(item);
    }
    return byState;
  }, [visibleItems]);

  const visibleGroupKeys = filters.status ? GROUP_ORDER.filter((key) => key === filters.status) : GROUP_ORDER;

  function toggleSelect(seriesId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  }

  if (!items.length) {
    return (
      <EmptyState
        title="Sua Minha Lista esta vazia"
        copy="Adicione series com um status (Assistindo, Quero assistir...) na pagina de qualquer serie para organiza-las aqui."
      />
    );
  }

  const anyGroupVisible = visibleGroupKeys.some((key) => (groups.get(key) ?? []).length > 0);

  return (
    <div className="space-y-8">
      <MyListToolbar
        filters={filters}
        onFiltersChange={setFilters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, direction) => {
          setSortField(field);
          setSortDirection(direction);
        }}
        options={filterOptions}
      />

      {anyGroupVisible ? (
        <div className="space-y-10">
          {visibleGroupKeys.map((key) => (
            <MyListGroup
              key={key}
              groupKey={key}
              label={MY_LIST_GROUP_LABELS[key]}
              items={groups.get(key) ?? []}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              watchNextBySeriesId={watchNextMap}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma serie encontrada" copy="Ajuste a busca ou os filtros para ver suas series." />
      )}

      <MyListBulkBar selectedIds={selectedIds} lists={lists} onClear={() => setSelectedIds(new Set())} />
    </div>
  );
}
