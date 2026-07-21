import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { PlayIcon } from "@/components/ui/icons";

type EpisodeActionRowEpisode = {
  id: string;
  title: string;
  number: number;
  seasonNumber: number;
  series: { slug: string; title: string; posterUrl: string | null };
};

type EpisodeActionRowAction =
  | { kind: "mark"; label: string }
  | { kind: "continue"; label: string; href: string }
  | { kind: "open-series"; label: string; href: string };

/**
 * Fase 6/9/17 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — linha compacta compartilhada por
 * "Novos para voce" e "Pendencias acionaveis" (e, sem `action`, pela Agenda resumida): evita
 * dois componentes paralelos quase identicos. `action` decide o CTA — nunca um botao
 * generico "Marcar" sem contexto (Fase 9).
 */
export function EpisodeActionRow({
  episode,
  dateLabel,
  badge,
  action
}: {
  episode: EpisodeActionRowEpisode;
  dateLabel: string;
  badge?: { label: string; variant: "success" | "warning" | "outline" };
  action?: EpisodeActionRowAction;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href={`/series/${episode.series.slug}`}
          aria-label={`Abrir ${episode.series.title}`}
          className="relative aspect-[2/3] h-16 w-11 shrink-0 overflow-hidden rounded-lg"
        >
          <PosterImage src={episode.series.posterUrl} alt={episode.series.title} sizes="44px" />
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={`/series/${episode.series.slug}`} className="line-clamp-1 text-sm font-semibold text-ink hover:text-primary-text">
            {episode.series.title}
          </Link>
          <p className="line-clamp-1 text-xs text-subtle">
            T{String(episode.seasonNumber).padStart(2, "0")} | E{String(episode.number).padStart(2, "0")} · {episode.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
            <span className="text-xs text-subtle">{dateLabel}</span>
          </div>
        </div>
      </div>

      {action ? (
        <div className="shrink-0">
          {action.kind === "mark" ? (
            <WatchNextMarkButton episodeId={episode.id} size="sm" variant="secondary" className="w-full whitespace-nowrap sm:w-auto" label={action.label} />
          ) : (
            <Link href={action.href} className="inline-flex w-full sm:w-auto">
              <Button
                variant={action.kind === "continue" ? "secondary" : "outline"}
                size="sm"
                className="w-full whitespace-nowrap sm:w-auto"
              >
                {action.kind === "continue" ? <PlayIcon className="h-4 w-4" /> : null}
                {action.label}
              </Button>
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
