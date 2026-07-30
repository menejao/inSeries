import { AchievementsHero } from "@/components/achievements/achievements-hero";
import { NextAchievementsSection } from "@/components/achievements/next-achievements-section";
import { RecentlyUnlockedSection } from "@/components/achievements/recently-unlocked-section";
import { AchievementsExplorer } from "@/components/achievements/achievements-explorer";
import { AchievementsUnavailable } from "@/components/achievements/achievements-unavailable";
import { requireUser } from "@/lib/auth/server";
import { getUserAchievementsOverview } from "@/lib/gamification";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "as conquistas devem criar uma jornada continua de
 * progresso, nao apenas uma colecao de badges": Hero vira painel de progresso (nivel/titulo/
 * XP/ultima conquista), seguido por "Proximas conquistas" (o proximo objetivo, sempre
 * visivel) e "Recentemente desbloqueadas", com o album completo (filtravel por categoria)
 * por ultimo — nunca 6 secoes de categoria abertas ao mesmo tempo como antes.
 */
export default async function AchievementsPage() {
  const user = await requireUser();
  const result = await getUserAchievementsOverview(user.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Colecao</p>
        <h1 className="section-title">Conquistas</h1>
        <p className="section-copy">Sua jornada de progresso no inSeries — construida a partir das suas acoes reais na plataforma.</p>
      </div>

      {!result.enabled ? (
        <AchievementsUnavailable />
      ) : (
        <>
          <AchievementsHero overview={result.overview} />
          <NextAchievementsSection items={result.overview.nextAchievements} />
          <RecentlyUnlockedSection items={result.overview.recentlyUnlocked} />
          <AchievementsExplorer unlocked={result.overview.unlocked} locked={result.overview.locked} />
        </>
      )}
    </div>
  );
}
