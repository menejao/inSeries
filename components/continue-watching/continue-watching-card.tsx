import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { PosterImage, BackdropImage } from "@/components/media/poster-image";
import { PosterBadge } from "@/components/media/poster-badge";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { PlayIcon, InfoIcon } from "@/components/ui/icons";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { ContinueWatchingItem } from "@/lib/continue-watching";

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
}

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  return `${minutes} min`;
}

/**
 * Fase 4/5/15 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — card compacto: mostra apenas uma
 * "informacao de continuidade" (episodios restantes) alem da barra de progresso da serie.
 * Progresso da temporada e ultimo episodio assistido (Nivel 3) saem do corpo do card e viram
 * um Tooltip acessivel por teclado (IconButton `xs`, foco-visivel via group-focus-within do
 * Tooltip) em vez de competir por espaco com a acao principal. "Marcar assistido" e sempre
 * secundario visualmente a "Continuar" (Fase 4: nunca deve competir com a acao principal).
 */
export function ContinueWatchingCard({ item, priority = false }: { item: ContinueWatchingItem; priority?: boolean }) {
  const runtime = formatRuntime(item.episode.runtimeMinutes);
  const continuityText =
    item.pendingAfterNext > 0 ? `${item.pendingAfterNext} episodio(s) restante(s) depois deste` : "Ultimo pendente desta serie";

  const detailParts: string[] = [];
  if (item.seasonProgressPercent > 0) {
    detailParts.push(`Temporada ${item.episode.seasonNumber}: ${item.seasonProgressPercent}% assistida`);
  }
  if (item.lastWatchedEpisode) {
    detailParts.push(
      `Ultimo assistido: ${formatEpisodeCode(item.lastWatchedEpisode.seasonNumber, item.lastWatchedEpisode.number)} · ${formatRelativeDate(item.lastWatchedEpisode.watchedAt)}`
    );
  }
  const hasDetails = detailParts.length > 0;

  return (
    <div className="group relative isolate flex h-[700px] w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-surface-strong/40 transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-raised sm:h-60 sm:w-[440px] sm:flex-row">
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
          <PosterBadge variant="success" className="absolute left-2 top-2">
            Novo episodio
          </PosterBadge>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-4 sm:p-5">
        <Link href={`/series/${item.series.slug}`} className="line-clamp-1 font-semibold text-ink transition hover:text-primary-text" title={item.series.title}>
          {item.series.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{formatEpisodeCode(item.episode.seasonNumber, item.episode.number)}</Badge>
          {runtime ? <span className="text-xs text-subtle">{runtime}</span> : null}
        </div>
        <p className="line-clamp-1 text-sm text-muted">{item.episode.title}</p>

        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between text-xs text-subtle">
            <span className="flex items-center gap-1">
              Progresso da serie
              <Tooltip content={hasDetails ? detailParts.join(" · ") : "Sem detalhes adicionais para este episodio"} side="right">
                <IconButton
                  label="Mais detalhes do progresso"
                  variant="ghost"
                  size="xs"
                  className={cn(!hasDetails && "invisible")}
                >
                  <InfoIcon className="h-3.5 w-3.5" />
                </IconButton>
              </Tooltip>
            </span>
            <span>{Math.round(item.seriesProgressPercent)}%</span>
          </div>
          <Progress value={item.seriesProgressPercent} label={`Progresso de ${item.series.title}`} />
        </div>

        <p className="truncate text-xs text-subtle">{continuityText}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Link href={`/series/${item.series.slug}/episode/${item.episode.id}`} className="inline-flex">
            <Button variant="primary" size="sm">
              <PlayIcon className="h-4 w-4" />
              Continuar
            </Button>
          </Link>
          <WatchNextMarkButton episodeId={item.episode.id} size="sm" variant="secondary" className="whitespace-nowrap" label="Marcar assistido" />
        </div>
      </div>
    </div>
  );
}
