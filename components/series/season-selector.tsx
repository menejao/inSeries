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
import { ChevronDownIcon, LoaderIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Episode } from "@/lib/types";

// Fase 15/17 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — "nunca expandir indefinidamente":
// revela em lotes fixos, nao tudo de uma vez — mesmo uma temporada com centenas de episodios
// nunca renderiza mais que BATCH_SIZE de cada vez no DOM.
const BATCH_SIZE = 20;

export type SeasonSummary = {
  id: string;
  number: number;
  title: string;
  year: number;
  episodeCount: number;
  posterUrl: string;
  overview?: string;
};

/**
 * Fase 12/13/14/25 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — pills de temporada + "Resumo da
 * temporada" + lista de episodios, sempre so da temporada selecionada. Diferente da versao
 * anterior desta mesma fase: agora os episodios de cada temporada sao buscados sob demanda
 * (`GET /api/series/[id]/season/[number]`) na troca de aba, nunca todos de uma vez no server —
 * a query nao escala mais com o numero total de episodios da serie inteira.
 */
export function SeasonSelector({
  seriesId,
  seasons,
  initialSeasonNumber,
  initialEpisodes,
  authenticated
}: {
  seriesId: string;
  seasons: SeasonSummary[];
  initialSeasonNumber: number;
  initialEpisodes: Episode[];
  authenticated: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedNumber, setSelectedNumber] = useState(initialSeasonNumber);
  const [episodesByNumber, setEpisodesByNumber] = useState<Record<number, Episode[]>>({ [initialSeasonNumber]: initialEpisodes });
  const [loadingNumber, setLoadingNumber] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isPending, startTransition] = useTransition();

  const season = useMemo(() => seasons.find((item) => item.number === selectedNumber) ?? seasons[0], [seasons, selectedNumber]);
  const episodes = season ? episodesByNumber[season.number] : undefined;
  const isLoadingEpisodes = season ? loadingNumber === season.number : false;

  async function selectSeason(number: number) {
    setSelectedNumber(number);
    setVisibleCount(BATCH_SIZE);
    if (episodesByNumber[number]) return;

    setLoadingNumber(number);
    try {
      const response = await fetch(`/api/series/${seriesId}/season/${number}`);
      const payload = await response.json();
      setEpisodesByNumber((current) => ({ ...current, [number]: payload.data ?? [] }));
    } finally {
      setLoadingNumber((current) => (current === number ? null : current));
    }
  }

  function markWholeSeasonWatched() {
    if (!season || !episodes) return;
    const unwatchedIds = episodes.filter((episode) => !episode.watched).map((episode) => episode.id);
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

      setEpisodesByNumber((current) => ({
        ...current,
        [season.number]: (current[season.number] ?? []).map((episode) => ({ ...episode, watched: true }))
      }));
      toast({ title: `Temporada ${season.number} marcada como assistida`, variant: "success" });
      router.refresh();
    });
  }

  if (!season) {
    return <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />;
  }

  const watchedInSeason = episodes?.filter((episode) => episode.watched).length ?? 0;
  const remaining = season.episodeCount - watchedInSeason;
  const allWatched = Boolean(episodes?.length) && watchedInSeason === episodes?.length;
  const progressPercent = season.episodeCount > 0 ? (watchedInSeason / season.episodeCount) * 100 : 0;
  const remainingMinutes = episodes?.filter((episode) => !episode.watched).reduce((sum, episode) => sum + (episode.runtimeMinutes || 0), 0) ?? 0;
  const lastWatched = episodes ? [...episodes].reverse().find((episode) => episode.watched) : undefined;
  const nextEpisode = episodes?.find((episode) => !episode.watched);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Temporadas">
        {seasons.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.number === season.number}
            onClick={() => selectSeason(item.number)}
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

        {authenticated && season.episodeCount > 0 && episodes ? (
          <div className="space-y-3 border-t border-border pt-4">
            <Progress value={progressPercent} label={`Progresso da temporada ${season.number}`} />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <InfoRow label="Assistidos" value={String(watchedInSeason)} />
              <InfoRow label="Restantes" value={String(Math.max(remaining, 0))} />
              <InfoRow label="Tempo restante" value={remainingMinutes > 0 ? `${remainingMinutes} min` : "0 min"} />
              <InfoRow label="Ultimo episodio" value={lastWatched ? `E${lastWatched.number}` : "Nenhum"} />
            </dl>
            {nextEpisode ? (
              <p className="text-xs text-subtle">
                Proximo: E{nextEpisode.number} · {nextEpisode.title}
              </p>
            ) : null}
            <Button variant={allWatched ? "secondary" : "primary"} size="sm" disabled={allWatched || isPending} loading={isPending} onClick={markWholeSeasonWatched}>
              {allWatched ? "Temporada assistida" : "Marcar temporada como assistida"}
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Fase 15/17 — altura controlada: nunca mais que BATCH_SIZE episodios no DOM de uma vez, mesmo em temporadas com centenas. */}
      <div className="space-y-3">
        {isLoadingEpisodes ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <LoaderIcon className="h-4 w-4 animate-spin" />
            Carregando episodios...
          </div>
        ) : episodes?.length ? (
          <>
            {episodes.slice(0, visibleCount).map((episode) => (
              <EpisodeRow key={episode.id} episode={episode} seasonNumber={season.number} authenticated={authenticated} />
            ))}
            {episodes.length > visibleCount ? (
              <Button variant="ghost" size="sm" onClick={() => setVisibleCount((count) => count + BATCH_SIZE)} className="w-full justify-center">
                Mostrar mais {Math.min(BATCH_SIZE, episodes.length - visibleCount)} episodios
                <ChevronDownIcon className="h-4 w-4" />
              </Button>
            ) : null}
          </>
        ) : (
          <EmptyState title="Episodios nao importados" copy="Temporada existe, mas episodios ainda nao foram sincronizados." />
        )}
      </div>
    </div>
  );
}
