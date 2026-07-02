import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { ActivityCard } from "@/components/feed/activity-card";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { getUpcomingEpisodesForUser } from "@/lib/calendar/queries";
import { getRecentActivityForUser } from "@/lib/social/activity";

const tabs = [
  { href: "/me", label: "Resumo" },
  { href: "/me/watching", label: "Assistindo" },
  { href: "/me/completed", label: "Concluidas" },
  { href: "/me/watchlist", label: "Watchlist" },
  { href: "/me/lists", label: "Listas" }
];

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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Minha area</h1>
        <p className="section-copy">{user.name}, aqui estao seus status reais, episodios assistidos e progresso salvo.</p>
      </div>
      <Tabs items={tabs} active="/me" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-sm text-slate-300">{label}</p>
            <p className="mt-2 text-3xl font-black text-ink">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <p className="text-sm text-slate-300">Progresso medio</p>
        <p className="mt-2 text-3xl font-black text-ink">{averageProgress}%</p>
      </Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">Proximos episodios</h2>
          <Link href="/calendar" className="text-sm font-semibold text-amber-200">
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
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">Atividade recente</h2>
          <Link href="/feed" className="text-sm font-semibold text-amber-200">
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
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Ultimos episodios assistidos</h2>
        {recentEpisodes.length ? (
          recentEpisodes.map((item) => (
            <Card key={item.id}>
              <p className="font-semibold text-ink">{item.episode.season.series.title}</p>
              <p className="text-sm text-slate-300">
                T{item.episode.season.number}E{item.episode.number} · {item.episode.title}
              </p>
            </Card>
          ))
        ) : (
          <EmptyState title="Nada assistido ainda" copy="Marque episodios para ver atividade e progresso aqui." />
        )}
      </div>
      <Link href="/me/watching" className="text-sm font-semibold text-amber-200">
        Ver assistindo
      </Link>
    </div>
  );
}
