import { cn } from "@/lib/utils";

export type ColumnChartPoint = { label: string; value: number };

/** Simple vertical bar chart (SVG, no dependency) — e.g. episodes watched per month. */
export function ColumnChart({ data, height = 120, className }: { data: ColumnChartPoint[]; height?: number; className?: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((point) => point.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-32 w-full overflow-visible" role="img" aria-label="Grafico de barras">
        {data.map((point, index) => {
          const barHeight = (point.value / max) * (height - 4);
          return (
            <rect
              key={point.label}
              x={index * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
              rx={1.5}
              className="fill-primary/80"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex text-[10px] text-subtle">
        {data.map((point) => (
          <span key={point.label} className="flex-1 truncate text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
