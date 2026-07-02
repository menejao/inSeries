import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatEpisodeCode, formatRelativeDate, getInitials } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";

const statusLabels: Record<string, string> = {
  WANT_TO_WATCH: "Quero assistir",
  WATCHING: "Assistindo",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

function getActionContent(activity: ActivityFeedItem) {
  switch (activity.type) {
    case "EPISODE_WATCHED": {
      if (!activity.series || !activity.episode) return { text: "assistiu um episodio", link: null };
      return {
        text: (
          <>
            assistiu <Badge>{formatEpisodeCode(activity.episode.season.number, activity.episode.number)}</Badge> de{" "}
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
            para <Badge>{label}</Badge>
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
            com <Badge>{activity.review?.rating}/5</Badge>
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

  return (
    <Card className="flex gap-4">
      <Link href={`/profile/${activity.user.username}`} className="shrink-0">
        <Avatar label={getInitials(activity.user.name)} src={activity.user.avatarUrl} className="h-11 w-11 text-sm" />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-slate-200">
          <Link href={`/profile/${activity.user.username}`} className="font-semibold text-ink">
            {activity.user.name}
          </Link>{" "}
          {action.text}
        </p>
        {activity.type === "REVIEW_CREATED" && activity.review ? (
          <p className="line-clamp-2 text-sm text-slate-300">{activity.review.body}</p>
        ) : null}
        <p className="text-xs text-slate-400">{formatRelativeDate(activity.createdAt)}</p>
      </div>
    </Card>
  );
}
