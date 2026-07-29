import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stats/stat-tile";
import { InsightList } from "@/components/stats/insight-list";
import { CuriosityCarousel } from "@/components/stats/curiosity-carousel";
import { StatsHero } from "@/components/stats/stats-hero";
import { FunRecordsGrid } from "@/components/stats/fun-records-grid";
import { GrowthSection } from "@/components/stats/growth-section";
import { RankingsSection } from "@/components/stats/rankings-section";
import { MilestonesTimeline } from "@/components/stats/milestones-timeline";
import { GoalsSection } from "@/components/stats/goals-section";
import { CommunityComparison } from "@/components/stats/community-comparison";
import { HeatmapSection } from "@/components/stats/heatmap-section";
import { BarList } from "@/components/ui/bar-list";
import { DonutChart, type DonutTone } from "@/components/ui/donut-chart";
import { ColumnChart } from "@/components/ui/column-chart";
import { CalendarIcon, CompassIcon, FilmIcon, SparklesIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getStatsPageData } from "@/lib/stats";
import { getUserAchievementsOverview } from "@/lib/gamification";
import { formatDate } from "@/lib/utils";

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function StatsPage() {
  const user = await requireUser();
  const [stats, achievementsOutcome] = await Promise.all([getStatsPageData(user.id), getUserAchievementsOverview(user.id)]);
  const { overview, watchTime, genres, timeline, streaks, insights } = stats;

  const level = achievementsOutcome.enabled ? achievementsOutcome.overview.level.level : 1;
  const points = achievementsOutcome.enabled ? achievementsOutcome.overview.points : 0;

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
    <div className="space-y-8">
      {!stats.hasData ? (
        <>
          <div>
            <p className="eyebrow">Analytics</p>
            <h1 className="section-title">Estatisticas</h1>
            <p className="section-copy">Um resumo do seu historico de series, calculado a partir do seu progresso real.</p>
          </div>
          <EmptyState
            icon={<CompassIcon className="h-6 w-6" />}
            title="Ainda sem estatisticas"
            copy="Marque episodios como assistidos ou adicione series ao seu acompanhamento para ver seu perfil de espectador aqui."
            action={
              <Link href="/series">
                <Button>Explorar catalogo</Button>
              </Link>
            }
          />
        </>
      ) : (
        <>
          <StatsHero
            persona={stats.persona}
            level={level}
            points={points}
            hoursWatched={watchTime.hoursWatched}
            episodesWatched={overview.episodesWatched}
          />

          <CuriosityCarousel curiosities={stats.curiosities} />

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
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <TrophyIcon className="h-5 w-5 text-subtle" />
              Recordes
            </h2>
            <FunRecordsGrid records={stats.records} />
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Evolucao</h2>
            <GrowthSection episodes={stats.growth.episodes} hours={stats.growth.hours} seriesCompleted={stats.growth.seriesCompleted} />
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Objetivos</h2>
            <GoalsSection goals={stats.goals} />
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Resumo geral</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Horas assistidas" value={watchTime.hoursWatched} />
              <StatTile label="Dias equivalentes" value={watchTime.daysWatched} />
              <StatTile label="Semanas equivalentes" value={Math.round((watchTime.daysWatched / 7) * 10) / 10} />
              <StatTile label="Meses equivalentes" value={Math.round((watchTime.daysWatched / 30) * 10) / 10} />
              <StatTile label="Media por episodio" value={watchTime.averageMinutesPerEpisode ? `${watchTime.averageMinutesPerEpisode} min` : "n/d"} />
              <StatTile label="Media por serie" value={watchTime.averageMinutesPerSeries ? `${watchTime.averageMinutesPerSeries} min` : "n/d"} />
              <StatTile
                label="Media diaria (dias ativos)"
                value={streaks.activeDays > 0 ? `${Math.round((watchTime.minutesWatched / streaks.activeDays) * 10) / 10} min` : "n/d"}
              />
              <StatTile
                label="Media semanal"
                value={timeline.perWeek.length > 0 ? `${Math.round(overview.episodesWatched / timeline.perWeek.length)} ep.` : "n/d"}
              />
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
            <h2 className="text-xl font-semibold text-ink">Rankings pessoais</h2>
            <RankingsSection rankings={stats.rankings} />
          </section>

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
                <h3 className="text-sm font-semibold text-ink">Ultimas semanas — clique num dia pra ver os episodios</h3>
                <div className="mt-3">
                  <HeatmapSection counts={dayCounts} dayDetails={stats.dayDetails} />
                </div>
              </div>
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Sua jornada</h2>
            <Card>
              <MilestonesTimeline milestones={stats.milestones} />
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <SparklesIcon className="h-5 w-5 text-subtle" />
              Sequencias
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Sequencia atual" value={`${streaks.currentStreakDays} dia(s)`} />
              <StatTile label="Maior sequencia" value={`${streaks.longestStreakDays} dia(s)`} />
              <StatTile label="Dias ativos" value={streaks.activeDays} />
              <StatTile label="Primeiro episodio" value={streaks.firstWatchedAt ? formatDate(streaks.firstWatchedAt) : "n/d"} />
            </div>
            {streaks.lastWatchedAt ? (
              <p className="text-xs text-subtle">Ultimo episodio assistido em {formatDate(streaks.lastWatchedAt)}.</p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Voce comparado a comunidade</h2>
            <CommunityComparison data={stats.community} />
          </section>

          <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Quer ver o resumo completo do ano?</h3>
              <p className="text-xs text-subtle">Seu Wrapped anual reune tudo o que voce assistiu em telas sequenciais, prontas pra compartilhar.</p>
            </div>
            <Link href="/me/recap">
              <Button variant="secondary">Ver meu Wrapped</Button>
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}
