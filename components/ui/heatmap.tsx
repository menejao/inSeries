import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function intensityClass(count: number, max: number) {
  if (count === 0) return "bg-surface-strong";
  const ratio = count / max;
  if (ratio > 0.75) return "bg-primary";
  if (ratio > 0.5) return "bg-primary/70";
  if (ratio > 0.25) return "bg-primary/45";
  return "bg-primary/25";
}

/**
 * GitHub-contributions-style activity calendar. `counts` maps a UTC day
 * key ("YYYY-MM-DD") to an episode-watched count for that day; any day not
 * present is treated as zero. Purely presentational — no data fetching.
 *
 * INSERIES-STATISTICS-ENGINE-01 — `onDayClick` (only wired for days with count > 0) lets a
 * consumer open a day-detail view without this component knowing what that view looks like.
 */
export function Heatmap({
  counts,
  weeks = 18,
  onDayClick
}: {
  counts: Record<string, number>;
  weeks?: number;
  onDayClick?: (dayKey: string) => void;
}) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const totalDays = weeks * 7;

  const days: { key: string; count: number }[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(todayUtc);
    date.setUTCDate(date.getUTCDate() - i);
    const key = toDayKey(date);
    days.push({ key, count: counts[key] ?? 0 });
  }

  const max = Math.max(...days.map((day) => day.count), 1);
  const columns: { key: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1 text-[9px] text-subtle">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index} className="flex h-3 w-3 items-center justify-center leading-none">
              {index % 2 === 1 ? label : ""}
            </span>
          ))}
        </div>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-1">
            {column.map((day) => (
              <button
                key={day.key}
                type="button"
                title={`${day.key}: ${day.count} episodio(s)`}
                disabled={!onDayClick || day.count === 0}
                onClick={() => onDayClick?.(day.key)}
                className={cn(
                  "h-3 w-3 rounded-sm",
                  intensityClass(day.count, max),
                  onDayClick && day.count > 0 && "cursor-pointer transition hover:ring-2 hover:ring-primary/60"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
