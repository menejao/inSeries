import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import { GreetingSection } from "@/components/dashboard/greeting-section";
import { RecommendationsSection } from "@/components/dashboard/recommendations-section";
import { ActivitySection } from "@/components/dashboard/activity-section";
import { QuickShortcutsSection } from "@/components/dashboard/quick-shortcuts-section";
import { CalendarIcon } from "@/components/ui/icons";
import { getUpcomingEpisodesForUser } from "@/lib/calendar/queries";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { getUserStats } from "@/lib/analytics";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import type { User } from "@prisma/client";

/**
 * INSERIES-DASHBOARD-UX-AND-NAVIGATION-01 (Fase 2/3) — o Dashboard responde
 * "o que eu preciso fazer agora?", nao "tudo que existe no sistema". Apenas
 * cinco secoes: Saudacao, Continuar assistindo, Proximos episodios,
 * Recomendado para voce (recorte curto) e Atividade recente, mais os Atalhos
 * rapidos para Estatisticas/Recap/Conquistas/Minha Lista/Assistir a seguir —
 * que agora vivem em paginas proprias, sem repetir o conteudo aqui.
 */
export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt"> }) {
  const [upcoming, recommendations, stats, activity, continueWatching] = await Promise.all([
    getUpcomingEpisodesForUser(user.id, 3),
    getRecommendationsForUser(user.id, { limit: 6 }),
    getUserStats(user.id),
    getRecentActivityForUser(user.id, 5),
    getContinueWatchingForUser(user.id, { limit: 10 })
  ]);

  return (
    <div className="space-y-10">
      <GreetingSection name={user.name} lastLoginAt={user.lastLoginAt} stats={stats} />

      <ContinueWatchingSection continueWatching={continueWatching} />

      <section className="space-y-4">
        <div>
          <h2 className="section-title">Proximos episodios</h2>
          <p className="section-copy">O que estreia em breve para as series que voce acompanha.</p>
        </div>
        {upcoming.length ? (
          <div className="space-y-3">
            {upcoming.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<CalendarIcon className="h-6 w-6" />} title="Nenhum lancamento previsto" copy="Assim que uma serie que voce acompanha tiver um episodio agendado, ele aparece aqui." />
          </Card>
        )}
      </section>

      <RecommendationsSection result={recommendations} />

      <ActivitySection activity={activity} />

      <QuickShortcutsSection />
    </div>
  );
}
