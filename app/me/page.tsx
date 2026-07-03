import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MeTabs } from "@/components/me/me-tabs";
import { CalendarIcon, CheckCircleIcon, FilmIcon } from "@/components/ui/icons";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { ActivityCard } from "@/components/feed/activity-card";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { getUpcomingEpisodesForUser } from "@/lib/calendar/queries";
import { getRecentActivityForUser } from "@/lib/social/activity";

export default async function MePage() {
  const user = await requireUser();
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId: user.id },
    include: { series: true },
    orderBy: { updatedAt: "desc" }
  });
  const recentEpisodes = await prisma.userEpisodeProgress.findMany({
    where: { userId: user.id, watched: true },
    include: {
      episode: {
        include: {
          season: {
            include: {
              series: true
            }
          }
        }
      }
    },
    orderBy: { watchedAt: "desc" },
    take: 5
  });

  const uniqueSeriesIds = [...new Set(statuses.map((item) => item.seriesId))];
  const progressList = await Promise.all(uniqueSeriesIds.map((seriesId) => calculateSeriesProgress(user.id, seriesId)));
  const watchedSeries = progressList.filter(Boolean);
  const upcomingEpisodes = await getUpcomingEpisodesForUser(user.id, 5);
  const recentActivity = await getRecentActivityForUser(user.id, 5);
  const averageProgress = watchedSeries.length
    ? Math.round(watchedSeries.reduce((sum, item) => sum + (item?.percentage ?? 0), 0) / watchedSeries.length)
    : 0;

  const summary = [
    ["Assistindo", statuses.filter((item) => item.state === "WATCHING").length],
    ["Concluidas", statuses.filter((item) => item.state === "COMPLETED").length],
    ["Pausadas", statuses.filter((item) => item.state === "PAUSED").length],
    ["Abandonadas", statuses.filter((item) => item.state === "DROPPED").length],
    ["Quero assistir", statuses.filter((item) => item.state === "WANT_TO_WATCH").length]
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Ola, {user.name.split(" ")[0]}</p>
        <h1 className="section-title">Minha area</h1>
        <p className="section-copy">Seus status reais, episodios assistidos e progresso salvo.</p>
      </div>
      <MeTabs active="/me" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-black text-ink">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Progresso medio das suas series</span>
          <span className="text-2xl font-black text-ink">{averageProgress}%</span>
        </div>
        <Progress value={averageProgress} label="Progresso medio" />
      </Card>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <CalendarIcon className="h-5 w-5 text-subtle" />
            Proximos episodios
          </h2>
          <Link href="/calendar" className="link-accent text-sm">
            Ver calendario
          </Link>
        </div>
        {upcomingEpisodes.length ? (
          <div className="space-y-3">
            {upcomingEpisodes.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum lancamento previsto" copy="Quando houver novos episodios das suas series, eles aparecem aqui." />
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <FilmIcon className="h-5 w-5 text-subtle" />
            Atividade recente
          </h2>
          <Link href="/feed" className="link-accent text-sm">
            Ver feed
          </Link>
        </div>
        {recentActivity.length ? (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma atividade ainda" copy="Suas acoes recentes (episodios assistidos, reviews, listas) aparecem aqui." />
        )}
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <CheckCircleIcon className="h-5 w-5 text-subtle" />
          Ultimos episodios assistidos
        </h2>
        {recentEpisodes.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentEpisodes.map((item) => (
              <Card key={item.id} padding="sm">
                <p className="font-semibold text-ink">{item.episode.season.series.title}</p>
                <p className="text-sm text-muted">
                  T{item.episode.season.number}E{item.episode.number} · {item.episode.title}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Nada assistido ainda" copy="Marque episodios para ver atividade e progresso aqui." />
        )}
      </section>
    </div>
  );
}
