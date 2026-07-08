"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PosterImage } from "@/components/media/poster-image";
import { EpisodeRow } from "@/components/series/episode-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronDownIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Episode } from "@/lib/types";

export type HydratedSeason = {
  id: string;
  number: number;
  title: string;
  year: number;
  episodeCount: number;
  posterUrl: string;
  overview?: string;
  episodes: Episode[];
};

/**
 * Fase 4 (INSERIES-SERIES-PAGE-PREMIUM-01) — "marcar uma temporada inteira assistida de
 * uma vez" reuses the exact same `POST /api/episodes/[id]/progress` mutation every single
 * episode toggle already calls (`EpisodeWatchButton`) — fired once per unwatched episode in
 * parallel, never a new bulk endpoint. This preserves every side effect
 * `toggleEpisodeProgress` already has per episode (activity feed, gamification,
 * notifications) exactly as if the user had clicked each one — a real bulk endpoint would
 * have to carefully replicate all of that; calling the existing one N times does it for
 * free.
 */
export function SeasonCard({
  season,
  authenticated,
  defaultExpanded = false
}: {
  season: HydratedSeason;
  authenticated: boolean;
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isPending, startTransition] = useTransition();

  const watchedInSeason = season.episodes.filter((episode) => episode.watched).length;
  const allWatched = season.episodes.length > 0 && watchedInSeason === season.episodes.length;
  const progressPercent = season.episodeCount > 0 ? (watchedInSeason / season.episodeCount) * 100 : 0;

  function markWholeSeasonWatched() {
    const unwatchedIds = season.episodes.filter((episode) => !episode.watched).map((episode) => episode.id);
    if (!unwatchedIds.length) return;

    startTransition(async () => {
      const results = await Promise.all(
        unwatchedIds.map((episodeId) =>
          fetch(`/api/episodes/${episodeId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId, watched: true })
          })
        )
      );

      if (results.some((response) => !response.ok)) {
        toast({ title: "Erro ao marcar a temporada", variant: "error" });
        return;
      }

      toast({ title: `Temporada ${season.number} marcada como assistida`, variant: "success" });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 text-left"
      >
        <div className="relative hidden h-24 w-16 shrink-0 overflow-hidden rounded-2xl border border-border sm:block">
          <PosterImage src={season.posterUrl} alt={season.title} sizes="64px" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-semibold text-ink">{season.title}</p>
            <Badge variant="outline">Temporada {season.number}</Badge>
          </div>
          <p className="text-sm text-muted">
            {season.year || "Ano n/d"} · {season.episodeCount} episodio{season.episodeCount === 1 ? "" : "s"}
          </p>
          {authenticated && season.episodeCount > 0 ? <Progress value={progressPercent} label={`Progresso da temporada ${season.number}`} /> : null}
        </div>
        <ChevronDownIcon className={cn("h-5 w-5 shrink-0 text-subtle transition duration-200", expanded && "rotate-180")} />
      </button>

      {authenticated && season.episodeCount > 0 ? (
        <Button variant={allWatched ? "secondary" : "primary"} size="sm" disabled={allWatched || isPending} loading={isPending} onClick={markWholeSeasonWatched}>
          {allWatched ? "Temporada assistida" : "Marcar temporada como assistida"}
        </Button>
      ) : null}

      {expanded ? (
        <div className="space-y-3 border-t border-border pt-4">
          {season.episodes.length ? (
            season.episodes.map((episode) => <EpisodeRow key={episode.id} episode={episode} seasonNumber={season.number} authenticated={authenticated} />)
          ) : (
            <EmptyState title="Episodios nao importados" copy="Temporada existe, mas episodios ainda nao foram sincronizados." />
          )}
        </div>
      ) : null}
    </Card>
  );
}
