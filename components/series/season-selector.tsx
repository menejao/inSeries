"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EpisodeRow } from "@/components/series/episode-row";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoRow } from "@/components/series/info-row";
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
 * Fase 12/13/14 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — accordion trocado por navegacao
 * dedicada: pills de temporada + 1 "Resumo da temporada" + lista de episodios, sempre so da
 * temporada selecionada renderizada no DOM (Fase 25 — nunca todas simultaneamente). Os dados
 * de todas as temporadas ja chegam prontos do server (mesma query de antes, ver Fase 1 audit
 * em docs/catalog-series-experience-01.md sobre o limite dessa abordagem), mas so uma e
 * montada na arvore React por vez.
 */
export function SeasonSelector({ seasons, authenticated }: { seasons: HydratedSeason[]; authenticated: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedNumber, setSelectedNumber] = useState(seasons[0]?.number ?? 1);
  const [isPending, startTransition] = useTransition();

  const season = useMemo(() => seasons.find((item) => item.number === selectedNumber) ?? seasons[0], [seasons, selectedNumber]);

  if (!season) {
    return <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />;
  }

  const watchedInSeason = season.episodes.filter((episode) => episode.watched).length;
  const remaining = season.episodeCount - watchedInSeason;
  const allWatched = season.episodes.length > 0 && watchedInSeason === season.episodes.length;
  const progressPercent = season.episodeCount > 0 ? (watchedInSeason / season.episodeCount) * 100 : 0;
  const remainingMinutes = season.episodes.filter((episode) => !episode.watched).reduce((sum, episode) => sum + (episode.runtimeMinutes || 0), 0);
  const lastWatched = [...season.episodes].reverse().find((episode) => episode.watched);
  const nextEpisode = season.episodes.find((episode) => !episode.watched);

  function markWholeSeasonWatched() {
    const unwatchedIds = season!.episodes.filter((episode) => !episode.watched).map((episode) => episode.id);
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

      toast({ title: `Temporada ${season!.number} marcada como assistida`, variant: "success" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Temporadas">
        {seasons.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.number === season.number}
            onClick={() => setSelectedNumber(item.number)}
            className={cn(
              "min-h-9 rounded-full border px-4 text-sm font-medium transition",
              item.number === season.number
                ? "border-primary bg-primary/10 text-primary-text"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-ink"
            )}
          >
            Temporada {item.number}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-ink">{season.title}</p>
            <p className="text-sm text-muted">
              {season.year || "Ano n/d"} · {season.episodeCount} episodio{season.episodeCount === 1 ? "" : "s"}
            </p>
          </div>
          <Badge variant="outline">Temporada {season.number}</Badge>
        </div>

        {authenticated && season.episodeCount > 0 ? (
          <div className="space-y-3 border-t border-border pt-4">
            <Progress value={progressPercent} label={`Progresso da temporada ${season.number}`} />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <InfoRow label="Assistidos" value={String(watchedInSeason)} />
              <InfoRow label="Restantes" value={String(Math.max(remaining, 0))} />
              <InfoRow label="Tempo restante" value={remainingMinutes > 0 ? `${remainingMinutes} min` : "0 min"} />
              <InfoRow label="Ultimo episodio" value={lastWatched ? `E${lastWatched.number}` : "Nenhum"} />
            </dl>
            {nextEpisode ? <p className="text-xs text-subtle">Proximo: E{nextEpisode.number} · {nextEpisode.title}</p> : null}
            <Button variant={allWatched ? "secondary" : "primary"} size="sm" disabled={allWatched || isPending} loading={isPending} onClick={markWholeSeasonWatched}>
              {allWatched ? "Temporada assistida" : "Marcar temporada como assistida"}
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {season.episodes.length ? (
          season.episodes.map((episode) => <EpisodeRow key={episode.id} episode={episode} seasonNumber={season.number} authenticated={authenticated} />)
        ) : (
          <EmptyState title="Episodios nao importados" copy="Temporada existe, mas episodios ainda nao foram sincronizados." />
        )}
      </div>
    </div>
  );
}
