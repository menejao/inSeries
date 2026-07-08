import { CalendarIcon, ChartIcon, CheckCircleIcon, FlameIcon, PlayIcon, TvIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { UserStats } from "@/lib/analytics";

/**
 * Fase 3 (INSERIES-MY-LISTS-PREMIUM-01) — cabecalho premium, 6 numeros, todos vindos de
 * `getUserStats` (lib/analytics) sem nenhuma query propria: Total de series
 * (`overview.seriesTracked`), Em andamento (`overview.seriesWatching`), Concluidas
 * (`overview.seriesCompleted`), Tempo estimado assistido (`watchTime.hoursWatched`), Ultima
 * atividade (`streaks.lastWatchedAt`) e Sequencia atual de dias (`streaks.currentStreakDays`).
 */
export function MyListHeader({ stats }: { stats: UserStats }) {
  const tiles = [
    { icon: TvIcon, label: "Total de series", value: stats.overview.seriesTracked },
    { icon: PlayIcon, label: "Em andamento", value: stats.overview.seriesWatching },
    { icon: CheckCircleIcon, label: "Concluidas", value: stats.overview.seriesCompleted },
    { icon: ChartIcon, label: "Tempo assistido", value: `${stats.watchTime.hoursWatched}h` },
    {
      icon: CalendarIcon,
      label: "Ultima atividade",
      value: stats.streaks.lastWatchedAt ? formatRelativeDate(stats.streaks.lastWatchedAt) : "—"
    },
    { icon: FlameIcon, label: "Sequencia atual", value: `${stats.streaks.currentStreakDays}d` }
  ];

  return (
    <section className="rounded-4xl border border-border bg-surface/70 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Minha Lista</h1>
        <p className="section-copy">O centro de organizacao pessoal das suas series.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="space-y-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <tile.icon className="h-4.5 w-4.5" />
            </span>
            <p className="truncate text-xl font-black text-ink sm:text-2xl">{tile.value}</p>
            <p className="text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
