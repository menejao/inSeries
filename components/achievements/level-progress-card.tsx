import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LevelProgress } from "@/lib/gamification";

export function LevelProgressCard({ level, points }: { level: LevelProgress; points: number }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Nivel {level.level}</span>
        <span className="text-2xl font-black text-ink">{points} pts</span>
      </div>
      <Progress value={level.progressPercent} label="Progresso do nivel" />
      <p className="text-xs text-subtle">
        {level.pointsToNextLevel > 0 ? `${level.pointsToNextLevel} pts para o nivel ${level.level + 1}` : "Nivel maximo desta faixa"}
      </p>
    </Card>
  );
}
