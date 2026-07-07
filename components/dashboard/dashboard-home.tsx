import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WatchNextCard } from "@/components/watch-next/watch-next-card";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { LevelProgressCard } from "@/components/achievements/level-progress-card";
import { ActivityCard } from "@/components/feed/activity-card";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  FilmIcon,
  FlameIcon,
  PlayIcon,
  SparklesIcon,
  TrophyIcon
} from "@/components/ui/icons";
import { getWatchNextForUser } from "@/lib/watch-next";
import { getUpcomingEpisodesForUser } from "@/lib/calendar/queries";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { getUserStats } from "@/lib/analytics";
import { getUserAchievementsOverview } from "@/lib/gamification";
import { listAvailableRecaps } from "@/lib/recap";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { listNotifications, countUnreadNotifications } from "@/lib/notifications/service";
import { listBombandoAgora } from "@/lib/catalog/smart-lists";
import { formatRelativeDate } from "@/lib/utils";
import type { User } from "@prisma/client";

/**
 * Fase 8 — the authenticated Home. Every section reuses the exact service
 * already backing that module's dedicated page (no new calculation lives
 * here) — this component only composes and links out to "Ver tudo".
 */
export async function DashboardHome({ user }: { user: Pick<User, "id" | "name"> }) {
  const currentYear = new Date().getUTCFullYear();

  const [watchNext, upcoming, recommendations, stats, achievements, recapAvailability, activity, notifications, unreadCount, bombandoAgora] =
    await Promise.all([
      getWatchNextForUser(user.id, { limit: 4 }),
      getUpcomingEpisodesForUser(user.id, 3),
      getRecommendationsForUser(user.id, { limit: 6 }),
      getUserStats(user.id),
      getUserAchievementsOverview(user.id),
      listAvailableRecaps(user.id),
      getRecentActivityForUser(user.id, 3),
      listNotifications(user.id, 3),
      countUnreadNotifications(user.id),
      // Fase 9 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — alimentada exclusivamente pelo
      // Discovery Engine (discoveryScore), nunca por popularidade bruta diretamente.
      listBombandoAgora(6)
    ]);

  const currentYearRecap = recapAvailability.enabled ? recapAvailability.availability.years.find((y) => y.year === currentYear) : undefined;
  const latestMonthRecap = recapAvailability.enabled ? recapAvailability.availability.months[0] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Ola, {user.name.split(" ")[0]}</p>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-copy">Seu hub de series — tudo que importa agora, num so lugar.</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DashboardCard icon={PlayIcon} title="Assistir a seguir" href="/watch-next">
          {watchNext.items.length ? (
            <div className="space-y-3">
              {watchNext.items.slice(0, 2).map((item) => (
                <WatchNextCard key={item.episode.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text={watchNext.hasTrackedSeries ? "Voce esta em dia com suas series." : "Voce ainda nao segue nenhuma serie."} />
          )}
        </DashboardCard>

        <DashboardCard icon={FlameIcon} title="🔥 Bombando Agora" href="/series?sort=discovery">
          {bombandoAgora.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {bombandoAgora.map((series) => (
                <SeriesPosterCard key={series.id} series={series} variant="rating" />
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text="O Discovery Engine ainda nao rankeou series suficientes. Rode npm run discovery:run." />
          )}
        </DashboardCard>

        <DashboardCard icon={CalendarIcon} title="Proximos lancamentos" href="/calendar">
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((episode) => (
                <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text="Nenhum lancamento previsto para suas series." />
          )}
        </DashboardCard>

        <DashboardCard icon={CompassIcon} title="Recomendacoes" href="/recommendations">
          {recommendations.enabled && recommendations.items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {recommendations.items.slice(0, 3).map((recommendation) => (
                <RecommendationCard key={recommendation.series.id} recommendation={recommendation} />
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text="Assista mais episodios para receber recomendacoes personalizadas." />
          )}
        </DashboardCard>

        <DashboardCard icon={ChartIcon} title="Estatisticas" href="/me/stats">
          {stats.overview.episodesWatched > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Episodios" value={stats.overview.episodesWatched} />
              <StatTile label="Horas" value={stats.watchTime.hoursWatched} />
              <StatTile label="Genero top" value={stats.genres.topGenre?.genre ?? "—"} />
            </div>
          ) : (
            <EmptyPlaceholder text="Marque episodios assistidos para ver suas estatisticas aqui." />
          )}
        </DashboardCard>

        <DashboardCard icon={TrophyIcon} title="Conquistas" href="/me/achievements">
          {achievements.enabled ? (
            <LevelProgressCard level={achievements.overview.level} points={achievements.overview.points} />
          ) : (
            <EmptyPlaceholder text="Gamificacao desativada no momento." />
          )}
        </DashboardCard>

        <DashboardCard icon={SparklesIcon} title="Recap" href="/me/recap">
          {currentYearRecap || latestMonthRecap ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {currentYearRecap ? (
                <Link href={`/me/recap/${currentYearRecap.year}`}>
                  <Card interactive padding="sm">
                    <p className="eyebrow">Recap anual</p>
                    <p className="mt-1 font-semibold capitalize text-ink">{currentYearRecap.label}</p>
                    <p className="text-sm text-muted">{currentYearRecap.episodesWatched} episodio(s)</p>
                  </Card>
                </Link>
              ) : null}
              {latestMonthRecap ? (
                <Link href={`/me/recap/${latestMonthRecap.year}/${latestMonthRecap.month}`}>
                  <Card interactive padding="sm">
                    <p className="eyebrow">Ultimo mes</p>
                    <p className="mt-1 font-semibold capitalize text-ink">{latestMonthRecap.label}</p>
                    <p className="text-sm text-muted">{latestMonthRecap.episodesWatched} episodio(s)</p>
                  </Card>
                </Link>
              ) : null}
            </div>
          ) : (
            <EmptyPlaceholder text="Assista episodios para gerar seu primeiro recap." />
          )}
        </DashboardCard>

        <DashboardCard icon={FilmIcon} title="Feed" href="/feed">
          {activity.length ? (
            <div className="space-y-3">
              {activity.map((item) => (
                <ActivityCard key={item.id} activity={item} />
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text="Siga outros usuarios para ver a atividade deles aqui." />
          )}
        </DashboardCard>

        <DashboardCard icon={BellIcon} title="Notificacoes" href="/notifications" badge={unreadCount > 0 ? unreadCount : undefined}>
          {notifications.length ? (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-border bg-surface-strong/40 p-3">
                  <p className="text-sm font-medium text-ink">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{notification.body}</p>
                  <p className="mt-1 text-xs text-subtle">{formatRelativeDate(notification.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPlaceholder text="Nenhuma notificacao ainda." />
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

function DashboardCard({
  icon: Icon,
  title,
  href,
  badge,
  children
}: {
  icon: typeof PlayIcon;
  title: string;
  href: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-in-up space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
            <Icon className="h-4.5 w-4.5" />
          </span>
          {title}
          {badge ? <Badge variant="primary">{badge}</Badge> : null}
        </h2>
        <Link href={href} className="link-accent shrink-0 text-sm">
          Ver tudo
        </Link>
      </div>
      {children}
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-strong/50 p-3 text-center">
      <p className="truncate text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function EmptyPlaceholder({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{text}</p>;
}
