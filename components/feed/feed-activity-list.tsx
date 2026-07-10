"use client";

import { useMemo, useState } from "react";
import { ActivityCard } from "@/components/feed/activity-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { FilmIcon } from "@/components/ui/icons";
import type { ActivityFeedItem } from "@/lib/social/activity";
import {
  FEED_FILTER_OPTIONS,
  FEED_SORT_OPTIONS,
  filterFeed,
  sortFeed,
  type FeedFilterOption,
  type FeedSortOption
} from "@/lib/social/feed-sort-filter";

const PAGE_SIZE = 15;

/**
 * Fase 4/9 (INSERIES-SOCIAL-FEED-01) — filtro/ordenacao operam em memoria sobre o array ja
 * buscado pela pagina (nenhuma query nova por troca de opcao, mesmo padrao de
 * `ProfileTimeline`/`ReviewsSection`). "Carregar mais" e uma revelacao progressiva do mesmo
 * array ja em memoria (nao scroll infinito com IntersectionObserver e nenhuma nova pagina de
 * API) — ver README para a limitacao documentada.
 */
export function FeedActivityList({ activities, emptyTitle, emptyCopy }: { activities: ActivityFeedItem[]; emptyTitle: string; emptyCopy: string }) {
  const [filter, setFilter] = useState<FeedFilterOption>("ALL");
  const [sort, setSort] = useState<FeedSortOption>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredAndSorted = useMemo(() => sortFeed(filterFeed(activities, filter), sort), [activities, filter, sort]);
  const visible = filteredAndSorted.slice(0, visibleCount);

  if (!activities.length) {
    return <EmptyState icon={<FilmIcon className="h-6 w-6" />} title={emptyTitle} copy={emptyCopy} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as FeedFilterOption);
            setVisibleCount(PAGE_SIZE);
          }}
          aria-label="Filtrar feed"
        >
          {FEED_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value as FeedSortOption)} aria-label="Ordenar feed">
          {FEED_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {visible.length ? (
        <>
          <div className="space-y-3">
            {visible.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
          {visibleCount < filteredAndSorted.length ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState icon={<FilmIcon className="h-6 w-6" />} title="Nada por aqui" copy="Nenhuma atividade encontrada para este filtro." />
      )}
    </div>
  );
}
