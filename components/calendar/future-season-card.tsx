import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { FutureSeason } from "@/lib/calendar/queries";

export function FutureSeasonCard({ season }: { season: FutureSeason }) {
  return (
    <Link href={`/series/${season.series.slug}`}>
      <Card interactive padding="sm" className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{season.series.title}</p>
          <p className="text-sm text-muted">
            Temporada {season.seasonNumber} · {season.seasonTitle}
          </p>
          <p className="text-xs text-subtle">{season.airYear ? `Previsao: ${season.airYear}` : "Data ainda nao anunciada"}</p>
        </div>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-subtle" />
      </Card>
    </Link>
  );
}
