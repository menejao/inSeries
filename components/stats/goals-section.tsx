import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GoalProgress } from "@/lib/stats/types";

/** INSERIES-STATISTICS-ENGINE-01 — "criar metas... exibir progresso visual." */
export function GoalsSection({ goals }: { goals: GoalProgress[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {goals.map((goal) => (
        <Card key={goal.id} padding="sm" className="space-y-2">
          <p className="text-sm font-semibold text-ink">{goal.label}</p>
          <Progress value={goal.percent} label={goal.label} />
          <p className="text-xs text-subtle">
            {goal.current.toLocaleString("pt-BR")} / {goal.target.toLocaleString("pt-BR")} · {goal.percent}%
          </p>
        </Card>
      ))}
    </div>
  );
}
