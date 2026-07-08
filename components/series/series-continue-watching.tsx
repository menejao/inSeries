import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { PlayIcon } from "@/components/ui/icons";
import type { WatchNextItem } from "@/lib/watch-next";

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
}

/**
 * Fase 3 (INSERIES-SERIES-PAGE-PREMIUM-01) — "Continuar Assistindo" logo abaixo do Hero.
 * `item` comes straight from `getWatchNextForUser` (lib/watch-next), filtered by the caller
 * to this one series — the exact same algorithm every other Watch Next surface uses
 * (`/watch-next`, Dashboard's "Watch Next" section, "Continuar assistindo" no Dashboard).
 * No parallel "what's next for this series" rule.
 */
export function SeriesContinueWatching({
  item,
  seriesSlug,
  seriesProgressPercent,
  lastWatchedLabel
}: {
  item: WatchNextItem;
  seriesSlug: string;
  seriesProgressPercent: number;
  lastWatchedLabel: string | null;
}) {
  return (
    <section id="continuar-assistindo" className="rounded-4xl border border-border bg-surface/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <PlayIcon className="h-5 w-5 text-subtle" />
              Continuar assistindo
            </h2>
            {item.isNew ? <Badge variant="success">Novo episodio</Badge> : null}
          </div>
          <p className="font-semibold text-ink">
            {formatEpisodeCode(item.episode.seasonNumber, item.episode.number)} · {item.episode.title}
          </p>
          {lastWatchedLabel ? <p className="text-xs text-subtle">Ultimo assistido {lastWatchedLabel}</p> : null}
          <div className="max-w-sm space-y-1">
            <Progress value={seriesProgressPercent} label="Progresso da serie" />
            <p className="text-xs text-subtle">
              {Math.round(seriesProgressPercent)}% concluido ·{" "}
              {item.pendingAfterNext > 0 ? `${item.pendingAfterNext} episodio(s) restante(s) depois deste` : "ultimo pendente"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href={`/series/${seriesSlug}/episode/${item.episode.id}`} className="inline-flex">
            <Button variant="primary" size="md">
              <PlayIcon className="h-4 w-4" />
              Continuar
            </Button>
          </Link>
          <WatchNextMarkButton episodeId={item.episode.id} />
        </div>
      </div>
    </section>
  );
}
