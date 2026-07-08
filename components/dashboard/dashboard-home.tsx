import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { LevelProgressCard } from "@/components/achievements/level-progress-card";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import { GreetingSection } from "@/components/dashboard/greeting-section";
import { DashboardPosterRow } from "@/components/dashboard/dashboard-poster-row";
import { RecommendationsSection } from "@/components/dashboard/recommendations-section";
import { WatchNextSection } from "@/components/dashboard/watch-next-section";
import { StatsSection } from "@/components/dashboard/stats-section";
import { ActivitySection } from "@/components/dashboard/activity-section";
import { DiscoverMoreSection } from "@/components/dashboard/discover-more-section";
import { MyListSection } from "@/components/my-list/my-list-section";
import { BellIcon, CalendarIcon, SparklesIcon, TrophyIcon } from "@/components/ui/icons";
import { getWatchNextForUser } from "@/lib/watch-next";
import { getUpcomingEpisodesForUser } from "@/lib/calendar/queries";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { getUserStats } from "@/lib/analytics";
import { getUserAchievementsOverview } from "@/lib/gamification";
import { listAvailableRecaps } from "@/lib/recap";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { listNotifications, countUnreadNotifications } from "@/lib/notifications/service";
import { listBombandoAgora, listLancamentos } from "@/lib/catalog/smart-lists";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import { getMyListSummaryForUser } from "@/lib/my-list";
import { formatRelativeDate } from "@/lib/utils";
import type { User } from "@prisma/client";

/**
 * INSERIES-DASHBOARD-PREMIUM-01 — the Dashboard as the platform's real Home, in the
 * mandated order: Saudacao -> Continuar assistindo -> Bombando Agora -> Lancamentos ->
 * Recomendado para voce -> Watch Next -> Minha Lista -> Estatisticas -> Atividade recente
 * -> Descobrir mais. Every section reuses the exact service already backing that module's
 * dedicated page — no new calculation lives in this file, only composition.
 *
 * Calendario/Conquistas/Recap/Notificacoes are not among the ticket's 10 mandated
 * sections, but removing them would cut existing functionality nothing asked to remove —
 * kept as a secondary grid below the 10 main sections (see README's Fase 1 audit).
 */
export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt"> }) {
  const currentYear = new Date().getUTCFullYear();

  const [
    watchNext,
    upcoming,
    recommendations,
    stats,
    achievements,
    recapAvailability,
    activity,
    notifications,
    unreadCount,
    bombandoAgora,
    lancamentos,
    continueWatching,
    myList
  ] = await Promise.all([
    getWatchNextForUser(user.id, { limit: 4 }),
    getUpcomingEpisodesForUser(user.id, 3),
    getRecommendationsForUser(user.id, { limit: 8 }),
    getUserStats(user.id),
    getUserAchievementsOverview(user.id),
    listAvailableRecaps(user.id),
    getRecentActivityForUser(user.id, 5),
    listNotifications(user.id, 3),
    countUnreadNotifications(user.id),
    // Fase 9 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — alimentada exclusivamente pelo
    // Discovery Engine (discoveryScore), nunca por popularidade bruta diretamente.
    listBombandoAgora(8),
    // Fase 2 (INSERIES-DASHBOARD-PREMIUM-01) — reaproveita a Smart List ja existente
    // (INSERIES-TRENDING-DISCOVERY-ENGINE-01), sem nenhuma nova regra de "recencia".
    listLancamentos(8),
    // Fase 2/9 (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) — roda ao lado de todo o resto do
    // Dashboard no mesmo Promise.all, nunca depois (sem waterfall sequencial).
    getContinueWatchingForUser(user.id, { limit: 10 }),
    // Fase 5/9 (INSERIES-DASHBOARD-PREMIUM-01) — idem: mesmo Promise.all, sem waterfall.
    getMyListSummaryForUser(user.id)
  ]);

  const currentYearRecap = recapAvailability.enabled ? recapAvailability.availability.years.find((y) => y.year === currentYear) : undefined;
  const latestMonthRecap = recapAvailability.enabled ? recapAvailability.availability.months[0] : undefined;

  return (
    <div className="space-y-8">
      {/* 1. Saudacao personalizada */}
      <GreetingSection name={user.name} lastLoginAt={user.lastLoginAt} stats={stats} />

      {/* 2. Continuar assistindo */}
      <ContinueWatchingSection continueWatching={continueWatching} />

      {/* 3. Bombando Agora */}
      <DashboardPosterRow
        title="🔥 Bombando Agora"
        href="/series?sort=discovery"
        items={bombandoAgora}
        variant="rating"
        emptyText="O Discovery Engine ainda nao rankeou series suficientes. Rode npm run discovery:run."
      />

      {/* 4. Lancamentos */}
      <DashboardPosterRow
        title="🆕 Lancamentos"
        href="/series?sort=latest"
        items={lancamentos}
        variant="new"
        emptyText="Nenhum lancamento recente rankeado pelo Discovery Engine ainda."
      />

      {/* 5. Recomendado para voce */}
      <RecommendationsSection result={recommendations} />

      {/* 6. Watch Next */}
      <WatchNextSection watchNext={watchNext} />

      {/* 7. Minha Lista */}
      <MyListSection summary={myList} />

      {/* 8. Suas Estatisticas */}
      <StatsSection stats={stats} />

      {/* 9. Atividade recente */}
      <ActivitySection activity={activity} />

      {/* 10. Descobrir mais */}
      <DiscoverMoreSection />

      {/* Secundario — nao faz parte da ordem mandatoria, mantido para nao remover funcionalidade existente */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
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
  icon: typeof CalendarIcon;
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

function EmptyPlaceholder({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{text}</p>;
}
