import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosterImage } from "@/components/media/poster-image";
import { MarkAllWatchedButton } from "@/components/dashboard/mark-all-watched-button";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { AvailableNowGroup } from "@/lib/dashboard/group-by-series";

/**
 * Fase 8 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — 1 card por serie em vez de 1 linha
 * por episodio (achado real na Fase 1: "muitos episodios da mesma serie sao repetidos
 * individualmente"). "Ver episodio" (acao secundaria) sempre leva ao episodio mais antigo nao
 * assistido do grupo; "Marcar todos" (mesmo MarkAllWatchedButton ja usado no cabecalho da
 * secao, so que aqui escopado aos episodios deste grupo, e a acao PRINCIPAL) so aparece com
 * mais de 1 episodio - "nao implementar novas acoes em lote sem suporte nas regras atuais" (a
 * acao ja existe, so muda o escopo).
 *
 * Fase 4/16 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — "Continuar serie" + icone de play
 * removidos: sugeriam reproducao. Trocado por "Ver episodio" (da lista de acoes permitidas
 * do ticket) com um chevron neutro, sempre secundario a "Marcar todos".
 */
export function AvailableNowGroupCard({ group }: { group: AvailableNowGroup }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
          {group.rangeLabel ? (
            <div className="mt-1">
              <Badge variant="outline">{group.rangeLabel}</Badge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:shrink-0">
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
            className="w-full whitespace-nowrap"
            label="Marcar como assistido"
            ariaLabel={`Marcar ${group.series.title}, temporada ${group.nextEpisode.seasonNumber}, episodio ${group.nextEpisode.number} como assistido`}
          />
        )}
        <Link href={`/series/${group.series.slug}/episode/${group.nextEpisode.id}`} className="inline-flex w-full">
          <Button variant="secondary" size="sm" className="w-full whitespace-nowrap">
            Ver episodio
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
