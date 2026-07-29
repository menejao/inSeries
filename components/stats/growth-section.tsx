import { Card } from "@/components/ui/card";
import type { GrowthMetric } from "@/lib/stats/types";

function GrowthTile({ label, metric, suffix = "" }: { label: string; metric: GrowthMetric; suffix?: string }) {
  const isPositive = (metric.deltaPercent ?? 0) >= 0;
  return (
    <Card padding="sm">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {metric.current}
        {suffix}
      </p>
      {metric.deltaPercent !== null ? (
        <p className={`mt-1 text-xs font-medium ${isPositive ? "text-success-text" : "text-danger-text"}`}>
          {isPositive ? "+" : ""}
          {metric.deltaPercent}% vs. mes anterior
        </p>
      ) : (
        <p className="mt-1 text-xs text-subtle">Sem dados do mes anterior</p>
      )}
    </Card>
  );
}

/** INSERIES-STATISTICS-ENGINE-01 — "graficos de crescimento... mostrar crescimento percentual." */
export function GrowthSection({ episodes, hours, seriesCompleted }: { episodes: GrowthMetric; hours: GrowthMetric; seriesCompleted: GrowthMetric }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <GrowthTile label="Episodios este mes" metric={episodes} />
      <GrowthTile label="Horas este mes" metric={hours} suffix="h" />
      <GrowthTile label="Series concluidas este mes" metric={seriesCompleted} />
    </div>
  );
}
