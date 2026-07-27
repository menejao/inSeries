"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { ChevronDownIcon } from "@/components/ui/icons";
import Link from "next/link";
import { MyListItemCard } from "@/components/my-list/my-list-item-card";
import { PosterImage } from "@/components/media/poster-image";
import { PosterBadge } from "@/components/media/poster-badge";
import { formatRelativeDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MyListGroupKey, MyListItem } from "@/lib/my-list/types";

/**
 * Fase 2 (INSERIES-MY-LISTS-PREMIUM-01) — cada grupo e independente: contador, ultima
 * atividade (o `lastActivityAt`/`addedAt` mais recente do proprio grupo), expandir/recolher.
 * `FixedGrid` garante a regra global (nunca grid quebrado).
 *
 * Fase 16 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "quando listas estiverem vazias...
 * preferencialmente ocultar completamente a secao": grupo vazio nao renderiza nada (nao
 * renderiza mais um Empty State por grupo vazio).
 *
 * Fase 14 — "Concluidas": grid limpo focado no poster, sem cards grandes, posteres sem
 * distorcao. Reusa `SeriesPosterCard` (ja usado em Landing/Series semelhantes, `variant=
 * "collection"` mostra "Colecao completa") em vez de `MyListItemCard` - unico grupo que usa
 * essa composicao, os demais continuam com o card completo de organizacao.
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

  if (!items.length) return null;

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
        groupKey === "COMPLETED" ? (
          <FixedGrid mobile={2} tablet={4} desktop={5} wide={6}>
            {items.map((item) => (
              <Link key={item.series.id} href={`/series/${item.series.slug}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-3xl border border-border shadow-card transition duration-300 ease-out group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-raised">
                  <PosterImage
                    src={item.series.posterUrl}
                    alt={item.series.title}
                    sizes="(min-width: 1024px) 190px, (min-width: 640px) 33vw, 40vw"
                    imageClassName="transition duration-500 ease-out group-hover:scale-110"
                  />
                  <PosterBadge variant="secondary" className="absolute left-2 top-2">
                    Colecao completa
                  </PosterBadge>
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{item.series.title}</p>
              </Link>
            ))}
          </FixedGrid>
        ) : (
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
        )
      ) : null}
    </section>
  );
}
