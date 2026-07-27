import { AlertCircleIcon, CalendarIcon, SparklesIcon, TvIcon } from "@/components/ui/icons";

/**
 * Fase 4 (INSERIES-CALENDAR-EXPERIENCE-01) — "pequenos cards de resumo... servem apenas
 * como visao geral, nao substituem a pagina Estatisticas". 4 numeros, sem grafico, sem
 * calculo pesado (os 4 valores ja vem prontos das secoes que `PersonalCalendar` ja buscou -
 * nenhuma query nova so pra este resumo).
 */
export function CalendarSummary({
  today,
  thisWeek,
  overdue,
  futureSeasons
}: {
  today: number;
  thisWeek: number;
  overdue: number;
  futureSeasons: number;
}) {
  const tiles = [
    { icon: CalendarIcon, label: "Hoje", value: today },
    { icon: SparklesIcon, label: "Esta semana", value: thisWeek },
    { icon: AlertCircleIcon, label: "Atrasados", value: overdue },
    { icon: TvIcon, label: "Proximas temporadas", value: futureSeasons }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-strong/40 px-3 py-2.5">
          <tile.icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight text-ink">{tile.value}</p>
            <p className="truncate text-xs text-muted">{tile.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
