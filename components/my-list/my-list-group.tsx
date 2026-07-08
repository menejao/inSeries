"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { ChevronDownIcon } from "@/components/ui/icons";
import { MyListItemCard } from "@/components/my-list/my-list-item-card";
import { formatRelativeDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MyListGroupKey, MyListItem } from "@/lib/my-list/types";

const EMPTY_STATE_COPY: Record<MyListGroupKey, string> = {
  WATCHING: "Marque uma serie como \"Assistindo\" para ve-la aqui.",
  WANT_TO_WATCH: "Adicione series que voce quer assistir para organiza-las aqui.",
  PAUSED: "Series pausadas aparecem aqui.",
  COMPLETED: "Series concluidas aparecem aqui.",
  DROPPED: "Series abandonadas aparecem aqui.",
  FAVORITES: "Avalie uma serie com 4 ou 5 estrelas para marca-la como favorita."
};

/**
 * Fase 2 (INSERIES-MY-LISTS-PREMIUM-01) — cada grupo e independente: contador, ultima
 * atividade (o `lastActivityAt`/`addedAt` mais recente do proprio grupo), expandir/recolher
 * e um empty state proprio. `FixedGrid` garante a regra global (nunca grid quebrado).
 */
export function MyListGroup({
  groupKey,
  label,
  items,
  selectedIds,
  onToggleSelect,
  defaultExpanded = true
}: {
  groupKey: MyListGroupKey;
  label: string;
  items: MyListItem[];
  selectedIds: Set<string>;
  onToggleSelect: (seriesId: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const lastActivity = items.reduce<Date | null>((latest, item) => {
    const candidate = item.lastActivityAt ?? item.addedAt;
    if (!latest || candidate > latest) return candidate;
    return latest;
  }, null);

  return (
    <section id={`grupo-${groupKey.toLowerCase()}`} className="scroll-mt-24 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          {label}
          <Badge variant="secondary">{items.length}</Badge>
        </h2>
        <div className="flex items-center gap-3">
          {lastActivity ? <span className="hidden text-xs text-subtle sm:inline">Ultima atividade {formatRelativeDate(lastActivity)}</span> : null}
          <ChevronDownIcon className={cn("h-5 w-5 shrink-0 text-subtle transition duration-200", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded ? (
        items.length ? (
          <FixedGrid mobile={1} tablet={2} desktop={3}>
            {items.map((item) => (
              <MyListItemCard
                key={item.series.id}
                item={item}
                selected={selectedIds.has(item.series.id)}
                onToggleSelect={() => onToggleSelect(item.series.id)}
              />
            ))}
          </FixedGrid>
        ) : (
          <EmptyState title={`Nenhuma serie ${label.toLowerCase()}`} copy={EMPTY_STATE_COPY[groupKey]} />
        )
      ) : null}
    </section>
  );
}
