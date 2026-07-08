import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { BookIcon, ChartIcon, CheckCircleIcon, FilmIcon, FlameIcon, MonitorIcon, TvIcon } from "@/components/ui/icons";
import type { UserStats } from "@/lib/analytics";

/**
 * Fase 6 (INSERIES-DASHBOARD-PREMIUM-01) — "sem aparencia administrativa": icon + big
 * number + label per stat (never a plain bordered number tile like the old dashboard
 * card), reusing `getUserStats` (lib/analytics) end to end — no number computed here.
 */
export function StatsSection({ stats }: { stats: UserStats }) {
  const hasAnyStats = stats.overview.episodesWatched > 0;

  const tiles = [
    { icon: CheckCircleIcon, label: "Episodios assistidos", value: stats.overview.episodesWatched },
    { icon: TvIcon, label: "Series concluidas", value: stats.overview.seriesCompleted },
    { icon: FilmIcon, label: "Temporadas concluidas", value: stats.overview.seasonsCompleted },
    { icon: ChartIcon, label: "Horas assistidas", value: stats.watchTime.hoursWatched },
    { icon: FlameIcon, label: "Sequencia atual", value: `${stats.streaks.currentStreakDays}d` },
    { icon: BookIcon, label: "Genero favorito", value: stats.genres.topGenre?.genre ?? "—" },
    { icon: MonitorIcon, label: "Streaming predominante", value: stats.providers.topProvider?.provider ?? "—" }
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">Suas Estatisticas</h2>
        <Link href="/me/stats" className="link-accent text-sm">
          Ver tudo
        </Link>
      </div>
      {hasAnyStats ? (
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
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Marque episodios assistidos para ver suas estatisticas aqui.
        </p>
      )}
    </section>
  );
}
