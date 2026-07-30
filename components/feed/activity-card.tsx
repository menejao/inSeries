import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/media/poster-image";
import { ActivityInteractionBar } from "@/components/feed/activity-interaction-bar";
import { CheckCircleIcon, FilmIcon, HeartIcon, ListIcon, MessageCircleIcon, StarIcon, TvIcon } from "@/components/ui/icons";
import { formatEpisodeCode, formatRelativeDate, getInitials } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";

const statusLabels: Record<string, string> = {
  WANT_TO_WATCH: "Quero assistir",
  WATCHING: "Assistindo",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

export const typeIcons: Record<ActivityFeedItem["type"], typeof FilmIcon> = {
  EPISODE_WATCHED: CheckCircleIcon,
  SERIES_STATUS_CHANGED: TvIcon,
  SERIES_COMPLETED: StarIcon,
  REVIEW_CREATED: StarIcon,
  LIST_CREATED: ListIcon,
  USER_FOLLOWED: HeartIcon,
  COMMENT_CREATED: MessageCircleIcon
};

function actorLine(activity: ActivityFeedItem) {
  switch (activity.type) {
    case "EPISODE_WATCHED":
      return "assistiu um episodio";
    case "SERIES_STATUS_CHANGED": {
      const metadata = (activity.metadata ?? {}) as { to?: string };
      return metadata.to === "WATCHING" ? "comecou a assistir" : "atualizou o status de";
    }
    case "SERIES_COMPLETED":
      return "concluiu";
    case "REVIEW_CREATED":
      return "avaliou";
    case "LIST_CREATED":
      return "criou a lista";
    case "USER_FOLLOWED":
      return "comecou a seguir";
    case "COMMENT_CREATED":
      return Boolean(activity.comment?.parentId) ? "respondeu a um comentario na review de" : "comentou na review de";
    default:
      return "";
  }
}

/** Plain-text one-liner for compact, non-Feed consumers (Dashboard's "Atividade recente" row) — no links/badges, just "verbo + alvo". */
export function getActionText(activity: ActivityFeedItem): string {
  switch (activity.type) {
    case "EPISODE_WATCHED":
      return activity.series && activity.episode
        ? `assistiu ${formatEpisodeCode(activity.episode.season.number, activity.episode.number)} de ${activity.series.title}`
        : "assistiu um episodio";
    case "SERIES_STATUS_CHANGED": {
      const metadata = (activity.metadata ?? {}) as { to?: string };
      const label = statusLabels[metadata.to ?? ""] ?? metadata.to ?? "";
      return `mudou o status de ${activity.series?.title ?? ""} para ${label}`;
    }
    case "SERIES_COMPLETED":
      return `concluiu ${activity.series?.title ?? ""}`;
    case "REVIEW_CREATED":
      return `avaliou ${activity.series?.title ?? ""} com ${activity.review?.rating}/5`;
    case "LIST_CREATED":
      return `criou a lista ${activity.list?.title ?? ""}`;
    case "USER_FOLLOWED":
      return `comecou a seguir @${activity.targetUser?.username ?? ""}`;
    case "COMMENT_CREATED":
      return activity.comment?.parentId ? `respondeu a um comentario na review de ${activity.series?.title ?? ""}` : `comentou na review de ${activity.series?.title ?? ""}`;
    default:
      return "";
  }
}

/**
 * INSERIES-FEED-REDESIGN-01 — "cada tipo de atividade deve possuir identidade visual propria":
 * o corpo do card muda de estrutura por tipo (poster grande pra episodio/conclusao, resumo +
 * botao pra review, miniaturas de capas pra lista) — nao e mais um unico layout texto+poster
 * pequeno pra tudo.
 */
function ActivityBody({ activity }: { activity: ActivityFeedItem }) {
  switch (activity.type) {
    case "EPISODE_WATCHED": {
      if (!activity.series || !activity.episode) return null;
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-strong/50 p-2.5">
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl">
            <PosterImage src={activity.series.posterUrl} alt={activity.series.title} sizes="56px" />
          </div>
          <div className="min-w-0">
            <Link href={`/series/${activity.series.slug}`} className="block truncate font-semibold text-ink">
              {activity.series.title}
            </Link>
            <Badge variant="secondary" className="mt-1">
              {formatEpisodeCode(activity.episode.season.number, activity.episode.number)}
            </Badge>
          </div>
        </div>
      );
    }
    case "SERIES_COMPLETED": {
      if (!activity.series) return null;
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-primary/8 p-2.5">
          <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl">
            <PosterImage src={activity.series.posterUrl} alt={activity.series.title} sizes="64px" />
          </div>
          <div className="min-w-0 space-y-1">
            <Link href={`/series/${activity.series.slug}`} className="block truncate font-semibold text-ink">
              {activity.series.title}
            </Link>
            <p className="text-sm text-muted">🎉 Serie concluida</p>
          </div>
        </div>
      );
    }
    case "REVIEW_CREATED": {
      if (!activity.series || !activity.review) return null;
      return (
        <div className="space-y-2 rounded-2xl bg-warning/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/series/${activity.series.slug}`} className="truncate font-semibold text-ink">
              {activity.series.title}
            </Link>
            <Badge variant="warning">
              <StarIcon className="h-3 w-3 fill-current" /> {activity.review.rating}/5
            </Badge>
          </div>
          {activity.review.containsSpoiler ? (
            <p className="text-sm italic text-subtle">Contem spoiler — abra a serie para ler.</p>
          ) : (
            <p className="line-clamp-2 text-sm text-muted">{activity.review.body}</p>
          )}
          <Link href={`/series/${activity.series.slug}#reviews`} className="inline-block text-xs font-semibold text-primary hover:underline">
            Ler review
          </Link>
        </div>
      );
    }
    case "LIST_CREATED": {
      if (!activity.list) return null;
      const posters = activity.list.items.map((item) => item.series);
      return (
        <div className="space-y-2 rounded-2xl bg-secondary/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/lists/${activity.list.id}`} className="truncate font-semibold text-ink">
              {activity.list.title}
            </Link>
            <span className="shrink-0 text-xs text-subtle">{activity.list._count.items} serie(s)</span>
          </div>
          {posters.length ? (
            <div className="flex -space-x-3">
              {posters.map((series) => (
                <div key={series.id} className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg border-2 border-surface">
                  <PosterImage src={series.posterUrl} alt={series.title} sizes="44px" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    case "SERIES_STATUS_CHANGED": {
      const metadata = (activity.metadata ?? {}) as { to?: string };
      const label = statusLabels[metadata.to ?? ""] ?? metadata.to ?? "";
      if (!activity.series) return null;
      return (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href={`/series/${activity.series.slug}`} className="font-semibold text-ink">
            {activity.series.title}
          </Link>
          <Badge variant="secondary">{label}</Badge>
        </div>
      );
    }
    case "USER_FOLLOWED": {
      if (!activity.targetUser) return null;
      return (
        <Link
          href={`/profile/${activity.targetUser.username}`}
          className="inline-flex items-center gap-2 rounded-full bg-danger/8 px-3 py-1.5 text-sm font-semibold text-ink"
        >
          <HeartIcon className="h-3.5 w-3.5 text-danger-text" /> @{activity.targetUser.username}
        </Link>
      );
    }
    case "COMMENT_CREATED": {
      if (!activity.comment) return null;
      return <p className="line-clamp-2 rounded-2xl bg-surface-strong/50 p-2.5 text-sm text-muted">{activity.comment.body}</p>;
    }
    default:
      return null;
  }
}

export function ActivityCard({ activity, authenticated = false }: { activity: ActivityFeedItem; authenticated?: boolean }) {
  const Icon = typeIcons[activity.type] ?? FilmIcon;
  const isReviewLinked = activity.type === "REVIEW_CREATED" || activity.type === "COMMENT_CREATED";
  const threadCount = activity.review?._count.comments ?? 0;

  return (
    <Card className="space-y-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Link href={`/profile/${activity.user.username}`}>
            <Avatar label={getInitials(activity.user.name)} name={activity.user.name} src={activity.user.avatarUrl} size="sm" />
          </Link>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-strong text-primary-text">
            <Icon className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm leading-6 text-ink/90">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-ink">
              {activity.user.name}
            </Link>{" "}
            {actorLine(activity)}
          </p>

          <ActivityBody activity={activity} />

          <div className="flex flex-wrap items-center gap-1.5">
            {activity.type === "REVIEW_CREATED" && activity.review?.containsSpoiler ? <Badge variant="danger">Spoiler</Badge> : null}
            {isReviewLinked && threadCount > 0 ? (
              <Badge variant="secondary">
                <MessageCircleIcon className="h-3 w-3" /> {threadCount}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-subtle">{formatRelativeDate(activity.createdAt)}</p>
        </div>
      </div>

      <ActivityInteractionBar
        activityId={activity.id}
        initialLiked={activity.likedByViewer}
        initialLikeCount={activity._count.likes}
        initialCommentCount={activity._count.activityComments}
        authenticated={authenticated}
      />
    </Card>
  );
}
