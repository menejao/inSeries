import { AchievementCard } from "@/components/achievements/achievement-card";
import { SparklesIcon } from "@/components/ui/icons";
import type { LockedAchievementSummary } from "@/lib/gamification";

/** INSERIES-ACHIEVEMENTS-REDESIGN-01 — "3 a 5 conquistas proximas de serem desbloqueadas", logo abaixo do Hero: incentiva continuar usando a plataforma mostrando exatamente o proximo objetivo. */
export function NextAchievementsSection({ items }: { items: LockedAchievementSummary[] }) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
        <SparklesIcon className="h-5 w-5 text-subtle" />
        Proximas conquistas
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((achievement) => (
          <AchievementCard key={achievement.slug} achievement={achievement} unlocked={false} />
        ))}
      </div>
    </section>
  );
}
