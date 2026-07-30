import { Card } from "@/components/ui/card";
import { AchievementMedal } from "@/components/achievements/achievement-medal";
import { AchievementShareButton } from "@/components/achievements/achievement-share-button";
import { ClockIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { UnlockedAchievementSummary } from "@/lib/gamification";

/** INSERIES-ACHIEVEMENTS-REDESIGN-01 — "Recentemente desbloqueadas": badge, nome, data e pontos, com opcao de compartilhar cada uma. */
export function RecentlyUnlockedSection({ items }: { items: UnlockedAchievementSummary[] }) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
        <ClockIcon className="h-5 w-5 text-subtle" />
        Recentemente desbloqueadas
      </h2>
      <div className="space-y-2">
        {items.map((achievement) => (
          <Card key={achievement.slug} padding="sm" className="flex items-center gap-3">
            <AchievementMedal icon={achievement.icon} rarity={achievement.rarity} unlocked size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{achievement.name}</p>
              <p className="text-xs text-subtle">
                {formatRelativeDate(new Date(achievement.unlockedAt))} · +{achievement.points} pts
              </p>
            </div>
            <AchievementShareButton slug={achievement.slug} name={achievement.name} />
          </Card>
        ))}
      </div>
    </section>
  );
}
