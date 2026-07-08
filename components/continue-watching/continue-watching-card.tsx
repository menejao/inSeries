import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PosterImage, BackdropImage } from "@/components/media/poster-image";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { PlayIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { ContinueWatchingItem } from "@/lib/continue-watching";

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
}

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  return `${minutes} min`;
}

/**
 * Fase 4/8 (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) — the premium "continue watching"
 * card: poster grande + backdrop wash on hover, temporada/episodio, progresso da serie e
 * da temporada, episodios restantes, ultimo episodio assistido, e as duas acoes pedidas
 * ("Continuar" navega para o episodio; "Marcar como assistido" reaproveita
 * WatchNextMarkButton — Fase 7, mesma mutation/refresh que todo outro botao de marcar
 * assistido do app).
 */
export function ContinueWatchingCard({ item, priority = false }: { item: ContinueWatchingItem; priority?: boolean }) {
  const runtime = formatRuntime(item.episode.runtimeMinutes);

  return (
    <div className="group relative isolate flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-surface-strong/40 transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised sm:w-[440px] sm:flex-row">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <BackdropImage src={item.series.backdropUrl} alt="" imageClassName="opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-canvas/30" />
      </div>

      <Link
        href={`/series/${item.series.slug}`}
        aria-label={`Abrir ${item.series.title}`}
        className="relative aspect-[2/3] w-full shrink-0 sm:aspect-auto sm:w-36 md:w-40"
      >
        <PosterImage
          src={item.series.posterUrl}
          alt={item.series.title}
          priority={priority}
          sizes="(min-width: 640px) 160px, 300px"
          imageClassName="transition duration-500 ease-out group-hover:scale-105"
        />
        {item.isNew ? (
          <Badge variant="success" className="absolute left-2 top-2">
            Novo episodio
          </Badge>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <Link href={`/series/${item.series.slug}`} className="font-semibold text-ink transition hover:text-primary-text">
          {item.series.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{formatEpisodeCode(item.episode.seasonNumber, item.episode.number)}</Badge>
          {runtime ? <span className="text-xs text-subtle">{runtime}</span> : null}
        </div>
        <p className="line-clamp-1 text-sm text-muted">{item.episode.title}</p>

        <div className="mt-1 space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-subtle">
              <span>Progresso da serie</span>
              <span>{Math.round(item.seriesProgressPercent)}%</span>
            </div>
            <Progress value={item.seriesProgressPercent} label={`Progresso de ${item.series.title}`} />
          </div>
          {item.seasonProgressPercent > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-subtle">
                <span>Progresso da temporada {item.episode.seasonNumber}</span>
                <span>{item.seasonProgressPercent}%</span>
              </div>
              <Progress value={item.seasonProgressPercent} label={`Progresso da temporada ${item.episode.seasonNumber}`} />
            </div>
          ) : null}
        </div>

        <p className="text-xs text-subtle">
          {item.pendingAfterNext > 0 ? `${item.pendingAfterNext} episodio(s) restante(s) depois deste` : "Ultimo pendente desta serie"}
        </p>
        {item.lastWatchedEpisode ? (
          <p className="text-xs text-subtle">
            Ultimo assistido: {formatEpisodeCode(item.lastWatchedEpisode.seasonNumber, item.lastWatchedEpisode.number)} ·{" "}
            {formatRelativeDate(item.lastWatchedEpisode.watchedAt)}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href={`/series/${item.series.slug}/episode/${item.episode.id}`} className="inline-flex">
            <Button variant="secondary" size="sm">
              <PlayIcon className="h-4 w-4" />
              Continuar
            </Button>
          </Link>
          <WatchNextMarkButton episodeId={item.episode.id} />
        </div>
      </div>
    </div>
  );
}
