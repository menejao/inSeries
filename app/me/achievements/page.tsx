import { MeTabs } from "@/components/me/me-tabs";
import { StatTile } from "@/components/stats/stat-tile";
import { LevelProgressCard } from "@/components/achievements/level-progress-card";
import { AchievementCard } from "@/components/achievements/achievement-card";
import { AchievementsUnavailable } from "@/components/achievements/achievements-unavailable";
import { TrophyIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { CATEGORY_LABELS, CATEGORY_ORDER, getUserAchievementsOverview, type AchievementCategory } from "@/lib/gamification";

export default async function AchievementsPage() {
  const user = await requireUser();
  const result = await getUserAchievementsOverview(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Conquistas</h1>
        <p className="section-copy">Badges, nivel e progresso construidos a partir das suas acoes reais no inSeries.</p>
      </div>
      <MeTabs active="/me/achievements" />

      {!result.enabled ? (
        <AchievementsUnavailable />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <LevelProgressCard level={result.overview.level} points={result.overview.points} />
            </div>
            <StatTile
              label="Conquistas desbloqueadas"
              value={`${result.overview.unlocked.length}/${result.overview.totalAchievements}`}
            />
          </div>

          {CATEGORY_ORDER.map((category: AchievementCategory) => {
            const unlockedInCategory = result.overview.unlocked.filter((a) => a.category === category);
            const lockedInCategory = result.overview.locked.filter((a) => a.category === category);
            if (unlockedInCategory.length === 0 && lockedInCategory.length === 0) return null;

            return (
              <section key={category} className="space-y-3">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                  <TrophyIcon className="h-5 w-5 text-subtle" />
                  {CATEGORY_LABELS[category]}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {unlockedInCategory.map((achievement) => (
                    <AchievementCard key={achievement.slug} achievement={achievement} unlocked />
                  ))}
                  {lockedInCategory.map((achievement) => (
                    <AchievementCard key={achievement.slug} achievement={achievement} unlocked={false} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
