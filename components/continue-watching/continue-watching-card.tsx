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
 *
 * `variant` (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04, Fase 4/13/17) — "hero" e usado
 * exclusivamente pelo item de maior prioridade no Dashboard (destaque real, backdrop sempre
 * visivel, tipografia maior); "default" (comportamento inalterado) continua sendo usado pelos
 * itens secundarios do Dashboard e por `/profile/[username]` (ContinueWatchingCollection) -
 * extensao no componente compartilhado em vez de um componente hero paralelo, por pedido
 * explicito do ticket ("nao criar componentes paralelos so pra resultado visual rapido").
 */
export function ContinueWatchingCard({
  item,
  priority = false,
  variant = "default"
}: {
  item: ContinueWatchingItem;
  priority?: boolean;
  variant?: "default" | "hero";
}) {
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
  const isHero = variant === "hero";
  const episodeCode = formatEpisodeCode(item.episode.seasonNumber, item.episode.number);

  return (
    <div
      role={isHero ? "group" : undefined}
      aria-label={
        isHero
          ? `Continuar assistindo ${item.series.title}, ${episodeCode}, ${Math.round(item.seriesProgressPercent)}% da serie assistida`
          : undefined
      }
      className={cn(
        "group relative isolate flex shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-border bg-surface-strong/40 transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-raised",
        isHero ? "w-full sm:flex-row" : "h-[700px] w-[300px] sm:h-60 sm:w-[440px] sm:flex-row"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500",
          isHero ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <BackdropImage src={item.series.backdropUrl} alt="" imageClassName={isHero ? "opacity-40" : "opacity-25"} />
        <div className={cn("absolute inset-0 bg-gradient-to-r from-canvas", isHero ? "via-canvas/80 to-canvas/40" : "via-canvas/70 to-canvas/30")} />
      </div>

      <Link
        href={`/series/${item.series.slug}`}
        aria-label={`Abrir ${item.series.title}`}
        className={cn("relative aspect-[2/3] w-full shrink-0 sm:aspect-auto", isHero ? "sm:w-48 md:w-56" : "sm:w-36 md:w-40")}
      >
        <PosterImage
          src={item.series.posterUrl}
          alt={item.series.title}
          priority={priority}
          sizes={isHero ? "(min-width: 640px) 224px, 300px" : "(min-width: 640px) 160px, 300px"}
          imageClassName="transition duration-500 ease-out group-hover:scale-105"
        />
        {item.isNew ? (
          <PosterBadge variant="success" className="absolute left-2 top-2">
            Novo episodio
          </PosterBadge>
        ) : null}
      </Link>

      <div className={cn("flex flex-1 flex-col gap-2 overflow-hidden", isHero ? "justify-center p-5 sm:p-8" : "p-4 sm:p-5")}>
        <Link
          href={`/series/${item.series.slug}`}
          className={cn("line-clamp-1 font-semibold text-ink transition hover:text-primary-text", isHero ? "text-2xl sm:text-3xl" : undefined)}
          title={item.series.title}
        >
          {item.series.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{episodeCode}</Badge>
          {runtime ? <span className="text-xs text-subtle">{runtime}</span> : null}
        </div>
        <p className={cn("line-clamp-1 text-muted", isHero ? "text-base" : "text-sm")}>{item.episode.title}</p>

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

        <div className={cn("flex flex-wrap items-center gap-2 pt-2", !isHero && "mt-auto")}>
          <Link href={`/series/${item.series.slug}/episode/${item.episode.id}`} className="inline-flex">
            <Button variant="primary" size={isHero ? "md" : "sm"}>
              <PlayIcon className="h-4 w-4" />
              {isHero ? "Continuar episodio" : "Continuar"}
            </Button>
          </Link>
          <WatchNextMarkButton
            episodeId={item.episode.id}
            size={isHero ? "md" : "sm"}
            variant="secondary"
            className="whitespace-nowrap"
            label="Marcar assistido"
          />
        </div>
      </div>
    </div>
  );
}
