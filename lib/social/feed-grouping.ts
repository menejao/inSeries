import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * INSERIES-FEED-REDESIGN-01 — "evitar gerar dezenas de atividades consecutivas": consecutive
 * EPISODE_WATCHED entries (in the already createdAt-desc-sorted feed) from the same user and
 * the same series, close enough in time, collapse into a single timeline entry showing the
 * episode range (e.g. "S04E01 -> S04E08"). Any other activity type — even from the same user —
 * breaks the run, since "consecutivas" means back-to-back in the timeline, not just nearby in
 * time. Grouping only ever looks at the page currently in memory (a group never spans a
 * pagination boundary) — an acceptable simplification since each page still reads
 * chronologically top to bottom.
 */
const GROUP_WINDOW_MS = 3 * 60 * 60 * 1000;

export type EpisodeGroupEntry = {
  kind: "episode-group";
  id: string;
  user: ActivityFeedItem["user"];
  series: NonNullable<ActivityFeedItem["series"]>;
  seasonNumber: number;
  episodeNumbers: number[];
  createdAt: Date;
  activityIds: string[];
  likeCount: number;
  commentCount: number;
};

export type FeedTimelineEntry = { kind: "activity"; activity: ActivityFeedItem } | EpisodeGroupEntry;

function isGroupableEpisode(
  activity: ActivityFeedItem
): activity is ActivityFeedItem & { series: NonNullable<ActivityFeedItem["series"]>; episode: NonNullable<ActivityFeedItem["episode"]> } {
  return activity.type === "EPISODE_WATCHED" && Boolean(activity.series) && Boolean(activity.episode);
}

export function groupConsecutiveEpisodes(activities: ActivityFeedItem[]): FeedTimelineEntry[] {
  const entries: FeedTimelineEntry[] = [];
  let current: (EpisodeGroupEntry & { seasonNumber: number }) | null = null;

  for (const activity of activities) {
    if (!isGroupableEpisode(activity)) {
      current = null;
      entries.push({ kind: "activity", activity });
      continue;
    }

    const sameGroup =
      current &&
      current.user.id === activity.user.id &&
      current.series.id === activity.series.id &&
      current.seasonNumber === activity.episode.season.number &&
      current.createdAt.getTime() - activity.createdAt.getTime() <= GROUP_WINDOW_MS;

    if (sameGroup && current) {
      current.episodeNumbers.push(activity.episode.number);
      current.activityIds.push(activity.id);
      current.likeCount += activity._count.likes;
      current.commentCount += activity._count.activityComments;
      // Keep the earliest timestamp of the run as `createdAt` — "há 25 minutos" in the ticket
      // example refers to when the run happened, not to each individual episode inside it.
      current.createdAt = activity.createdAt < current.createdAt ? activity.createdAt : current.createdAt;
      continue;
    }

    current = {
      kind: "episode-group",
      id: `group-${activity.id}`,
      user: activity.user,
      series: activity.series,
      seasonNumber: activity.episode.season.number,
      episodeNumbers: [activity.episode.number],
      createdAt: activity.createdAt,
      activityIds: [activity.id],
      likeCount: activity._count.likes,
      commentCount: activity._count.activityComments
    };
    entries.push(current);
  }

  // Runs of exactly 1 episode render as a normal single activity card, not a "group" —
  // grouping only kicks in when there's actually something to collapse.
  return entries.map((entry) => {
    if (entry.kind !== "episode-group" || entry.episodeNumbers.length > 1) return entry;
    const original = activities.find((activity) => activity.id === entry.activityIds[0]);
    return original ? { kind: "activity" as const, activity: original } : entry;
  });
}
