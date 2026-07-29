import { cn, formatDate } from "@/lib/utils";
import type { MilestoneEvent } from "@/lib/stats/types";

/** INSERIES-STATISTICS-ENGINE-01 — "linha do tempo mostrando a evolucao." */
export function MilestonesTimeline({ milestones }: { milestones: MilestoneEvent[] }) {
  const achieved = milestones.filter((milestone) => milestone.achieved);
  if (achieved.length === 0) return null;

  return (
    <ol className="space-y-0">
      {achieved.map((milestone, index) => (
        <li key={milestone.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < achieved.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden="true" /> : null}
          <span className={cn("relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-primary bg-canvas")} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink">{milestone.label}</p>
            {milestone.date ? <p className="text-xs text-subtle">{formatDate(milestone.date)}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
