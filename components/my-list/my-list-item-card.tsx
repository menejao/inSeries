"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PosterImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { MyListItemMenu } from "@/components/my-list/my-list-item-menu";
import { WATCH_STATE_LABELS } from "@/lib/progress/labels";
import { formatEpisodeCode } from "@/lib/utils";
import type { MyListItem } from "@/lib/my-list/types";
import type { WatchNextItem } from "@/lib/watch-next/types";

/**
 * INSERIES-MY-LIST-REDESIGN-01 — card "padrao" (Assistindo/Pausadas/Abandonadas/Favoritas):
 * poster + titulo + status + provider + (so quando `nextEpisode` existe, ou seja, so no grupo
 * Assistindo) progresso discreto. Sem `<select>` permanente — a unica acao visivel e o menu ⋮
 * (`MyListItemMenu`); o checkbox de selecao so aparece no hover/foco, mesma filosofia do menu.
 */
export function MyListItemCard({
  item,
  selected,
  onToggleSelect,
  nextEpisode
}: {
  item: MyListItem;
  selected: boolean;
  onToggleSelect: () => void;
  nextEpisode?: WatchNextItem;
}) {
  const platform = item.series.watchProviders[0] ?? null;

  return (
    <div className="group relative rounded-3xl border border-border bg-surface/70 p-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <Link href={`/series/${item.series.slug}`} className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-2xl border border-border sm:w-24">
          <PosterImage src={item.series.posterUrl} alt={item.series.title} sizes="96px" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <Link href={`/series/${item.series.slug}`} className="min-w-0">
            <SeriesLogoOrTitle
              title={item.series.title}
              logoUrl={item.series.logoUrl}
              as="p"
              textClassName="line-clamp-1 font-semibold text-ink"
              logoClassName="h-6 max-w-[160px]"
            />
          </Link>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{item.state ? WATCH_STATE_LABELS[item.state] : "Sem status"}</Badge>
            {platform ? <Badge variant="outline">{platform}</Badge> : null}
          </div>

          {nextEpisode ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(item.completionPercent)}%` }} />
              </div>
              <p className="truncate text-xs text-subtle">
                Proximo: {formatEpisodeCode(nextEpisode.episode.seasonNumber, nextEpisode.episode.number)} · {Math.round(item.completionPercent)}%
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="absolute left-2 top-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <Checkbox label={<span className="sr-only">Selecionar {item.series.title}</span>} checked={selected} onChange={onToggleSelect} />
      </div>
      <div className="absolute right-2 top-2">
        <MyListItemMenu item={item} />
      </div>
    </div>
  );
}
