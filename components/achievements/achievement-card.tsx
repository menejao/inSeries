import { Card } from "@/components/ui/card";
import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { RarityBadge } from "@/components/achievements/rarity-badge";
import { LockIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import type { LockedAchievementSummary, UnlockedAchievementSummary } from "@/lib/gamification";

export function AchievementCard({ achievement, unlocked }: { achievement: UnlockedAchievementSummary | LockedAchievementSummary; unlocked: boolean }) {
  return (
    <Card padding="sm" className={unlocked ? undefined : "opacity-60"}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unlocked ? "bg-primary/12 text-primary-text" : "bg-surface-strong text-subtle"}`}
        >
          {unlocked ? <AchievementIcon icon={achievement.icon} className="h-5 w-5" /> : <LockIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">{achievement.name}</p>
            <RarityBadge rarity={achievement.rarity} />
          </div>
          <p className="text-sm text-muted">{achievement.description}</p>
          <p className="text-xs text-subtle">
            {achievement.points} pts
            {unlocked && "unlockedAt" in achievement ? ` · desbloqueada em ${formatDate(new Date(achievement.unlockedAt))}` : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}
