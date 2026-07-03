import { Card } from "@/components/ui/card";
import { StarIcon } from "@/components/ui/icons";
import type { Insight } from "@/lib/analytics";

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((insight) => (
        <Card key={insight.id} padding="sm" className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary-text">
            <StarIcon className="h-4 w-4" />
          </span>
          <p className="text-sm leading-6 text-ink">{insight.text}</p>
        </Card>
      ))}
    </div>
  );
}
