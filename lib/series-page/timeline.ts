/**
 * Fase 10 (INSERIES-SERIES-PAGE-PREMIUM-01) — a pure function, no I/O: every input here
 * is already fetched by the series detail page for other sections (status, watched
 * episodes with timestamps, own review) plus one small additive query (added-to-list
 * timestamp, lib/series-page/queries.ts). No new business rule, no parallel "what did the
 * user do" tracker — this only re-reads timestamps that already exist on
 * UserSeriesStatus/UserEpisodeProgress/Review/ListItem.
 */
export type SeriesTimelineEventType = "STARTED" | "EPISODE_WATCHED" | "SEASON_COMPLETED" | "REVIEWED" | "ADDED_TO_LIST";

export type SeriesTimelineEvent = {
  type: SeriesTimelineEventType;
  label: string;
  detail?: string;
  occurredAt: Date;
};

export type SeriesTimelineInput = {
  startedAt: Date | null;
  lastWatchedEpisode: { seasonNumber: number; number: number; title: string; watchedAt: Date } | null;
  completedSeasons: Array<{ number: number; completedAt: Date }>;
  reviewedAt: Date | null;
  addedToListAt: Date | null;
};

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;
}

export function computeSeriesTimeline(input: SeriesTimelineInput): SeriesTimelineEvent[] {
  const events: SeriesTimelineEvent[] = [];

  if (input.startedAt) {
    events.push({ type: "STARTED", label: "Comecou a assistir", occurredAt: input.startedAt });
  }

  if (input.lastWatchedEpisode) {
    events.push({
      type: "EPISODE_WATCHED",
      label: `Assistiu ${formatEpisodeCode(input.lastWatchedEpisode.seasonNumber, input.lastWatchedEpisode.number)}`,
      detail: input.lastWatchedEpisode.title,
      occurredAt: input.lastWatchedEpisode.watchedAt
    });
  }

  for (const season of input.completedSeasons) {
    events.push({ type: "SEASON_COMPLETED", label: `Concluiu a Temporada ${season.number}`, occurredAt: season.completedAt });
  }

  if (input.reviewedAt) {
    events.push({ type: "REVIEWED", label: "Avaliou a serie", occurredAt: input.reviewedAt });
  }

  if (input.addedToListAt) {
    events.push({ type: "ADDED_TO_LIST", label: "Adicionou a uma lista", occurredAt: input.addedToListAt });
  }

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
