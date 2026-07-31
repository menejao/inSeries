"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EpisodeRow } from "@/components/series/episode-row";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoRow } from "@/components/series/info-row";
import { ChevronDownIcon, LoaderIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useMatchedColumnHeight } from "@/components/series/series-columns-layout";
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
 * Select de temporada (nao mais pills — quebravam o layout em series com muitas temporadas,
 * ex. 22) + "Resumo da temporada" + lista de episodios, sempre so da temporada selecionada. Os
 * episodios de cada temporada sao buscados sob demanda (`GET /api/series/[id]/season/[number]`)
 * na troca de temporada, nunca todos de uma vez no server.
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
  const matchedHeight = useMatchedColumnHeight();
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
    const now = new Date();
    const hasUnwatchedAvailable = episodes.some((episode) => !episode.watched && episode.airedOn && new Date(episode.airedOn) <= now);
    if (!hasUnwatchedAvailable) return;

    startTransition(async () => {
      // INSERIES-SERIES-STATUS-ENGINE-01 — single request, single recalculation (server-side
      // `markSeasonWatched`), replacing the old one-request-per-episode loop. Only episodes
      // already aired are marked — the server is the one source of truth for "available".
      const response = await fetch(`/api/series/${seriesId}/season/${season.number}/watch`, { method: "POST" });

      if (!response.ok) {
        toast({ title: "Erro ao marcar a temporada", variant: "error" });
        return;
      }

      setEpisodesByNumber((current) => ({
        ...current,
        [season.number]: (current[season.number] ?? []).map((episode) =>
          episode.airedOn && new Date(episode.airedOn) <= new Date() ? { ...episode, watched: true } : episode
        )
      }));
      toast({ title: `Temporada ${season.number} marcada como assistida`, variant: "success" });
      router.refresh();
    });
  }

  if (!season) {
    return <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />;
  }

  // INSERIES-SERIES-STATUS-ENGINE-01 — "temporada assistida" e um estado DERIVADO, calculado
  // apenas sobre episodios ja lancados: uma temporada com todos os episodios disponiveis
  // assistidos + 1 episodio futuro anunciado ainda conta como "Temporada assistida" (o botao
  // so volta a ficar habilitado quando um episodio ja assistido for desmarcado, nunca por
  // causa de um episodio que ainda nem foi ao ar).
  const now = new Date();
  const availableEpisodes = episodes?.filter((episode) => episode.airedOn && new Date(episode.airedOn) <= now) ?? [];
  const watchedInSeason = availableEpisodes.filter((episode) => episode.watched).length;
  const remaining = availableEpisodes.length - watchedInSeason;
  const allWatched = Boolean(availableEpisodes.length) && watchedInSeason === availableEpisodes.length;
  const progressPercent = availableEpisodes.length > 0 ? (watchedInSeason / availableEpisodes.length) * 100 : 0;
  const remainingMinutes = availableEpisodes.filter((episode) => !episode.watched).reduce((sum, episode) => sum + (episode.runtimeMinutes || 0), 0);
  const lastWatched = episodes ? [...episodes].reverse().find((episode) => episode.watched) : undefined;
  const nextEpisode = availableEpisodes.find((episode) => !episode.watched);

  return (
    <div className="flex min-h-0 flex-col space-y-4" style={matchedHeight ? { maxHeight: matchedHeight } : undefined}>
      <Card className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-ink">{season.title}</p>
            <p className="text-sm text-muted">
              {season.year || "Ano n/d"} · {season.episodeCount} episodio{season.episodeCount === 1 ? "" : "s"}
            </p>
          </div>
          {/* Select em vez de pills — escala pra series com dezenas de temporadas sem quebrar o layout. */}
          <Select
            aria-label="Selecionar temporada"
            value={String(season.number)}
            onChange={(event) => selectSeason(Number(event.target.value))}
            className="w-40"
          >
            {seasons.map((item) => (
              <option key={item.id} value={item.number}>
                Temporada {item.number}
              </option>
            ))}
          </Select>
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

      {/*
        Fase 15/17 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — altura controlada de 2 formas
        complementares: nunca mais que BATCH_SIZE episodios no DOM de uma vez ("Mostrar mais"),
        e a area em si ganha scroll interno com altura maxima igual a coluna esquerda
        (Resumo/Producao/Proximo lancamento/Sua jornada) quando ha espaco lado a lado (`lg`),
        pra nao empurrar o rodape da pagina pra baixo so por causa da lista de episodios.
      */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
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
