import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stats/stat-tile";
import { InsightList } from "@/components/stats/insight-list";
import { BarList } from "@/components/ui/bar-list";
import { DonutChart, type DonutTone } from "@/components/ui/donut-chart";
import { ColumnChart } from "@/components/ui/column-chart";
import { Heatmap } from "@/components/ui/heatmap";
import { CalendarIcon, CompassIcon, FilmIcon, ListIcon, StarIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getUserStats } from "@/lib/analytics";
import { formatDate } from "@/lib/utils";

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await getUserStats(user.id);
  const { overview, watchTime, genres, timeline, streaks, insights } = stats;

  const hasAnyData = overview.episodesWatched > 0 || overview.seriesTracked > 0;

  const dayCounts = Object.fromEntries(timeline.perDay.map((bucket) => [bucket.key, bucket.count]));
  const recentMonths = timeline.perMonth.slice(-9).map((bucket) => ({ label: monthLabel(bucket.key), value: bucket.count }));

  const stateTones: Record<string, DonutTone> = {
    Concluidas: "success",
    Assistindo: "secondary",
    Pausadas: "warning",
    Abandonadas: "danger",
    "Quero assistir": "primary"
  };
  const stateSegments = Object.entries({
    Concluidas: overview.seriesCompleted,
    Assistindo: overview.seriesWatching,
    Pausadas: overview.seriesPaused,
    Abandonadas: overview.seriesDropped,
    "Quero assistir": overview.seriesPlanned
  })
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value, tone: stateTones[label] }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Analytics</p>
        <h1 className="section-title">Estatisticas</h1>
        <p className="section-copy">Um resumo do seu historico de series, calculado a partir do seu progresso real.</p>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Ainda sem estatisticas"
          copy="Marque episodios como assistidos ou adicione series ao seu acompanhamento para ver seus numeros aqui."
          action={
            <Link href="/series">
              <Button>Explorar catalogo</Button>
            </Link>
          }
        />
      ) : (
        <>
          {insights.length ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <StarIcon className="h-5 w-5 text-subtle" />
                Insights
              </h2>
              <InsightList insights={insights} />
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Resumo geral</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Series concluidas" value={overview.seriesCompleted} />
              <StatTile label="Assistindo" value={overview.seriesWatching} />
              <StatTile label="Pausadas" value={overview.seriesPaused} />
              <StatTile label="Abandonadas" value={overview.seriesDropped} />
              <StatTile label="Quero assistir" value={overview.seriesPlanned} />
              <StatTile label="Temporadas concluidas" value={overview.seasonsCompleted} />
              <StatTile label="Episodios assistidos" value={overview.episodesWatched} />
              <StatTile label="Episodios restantes" value={overview.episodesRemaining} hint="Nas series que voce acompanha" />
              <StatTile label="Conclusao media" value={`${overview.averageCompletionPercent}%`} />
              <StatTile label="Media de episodios/serie" value={overview.averageEpisodesPerSeries} />
              <StatTile label="Dias desde o cadastro" value={overview.daysSinceSignup} />
            </div>
            {stateSegments.length ? (
              <Card>
                <h3 className="text-sm font-semibold text-ink">Distribuicao por status</h3>
                <div className="mt-4">
                  <DonutChart segments={stateSegments} />
                </div>
              </Card>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <FilmIcon className="h-5 w-5 text-subtle" />
              Tempo assistido
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Horas assistidas" value={watchTime.hoursWatched} />
              <StatTile label="Dias equivalentes" value={watchTime.daysWatched} />
              <StatTile label="Media por episodio" value={watchTime.averageMinutesPerEpisode ? `${watchTime.averageMinutesPerEpisode} min` : "n/d"} />
              <StatTile label="Media por serie" value={watchTime.averageMinutesPerSeries ? `${watchTime.averageMinutesPerSeries} min` : "n/d"} />
            </div>
            {watchTime.episodesWithoutRuntime > 0 ? (
              <p className="text-xs text-subtle">
                {watchTime.episodesWithoutRuntime} episodio(s) assistido(s) sem duracao cadastrada nao entram nesse calculo.
              </p>
            ) : null}
          </section>

          {genres.ranking.length ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-ink">Generos</h2>
              <Card>
                <BarList items={genres.ranking.slice(0, 8).map((g) => ({ label: g.genre, value: g.episodeCount, percentage: g.percentage }))} valueSuffix=" ep." />
              </Card>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <CalendarIcon className="h-5 w-5 text-subtle" />
              Atividade
            </h2>
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Ultimos meses</h3>
                <div className="mt-3">
                  <ColumnChart data={recentMonths} />
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-ink">Ultimas semanas</h3>
                <div className="mt-3">
                  <Heatmap counts={dayCounts} />
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <ListIcon className="h-5 w-5 text-subtle" />
              Sequencias
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Sequencia atual" value={`${streaks.currentStreakDays} dia(s)`} />
              <StatTile label="Maior sequencia" value={`${streaks.longestStreakDays} dia(s)`} />
              <StatTile label="Dias ativos" value={streaks.activeDays} />
              <StatTile
                label="Primeiro episodio"
                value={streaks.firstWatchedAt ? formatDate(streaks.firstWatchedAt) : "n/d"}
              />
            </div>
            {streaks.lastWatchedAt ? (
              <p className="text-xs text-subtle">Ultimo episodio assistido em {formatDate(streaks.lastWatchedAt)}.</p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
