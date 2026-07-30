import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AchievementMedal } from "@/components/achievements/achievement-medal";
import { RarityBadge } from "@/components/achievements/rarity-badge";
import { RARITY_CARD_BORDER_CLASSES } from "@/components/achievements/rarity-styles";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LockedAchievementSummary, UnlockedAchievementSummary } from "@/lib/gamification";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "toda conquista bloqueada deve exibir seu progresso
 * atual... evitar mostrar apenas cadeados": locked cards now show "18/50 series" + a bar +
 * "Faltam 32 series", not just a greyed-out badge. Border color follows rarity
 * (`RARITY_CARD_BORDER_CLASSES`) so the collection reads as a real album, not a flat list.
 */
export function AchievementCard({
  achievement,
  unlocked
}: {
  achievement: UnlockedAchievementSummary | LockedAchievementSummary;
  unlocked: boolean;
}) {
  return (
    <Card padding="sm" className={cn("border", RARITY_CARD_BORDER_CLASSES[achievement.rarity], !unlocked && "opacity-90")}>
      <div className="flex items-start gap-3">
        <AchievementMedal icon={achievement.icon} rarity={achievement.rarity} unlocked={unlocked} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">{achievement.name}</p>
            <RarityBadge rarity={achievement.rarity} />
          </div>
          <p className="text-sm text-muted">{achievement.description}</p>

          {!unlocked && "progress" in achievement ? (
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-xs text-subtle">
                <span>
                  {Math.floor(achievement.progress.current)} / {achievement.progress.target} {achievement.progress.unit}
                </span>
                <span>{achievement.points} pts</span>
              </div>
              <Progress value={(achievement.progress.current / achievement.progress.target) * 100} />
              {achievement.progress.target - achievement.progress.current > 0 ? (
                <p className="text-xs text-subtle">
                  Faltam {Math.ceil(achievement.progress.target - achievement.progress.current)} {achievement.progress.unit}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-subtle">
              {achievement.points} pts
              {unlocked && "unlockedAt" in achievement ? ` · desbloqueada em ${formatDate(new Date(achievement.unlockedAt))}` : ""}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
