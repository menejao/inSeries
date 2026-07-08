import { Card } from "@/components/ui/card";
import { CalendarIcon, CheckCircleIcon, ListIcon, PlayIcon, StarIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { SeriesTimelineEvent } from "@/lib/series-page/timeline";

const ICON_BY_TYPE: Record<SeriesTimelineEvent["type"], typeof PlayIcon> = {
  STARTED: PlayIcon,
  EPISODE_WATCHED: CheckCircleIcon,
  SEASON_COMPLETED: StarIcon,
  REVIEWED: StarIcon,
  ADDED_TO_LIST: ListIcon
};

/** Fase 10 (INSERIES-SERIES-PAGE-PREMIUM-01) — every event is pre-computed by `computeSeriesTimeline` (lib/series-page/timeline.ts, pure function over already-fetched data). */
export function SeriesTimeline({ events }: { events: SeriesTimelineEvent[] }) {
  if (!events.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <CalendarIcon className="h-5 w-5 text-subtle" />
        Sua jornada com esta serie
      </h2>
      <Card className="space-y-4">
        <ol className="space-y-4">
          {events.map((event, index) => {
            const Icon = ICON_BY_TYPE[event.type];
            return (
              <li key={`${event.type}-${event.occurredAt.getTime()}-${index}`} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary-text">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="font-medium text-ink">{event.label}</p>
                  {event.detail ? <p className="text-sm text-muted">{event.detail}</p> : null}
                  <p className="text-xs text-subtle">{formatRelativeDate(event.occurredAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}
