"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { cn, formatEpisodeCode } from "@/lib/utils";
import type { Episode } from "@/lib/types";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";
import { EpisodeWatchedAtEditor } from "@/components/series/episode-watched-at-editor";

/**
 * Fase 5 (INSERIES-SERIES-PAGE-PREMIUM-01) — image always visible (mobile included, previously `hidden sm:block`), premium hover lift consistent with every other card in the app.
 * Fase 14 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — sinopse removida ("evitar cards excessivamente altos"; mostra apenas numero/titulo/runtime/data/status/acao).
 *
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — badge "Assistido"/data agora sao estado local (nao mais
 * o prop `episode` direto): antes so atualizavam depois de um `router.refresh()` completar a
 * viagem ida-e-volta ao servidor, entao clicar "Marcar" deixava o card visualmente atrasado
 * por um instante (ou preso, dependendo do timing de cache da rota). `EpisodeWatchButton`
 * agora avisa este componente assim que a mutation confirma, sem esperar o refresh.
 */
export function EpisodeRow({
  episode,
  seasonNumber,
  authenticated = false
}: {
  episode: Episode;
  seasonNumber: number;
  authenticated?: boolean;
}) {
  const [watched, setWatched] = useState(episode.watched);
  const [watchedAt, setWatchedAt] = useState(episode.watchedAt);

  // Um irmao (ex: "Marcar temporada como assistida" no SeasonSelector) pode atualizar o
  // `episode` deste card por fora — sincroniza sempre que o prop muda, sem descartar o que
  // este proprio card acabou de marcar localmente.
  useEffect(() => {
    setWatched(episode.watched);
    setWatchedAt(episode.watchedAt);
  }, [episode.watched, episode.watchedAt]);

  return (
    <Card
      padding="sm"
      className={cn(
        "flex gap-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised sm:gap-4",
        watched && "border-success/25 bg-success/[0.04]"
      )}
    >
      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-2xl sm:w-32">
        <PosterImage src={episode.stillUrl} alt={episode.title} sizes="128px" />
      </div>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatEpisodeCode(seasonNumber, episode.number)}</Badge>
            <p className="font-semibold text-ink">{episode.title}</p>
            {watched ? <Badge variant="success">Assistido</Badge> : null}
          </div>
          <p className="text-xs text-subtle">
            {episode.runtimeMinutes || "n/d"} min · {episode.airedOn || "n/d"}
          </p>
          {watched && watchedAt && authenticated ? <EpisodeWatchedAtEditor episodeId={episode.id} initialWatchedAt={watchedAt} /> : null}
        </div>
        <EpisodeWatchButton
          episodeId={episode.id}
          initialWatched={episode.watched}
          authenticated={authenticated}
          size="sm"
          onChange={(nextWatched, nextWatchedAt) => {
            setWatched(nextWatched);
            setWatchedAt(nextWatchedAt);
          }}
        />
      </div>
    </Card>
  );
}
