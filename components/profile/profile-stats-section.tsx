import { FixedGrid } from "@/components/ui/fixed-grid";
import { BookIcon, ChartIcon, CheckCircleIcon, ClockIcon, FilmIcon, FlameIcon, MonitorIcon, SparklesIcon, TvIcon } from "@/components/ui/icons";
import { estimateRemainingHours } from "@/lib/my-list/stats";
import { computeAverageScore } from "@/lib/profile-page/highlights";
import type { UserStats } from "@/lib/analytics";
import type { MyListItem } from "@/lib/my-list/types";

/**
 * Fase 3 (INSERIES-PROFILE-PREMIUM-01) — mesmo padrao de tile (icone + numero grande +
 * rotulo) ja estabelecido em `components/dashboard/stats-section.tsx` e
 * `components/my-list/my-list-stats-section.tsx`. Series/temporadas/episodios/tempo
 * assistido/tempo restante/media de conclusao vem de `getUserStats` (nenhuma query nova);
 * Discovery/Quality medio sao a unica coisa que `UserStats` nao tem — calculados em memoria
 * (`computeAverageScore`) sobre o mesmo array de series ja rastreadas que a Fase 6
 * (Destaques) tambem usa.
 */
export function ProfileStatsSection({ stats, highlightItems }: { stats: UserStats; highlightItems: MyListItem[] }) {
  const discoveryAvg = computeAverageScore(highlightItems, "discoveryScore");
  const qualityAvg = computeAverageScore(highlightItems, "qualityScore");

  const tiles = [
    { icon: TvIcon, label: "Series", value: stats.overview.seriesTracked },
    { icon: FilmIcon, label: "Temporadas concluidas", value: stats.overview.seasonsCompleted },
    { icon: CheckCircleIcon, label: "Episodios", value: stats.overview.episodesWatched },
    { icon: ChartIcon, label: "Tempo assistido", value: `${stats.watchTime.hoursWatched}h` },
    { icon: ClockIcon, label: "Tempo restante", value: `${estimateRemainingHours(stats)}h` },
    { icon: FlameIcon, label: "Media de conclusao", value: `${Math.round(stats.overview.averageCompletionPercent)}%` },
    ...(discoveryAvg !== null ? [{ icon: SparklesIcon, label: "Discovery medio", value: discoveryAvg }] : []),
    ...(qualityAvg !== null ? [{ icon: SparklesIcon, label: "Quality medio", value: qualityAvg }] : []),
    { icon: MonitorIcon, label: "Provider favorito", value: stats.providers.topProvider?.provider ?? "—" },
    { icon: BookIcon, label: "Genero favorito", value: stats.genres.topGenre?.genre ?? "—" }
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Estatisticas</h2>
        <p className="section-copy">Um retrato completo da jornada nas series.</p>
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
