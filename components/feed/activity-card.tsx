import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircleIcon, FilmIcon, HeartIcon, ListIcon, StarIcon, TvIcon } from "@/components/ui/icons";
import { formatEpisodeCode, formatRelativeDate, getInitials } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  WANT_TO_WATCH: "Quero assistir",
  WATCHING: "Assistindo",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

const typeIcons: Record<ActivityFeedItem["type"], typeof FilmIcon> = {
  EPISODE_WATCHED: CheckCircleIcon,
  SERIES_STATUS_CHANGED: TvIcon,
  SERIES_COMPLETED: StarIcon,
  REVIEW_CREATED: StarIcon,
  LIST_CREATED: ListIcon,
  USER_FOLLOWED: HeartIcon
};

function getActionContent(activity: ActivityFeedItem) {
  switch (activity.type) {
    case "EPISODE_WATCHED": {
      if (!activity.series || !activity.episode) return { text: "assistiu um episodio" };
      return {
        text: (
          <>
            assistiu <Badge variant="secondary">{formatEpisodeCode(activity.episode.season.number, activity.episode.number)}</Badge> de{" "}
            <Link href={`/series/${activity.series.slug}`} className="font-semibold text-ink">
              {activity.series.title}
            </Link>
          </>
        )
      };
    }
    case "SERIES_STATUS_CHANGED": {
      const metadata = (activity.metadata ?? {}) as { to?: string };
      const label = statusLabels[metadata.to ?? ""] ?? metadata.to ?? "";
      return {
        text: (
          <>
            mudou o status de{" "}
            <Link href={`/series/${activity.series?.slug ?? ""}`} className="font-semibold text-ink">
              {activity.series?.title}
            </Link>{" "}
            para <Badge variant="secondary">{label}</Badge>
          </>
        )
      };
    }
    case "SERIES_COMPLETED": {
      return {
        text: (
          <>
            concluiu{" "}
            <Link href={`/series/${activity.series?.slug ?? ""}`} className="font-semibold text-ink">
              {activity.series?.title}
            </Link>
          </>
        )
      };
    }
    case "REVIEW_CREATED": {
      return {
        text: (
          <>
            avaliou{" "}
            <Link href={`/series/${activity.series?.slug ?? ""}`} className="font-semibold text-ink">
              {activity.series?.title}
            </Link>{" "}
            com{" "}
            <Badge variant="warning">
              <StarIcon className="h-3 w-3 fill-current" /> {activity.review?.rating}/5
            </Badge>
          </>
        )
      };
    }
    case "LIST_CREATED": {
      return {
        text: (
          <>
            criou a lista{" "}
            <Link href={`/lists/${activity.list?.id ?? ""}`} className="font-semibold text-ink">
              {activity.list?.title}
            </Link>
          </>
        )
      };
    }
    case "USER_FOLLOWED": {
      return {
        text: (
          <>
            comecou a seguir{" "}
            <Link href={`/profile/${activity.targetUser?.username ?? ""}`} className="font-semibold text-ink">
              @{activity.targetUser?.username}
            </Link>
          </>
        )
      };
    }
    default:
      return { text: "" };
  }
}

export function ActivityCard({ activity }: { activity: ActivityFeedItem }) {
  const action = getActionContent(activity);
  const Icon = typeIcons[activity.type] ?? FilmIcon;

  return (
    <Card className="flex gap-3">
      <div className="relative shrink-0">
        <Link href={`/profile/${activity.user.username}`}>
          <Avatar label={getInitials(activity.user.name)} name={activity.user.name} src={activity.user.avatarUrl} size="sm" />
        </Link>
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-surface-strong text-primary-text"
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-6 text-ink/90">
          <Link href={`/profile/${activity.user.username}`} className="font-semibold text-ink">
            {activity.user.name}
          </Link>{" "}
          {action.text}
        </p>
        {activity.type === "REVIEW_CREATED" && activity.review ? (
          <p className="line-clamp-2 text-sm text-muted">{activity.review.body}</p>
        ) : null}
        <p className="text-xs text-subtle">{formatRelativeDate(activity.createdAt)}</p>
      </div>
    </Card>
  );
}
