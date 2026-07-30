"use client";

import { useMemo, useState } from "react";
import { ActivityCard } from "@/components/feed/activity-card";
import { EpisodeGroupCard } from "@/components/feed/episode-group-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilmIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";
import { groupConsecutiveEpisodes } from "@/lib/social/feed-grouping";
import { FEED_FILTER_OPTIONS, filterFeed, type FeedFilterOption } from "@/lib/social/feed-sort-filter";

/** JSON crossing the wire turns every Date into a string — normalize once, right after fetch, so every consumer downstream (ActivityCard, grouping) only ever sees real Date instances. */
function reviveActivity(raw: unknown): ActivityFeedItem {
  const item = raw as ActivityFeedItem & { createdAt: string; updatedAt: string };
  return { ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) };
}

/**
 * INSERIES-FEED-REDESIGN-01 — a timeline e o elemento principal da pagina: aparece logo apos os
 * filtros, pagina de verdade por cursor (app/api/feed/route.ts), nunca busca tudo de uma vez, e
 * agrupa episodios consecutivos antes de renderizar. Filtro rapido opera sobre as atividades ja
 * carregadas (sem query nova por troca de chip) — trocar de pagina/carregar mais e a unica coisa
 * que bate a API.
 */
export function FeedTimeline({
  view,
  initialItems,
  initialCursor,
  emptyTitle,
  emptyCopy,
  authenticated = false
}: {
  view: "personal" | "following" | "global";
  initialItems: ActivityFeedItem[];
  initialCursor: string | null;
  emptyTitle: string;
  emptyCopy: string;
  authenticated?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [filter, setFilter] = useState<FeedFilterOption>("ALL");
  const [loading, setLoading] = useState(false);

  const entries = useMemo(() => groupConsecutiveEpisodes(filterFeed(items, filter)), [items, filter]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/feed?view=${view}&cursor=${encodeURIComponent(cursor)}`);
      const payload = await response.json();
      if (!response.ok) return;
      const nextItems = (payload.data.items as unknown[]).map(reviveActivity);
      setItems((current) => [...current, ...nextItems]);
      setCursor(payload.data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return <EmptyState icon={<FilmIcon className="h-6 w-6" />} title={emptyTitle} copy={emptyCopy} />;
  }

  return (
    <div className="space-y-4">
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FEED_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              filter === option.value ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {entries.length ? (
        <>
          <div className="space-y-3">
            {entries.map((entry) =>
              entry.kind === "episode-group" ? (
                <EpisodeGroupCard key={entry.id} entry={entry} />
              ) : (
                <ActivityCard key={entry.activity.id} activity={entry.activity} authenticated={authenticated} />
              )
            )}
          </div>
          {cursor ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loading}>
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
