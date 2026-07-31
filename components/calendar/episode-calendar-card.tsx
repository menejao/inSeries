"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode } from "@/lib/utils";
import type { CalendarEpisode } from "@/lib/calendar/queries";
import type { CalendarEpisodeStatus } from "@/lib/calendar/personal-sections";

const STATUS_LABELS: Record<CalendarEpisodeStatus, string> = {
  hoje: "Hoje",
  atrasado: "Atrasado",
  "em-breve": "Em breve",
  assistido: "Assistido"
};

const STATUS_VARIANTS: Record<CalendarEpisodeStatus, "primary" | "danger" | "secondary" | "success"> = {
  hoje: "primary",
  atrasado: "danger",
  "em-breve": "secondary",
  assistido: "success"
};

/**
 * Fase 10/11/12 (INSERIES-CALENDAR-EXPERIENCE-01) — card reduzido: poster, titulo, temporada/
 * episodio, data, 1 badge de status temporal, 1 acao principal + "Abrir serie". O badge
 * antigo (estado de acompanhamento - Assistindo/Quero assistir) foi trocado pelo status
 * temporal (Hoje/Atrasado/Em breve/Assistido) - "evitar excesso de badges" significa 1 so,
 * e o temporal e o que responde a pergunta central desta pagina ("o que preciso fazer
 * quando?"), nao o de acompanhamento (que ja vive no Dashboard/Minha Lista).
 *
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — `watched` e estado local (sincronizado do prop via
 * useEffect) pra o badge "Assistido" acompanhar o EpisodeWatchButton na hora, sem esperar
 * um router.refresh() completar.
 */
export function EpisodeCalendarCard({
  episode,
  authenticated,
  status
}: {
  episode: CalendarEpisode;
  authenticated: boolean;
  status: CalendarEpisodeStatus;
}) {
  const [watched, setWatched] = useState(episode.watched);

  useEffect(() => setWatched(episode.watched), [episode.watched]);

  const effectiveStatus: CalendarEpisodeStatus = watched ? "assistido" : status;

  return (
    <Card className="flex items-center gap-3 overflow-hidden p-3">
      <Link href={`/series/${episode.series.slug}`} className="relative aspect-[2/3] h-16 w-11 shrink-0 overflow-hidden rounded-lg">
        <PosterImage src={episode.series.posterUrl || episode.series.backdropUrl} alt={episode.series.title} sizes="44px" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/series/${episode.series.slug}`} className="line-clamp-1 font-semibold text-ink hover:text-primary-text">
            {episode.series.title}
          </Link>
          <Badge variant={STATUS_VARIANTS[effectiveStatus]}>{STATUS_LABELS[effectiveStatus]}</Badge>
        </div>
        <p className="line-clamp-1 text-sm text-muted">
          {formatEpisodeCode(episode.seasonNumber, episode.number)} · {episode.title}
        </p>
        <p className="text-xs text-subtle">{formatShortDate(episode.airedAt)}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <EpisodeWatchButton
          episodeId={episode.id}
          watched={watched}
          authenticated={authenticated}
          size="sm"
          onChange={(nextWatched) => setWatched(nextWatched)}
        />
        <Link href={`/series/${episode.series.slug}`} className="link-accent shrink-0 text-sm">
          Abrir serie
        </Link>
      </div>
    </Card>
  );
}
