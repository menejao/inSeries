import Link from "next/link";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatEpisodeCode } from "@/lib/utils";
import { formatShortDate } from "@/lib/calendar/dates";
import { getGlobalCalendarEpisodes, type GlobalCalendarRange } from "@/lib/calendar/queries";

const ranges: Array<{ value: GlobalCalendarRange; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" }
];

function buildRangeHref(range: GlobalCalendarRange, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  search.set("view", "global");
  search.set("range", range);
  if (params.genre) search.set("genre", params.genre);
  if (params.language) search.set("language", params.language);
  if (params.onlyMine) search.set("onlyMine", params.onlyMine);
  if (params.onlyUnwatched) search.set("onlyUnwatched", params.onlyUnwatched);
  if (params.onlyUnaired) search.set("onlyUnaired", params.onlyUnaired);
  return `/calendar?${search.toString()}`;
}

export async function GlobalCalendar({
  range,
  genre,
  language,
  onlyMine,
  onlyUnwatched,
  onlyUnaired,
  userId,
  authenticated
}: {
  range: GlobalCalendarRange;
  genre?: string;
  language?: string;
  onlyMine?: boolean;
  onlyUnwatched?: boolean;
  onlyUnaired?: boolean;
  userId?: string | null;
  authenticated: boolean;
}) {
  const episodes = await getGlobalCalendarEpisodes({
    range,
    genre,
    language,
    onlyMine,
    onlyUnwatched,
    onlyUnaired,
    userId
  });

  const rawParams = {
    genre,
    language,
    onlyMine: onlyMine ? "1" : undefined,
    onlyUnwatched: onlyUnwatched ? "1" : undefined,
    onlyUnaired: onlyUnaired ? "1" : undefined
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ranges.map((item) => (
          <Link
            key={item.value}
            href={buildRangeHref(item.value, rawParams)}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              range === item.value ? "bg-ember text-night" : "bg-slate-900/60 text-slate-300"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <CalendarFilters
        range={range}
        genre={genre}
        language={language}
        onlyMine={onlyMine}
        onlyUnwatched={onlyUnwatched}
        onlyUnaired={onlyUnaired}
        authenticated={authenticated}
      />

      <CalendarSection
        title="Lancamentos"
        items={episodes}
        emptyTitle="Nenhum lancamento no periodo"
        emptyCopy="Ajuste os filtros ou escolha outro periodo para ver lancamentos do catalogo."
        renderItem={(episode) => (
          <Card key={episode.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/series/${episode.series.slug}`} className="font-semibold text-ink">
                  {episode.series.title}
                </Link>
                <Badge>{episode.series.language ?? "n/d"}</Badge>
              </div>
              <p className="text-sm text-slate-300">
                {formatEpisodeCode(episode.seasonNumber, episode.number)} · {episode.title}
              </p>
            </div>
            <p className="text-xs text-slate-400">{formatShortDate(episode.airedAt)}</p>
          </Card>
        )}
      />
    </div>
  );
}
