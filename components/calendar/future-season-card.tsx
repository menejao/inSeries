import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { FutureSeason } from "@/lib/calendar/queries";

export function FutureSeasonCard({ season }: { season: FutureSeason }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <Link href={`/series/${season.series.slug}`} className="font-semibold text-ink">
          {season.series.title}
        </Link>
        <p className="text-sm text-slate-300">
          Temporada {season.seasonNumber} · {season.seasonTitle}
        </p>
        <p className="text-xs text-slate-400">{season.airYear ? `Previsao: ${season.airYear}` : "Data ainda nao anunciada"}</p>
      </div>
      <Link href={`/series/${season.series.slug}`} className="text-sm font-semibold text-amber-200">
        Abrir serie
      </Link>
    </Card>
  );
}
