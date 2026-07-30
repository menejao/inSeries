import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AchievementMedal } from "@/components/achievements/achievement-medal";
import { TrophyIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { AchievementsOverview } from "@/lib/gamification";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "transformar o Hero num painel de progresso": nivel,
 * titulo, barra de XP, pontos atuais/restantes e a ultima conquista desbloqueada, tudo num
 * unico painel — nunca mais um card de estatistica isolado (LevelProgressCard antigo).
 */
export function AchievementsHero({ overview }: { overview: AchievementsOverview }) {
  const { level, points, lastUnlocked, unlocked, totalAchievements } = overview;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/12 text-2xl font-black text-primary-text">
            {level.level}
          </span>
          <div>
            <p className="eyebrow">Nivel {level.level}</p>
            <h1 className="section-title">{level.title}</h1>
            <p className="text-sm text-muted">
              {unlocked.length} de {totalAchievements} conquistas desbloqueadas
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-ink">{points} pts</p>
          <p className="text-xs text-subtle">
            {level.isMaxLevel ? "Nivel maximo alcancado" : `${level.pointsToNextLevel} pts para o nivel ${level.level + 1}`}
          </p>
        </div>
      </div>

      <Progress value={level.progressPercent} label="Progresso do nivel" />

      {lastUnlocked ? (
        <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface-strong/50 p-3">
          <AchievementMedal icon={lastUnlocked.icon} rarity={lastUnlocked.rarity} unlocked size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">🏆 {lastUnlocked.name}</p>
            <p className="text-xs text-subtle">Desbloqueada {formatRelativeDate(new Date(lastUnlocked.unlockedAt))}.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border p-3 text-sm text-subtle">
          <TrophyIcon className="h-5 w-5 shrink-0" />
          Nenhuma conquista desbloqueada ainda — comece assistindo, avaliando e organizando suas series.
        </div>
      )}
    </Card>
  );
}
