import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { MarkAllWatchedButton } from "@/components/dashboard/mark-all-watched-button";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import type { AvailableNowGroup } from "@/lib/dashboard/group-by-series";

/**
 * Fase 6 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "Pendencias recentes" revisada:
 * "cada item deve mostrar apenas: poster, serie, quantidade pendente, acao principal...
 * evitar cards altos, evitar grandes areas vazias". Removidos o badge de intervalo de
 * episodios (`rangeLabel`) e a acao secundaria "Ver episodio" - so poster + titulo +
 * contagem + 1 acao (Marcar todos quando ha mais de 1 episodio, Marcar como assistido
 * quando so ha 1), sempre 1 linha de altura.
 */
export function AvailableNowGroupCard({ group }: { group: AvailableNowGroup }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3">
      <Link
        href={`/series/${group.series.slug}`}
        aria-label={`Abrir ${group.series.title}`}
        className="relative aspect-[2/3] h-16 w-11 shrink-0 overflow-hidden rounded-lg"
      >
        <PosterImage src={group.series.posterUrl} alt={group.series.title} sizes="44px" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/series/${group.series.slug}`} className="line-clamp-1 text-sm font-semibold text-ink hover:text-primary-text">
          {group.series.title}
        </Link>
        <p className="line-clamp-1 text-xs text-subtle">
          {group.count} episodio{group.count > 1 ? "s" : ""} nao assistido{group.count > 1 ? "s" : ""}
        </p>
      </div>

      <div className="shrink-0">
        {group.count > 1 ? (
          <MarkAllWatchedButton
            episodeIds={group.episodes.map((episode) => episode.id)}
            count={group.count}
            scope={`os ${group.count} episodios pendentes de ${group.series.title} de uma vez`}
          />
        ) : (
          <WatchNextMarkButton
            episodeId={group.nextEpisode.id}
            size="sm"
            variant="primary"
            className="whitespace-nowrap"
            label="Marcar como assistido"
            ariaLabel={`Marcar ${group.series.title}, temporada ${group.nextEpisode.seasonNumber}, episodio ${group.nextEpisode.number} como assistido`}
          />
        )}
      </div>
    </div>
  );
}
