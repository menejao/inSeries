import { CheckCircleIcon, ClockIcon, TvIcon } from "@/components/ui/icons";
import type { DashboardWeeklySummary } from "@/lib/dashboard/weekly-summary";

/**
 * Fase 9 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "o Dashboard pode possuir apenas
 * um pequeno resumo semanal... nunca graficos completos, nunca dashboards analiticos".
 * 3 numeros, 1 linha, sem grid/tile pesado - estatisticas completas continuam exclusivas da
 * pagina Estatisticas.
 */
export function WeeklySummary({ summary }: { summary: DashboardWeeklySummary }) {
  const items = [
    { icon: CheckCircleIcon, label: "episodios assistidos esta semana", value: summary.episodesWatched },
    { icon: ClockIcon, label: "horas assistidas esta semana", value: `${summary.hoursWatched}h` },
    { icon: TvIcon, label: "series acompanhadas", value: summary.seriesTracked }
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-xs text-subtle">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="font-medium text-muted">{item.value}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}
