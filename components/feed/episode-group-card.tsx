import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { CheckCircleIcon } from "@/components/ui/icons";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import type { EpisodeGroupEntry } from "@/lib/social/feed-grouping";

/**
 * INSERIES-FEED-REDESIGN-01 — "Joao assistiu 8 episodios de <serie> S04E01 -> S04E08 ha 25
 * minutos": um unico card pra uma sequencia de episodios consecutivos (ver
 * lib/social/feed-grouping.ts). Sem interacao (curtir/comentar) — o grupo e sintetico, nao
 * corresponde a uma unica Activity; curtir/comentar continuam disponiveis nos cards normais.
 */
export function EpisodeGroupCard({ entry }: { entry: EpisodeGroupEntry }) {
  const sorted = [...entry.episodeNumbers].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const code = (episode: number) => `S${String(entry.seasonNumber).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;

  return (
    <Card className="space-y-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Link href={`/profile/${entry.user.username}`}>
            <Avatar label={getInitials(entry.user.name)} name={entry.user.name} src={entry.user.avatarUrl} size="sm" />
          </Link>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-strong text-primary-text">
            <CheckCircleIcon className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm leading-6 text-ink/90">
            <Link href={`/profile/${entry.user.username}`} className="font-semibold text-ink">
              {entry.user.name}
            </Link>{" "}
            assistiu {sorted.length} episodios de{" "}
            <Link href={`/series/${entry.series.slug}`} className="font-semibold text-ink">
              {entry.series.title}
            </Link>
          </p>

          <div className="flex items-center gap-3 rounded-2xl bg-surface-strong/50 p-2.5">
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl">
              <PosterImage src={entry.series.posterUrl} alt={entry.series.title} sizes="56px" />
            </div>
            <Badge variant="secondary">
              {code(first)} → {code(last)}
            </Badge>
          </div>

          <p className="text-xs text-subtle">{formatRelativeDate(entry.createdAt)}</p>
        </div>
      </div>
    </Card>
  );
}
