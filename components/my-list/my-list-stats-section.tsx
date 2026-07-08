import { FixedGrid } from "@/components/ui/fixed-grid";
import { BookIcon, ChartIcon, CheckCircleIcon, ClockIcon, FilmIcon, MonitorIcon, TvIcon } from "@/components/ui/icons";
import { estimateRemainingHours, predominantStatusLabel } from "@/lib/my-list/stats";
import type { UserStats } from "@/lib/analytics";

/**
 * Fase 9 (INSERIES-MY-LISTS-PREMIUM-01) — mesmo padrao visual de tile (icone + numero
 * grande + rotulo) que `components/dashboard/stats-section.tsx` ja estabeleceu, reaproveitando
 * o mesmo `getUserStats` (lib/analytics) — nenhuma query nova, apenas dois numeros derivados
 * em memoria (`lib/my-list/stats.ts`: tempo restante estimado e status predominante).
 */
export function MyListStatsSection({ stats }: { stats: UserStats }) {
  const tiles = [
    { icon: TvIcon, label: "Series", value: stats.overview.seriesTracked },
    { icon: FilmIcon, label: "Temporadas concluidas", value: stats.overview.seasonsCompleted },
    { icon: CheckCircleIcon, label: "Episodios assistidos", value: stats.overview.episodesWatched },
    { icon: ChartIcon, label: "Tempo assistido", value: `${stats.watchTime.hoursWatched}h` },
    { icon: ClockIcon, label: "Tempo restante estimado", value: `${estimateRemainingHours(stats)}h` },
    { icon: MonitorIcon, label: "Provider predominante", value: stats.providers.topProvider?.provider ?? "—" },
    { icon: BookIcon, label: "Genero favorito", value: stats.genres.topGenre?.genre ?? "—" },
    { icon: TvIcon, label: "Status predominante", value: predominantStatusLabel(stats) }
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Suas estatisticas</h2>
        <p className="section-copy">Um retrato completo de como voce acompanha suas series.</p>
      </div>
      <FixedGrid mobile={2} tablet={4} desktop={4}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-2 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <tile.icon className="h-4.5 w-4.5" />
            </span>
            <p className="truncate text-2xl font-black text-ink">{tile.value}</p>
            <p className="text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </FixedGrid>
    </section>
  );
}
