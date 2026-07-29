import { Card } from "@/components/ui/card";
import type { CommunityComparison as CommunityComparisonData } from "@/lib/stats/types";

/** INSERIES-STATISTICS-ENGINE-01 — "comparacao com a comunidade": so agregados anonimos, nunca dados de terceiros. */
export function CommunityComparison({ data }: { data: CommunityComparisonData }) {
  if (data.episodesPercentile === null && data.ratioToAverage === null) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.episodesPercentile !== null ? (
        <Card padding="sm">
          <p className="text-2xl font-black text-ink">Top {Math.max(1, 100 - data.episodesPercentile)}%</p>
          <p className="mt-1 text-xs text-subtle">em episodios assistidos na comunidade</p>
        </Card>
      ) : null}
      {data.ratioToAverage !== null ? (
        <Card padding="sm">
          <p className="text-2xl font-black text-ink">{data.ratioToAverage}x</p>
          <p className="mt-1 text-xs text-subtle">a media de episodios assistidos por usuario</p>
        </Card>
      ) : null}
    </div>
  );
}
