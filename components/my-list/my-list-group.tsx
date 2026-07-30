"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { ChevronDownIcon } from "@/components/ui/icons";
import { MyListItemCard } from "@/components/my-list/my-list-item-card";
import { MyListPosterCard } from "@/components/my-list/my-list-poster-card";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { MyListGroupKey, MyListItem } from "@/lib/my-list/types";
import type { WatchNextItem } from "@/lib/watch-next/types";

const PREVIEW_LIMIT = 6;
/** Grupos "poster-only" — mesma composicao visual (INSERIES-MY-LIST-REDESIGN-01: "Concluidas... servira como referencia visual para as demais" / "Quero assistir: priorizar apenas o poster"). */
const POSTER_ONLY_GROUPS: MyListGroupKey[] = ["COMPLETED", "WANT_TO_WATCH"];

function sessionStorageKey(groupKey: MyListGroupKey) {
  return `inseries-mylist-collapsed-${groupKey.toLowerCase()}`;
}

/**
 * INSERIES-MY-LIST-REDESIGN-01 — cada secao: colapsavel (estado persistido em
 * `sessionStorage`, "durante a sessao do usuario", mesma convencao de try/catch silencioso do
 * collapse da Sidebar mas com sessionStorage em vez de localStorage), grupo vazio some por
 * completo, e mostra so `PREVIEW_LIMIT` itens ate o usuario clicar "Ver mais" — nunca a
 * biblioteca inteira de uma vez ("evitar paginas extremamente longas").
 */
export function MyListGroup({
  groupKey,
  label,
  items,
  selectedIds,
  onToggleSelect,
  watchNextBySeriesId
}: {
  groupKey: MyListGroupKey;
  label: string;
  items: MyListItem[];
  selectedIds: Set<string>;
  onToggleSelect: (seriesId: string) => void;
  watchNextBySeriesId: Map<string, WatchNextItem>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionStorageKey(groupKey));
      if (stored === "1") setExpanded(false);
    } catch {
      // sessionStorage indisponivel (modo privado) — mantem expandido por padrao.
    }
  }, [groupKey]);

  function toggleExpanded() {
    setExpanded((value) => {
      const next = !value;
      try {
        sessionStorage.setItem(sessionStorageKey(groupKey), next ? "0" : "1");
      } catch {
        // Ignora — o estado so nao persiste entre paginas nesta sessao.
      }
      return next;
    });
  }

  if (!items.length) return null;

  const lastActivity = items.reduce<Date | null>((latest, item) => {
    const candidate = item.lastActivityAt ?? item.addedAt;
    if (!latest || candidate > latest) return candidate;
    return latest;
  }, null);

  const visibleItems = showAll ? items : items.slice(0, PREVIEW_LIMIT);
  const posterOnly = POSTER_ONLY_GROUPS.includes(groupKey);

  return (
    <section id={`grupo-${groupKey.toLowerCase()}`} className="scroll-mt-24 space-y-3">
      <button type="button" onClick={toggleExpanded} aria-expanded={expanded} className="flex w-full items-center justify-between gap-4 text-left">
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
        <>
          {posterOnly ? (
            <FixedGrid mobile={2} tablet={4} desktop={5} wide={6}>
              {visibleItems.map((item) => (
                <MyListPosterCard key={item.series.id} item={item} badge={groupKey === "COMPLETED" ? "Colecao completa" : undefined} />
              ))}
            </FixedGrid>
          ) : (
            <FixedGrid mobile={1} tablet={2} desktop={3}>
              {visibleItems.map((item) => (
                <MyListItemCard
                  key={item.series.id}
                  item={item}
                  selected={selectedIds.has(item.series.id)}
                  onToggleSelect={() => onToggleSelect(item.series.id)}
                  nextEpisode={groupKey === "WATCHING" ? watchNextBySeriesId.get(item.series.id) : undefined}
                />
              ))}
            </FixedGrid>
          )}

          {!showAll && items.length > PREVIEW_LIMIT ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
                Ver mais ({items.length - PREVIEW_LIMIT})
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
