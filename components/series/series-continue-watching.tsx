import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WatchNextMarkButton } from "@/components/watch-next/watch-next-mark-button";
import { PlayIcon } from "@/components/ui/icons";
import type { WatchNextItem } from "@/lib/watch-next";

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
}

/**
 * inSeries nao tem player — nunca "continuar assistindo" (nao ha o que retomar), so marcar o
 * proximo episodio pendente como assistido. Removido: link/botao "Continuar" (levava a uma
 * rota de episodio sem player nenhum) e o titulo "Continuar assistindo".
 */
export function SeriesContinueWatching({
  item,
  seriesProgressPercent,
  lastWatchedLabel
}: {
  item: WatchNextItem;
  seriesProgressPercent: number;
  lastWatchedLabel: string | null;
}) {
  return (
    <section className="rounded-4xl border border-border bg-surface/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <PlayIcon className="h-5 w-5 text-subtle" />
              Proximo episodio
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
          <WatchNextMarkButton episodeId={item.episode.id} />
        </div>
      </div>
    </section>
  );
}
