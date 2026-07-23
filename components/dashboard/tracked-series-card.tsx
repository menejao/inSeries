import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import type { TrackedSeriesSummaryItem } from "@/lib/tracked-series";

/**
 * Fase 10 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "nao deve listar todos os
 * episodios... deve comunicar o estado de cada serie". So imagem + titulo + estado + contexto
 * + acao de abrir - o card inteiro e o link (a unica acao pedida pelo ticket pra esta secao),
 * sem botoes extras que duplicariam o que "Disponiveis agora"/"Continuar assistindo" ja fazem.
 */
export function TrackedSeriesCard({ item }: { item: TrackedSeriesSummaryItem }) {
  return (
    <Link
      href={`/series/${item.series.slug}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3 transition hover:border-primary/40 hover:bg-surface-strong/60"
    >
      <div className="relative aspect-[2/3] h-16 w-11 shrink-0 overflow-hidden rounded-lg">
        <PosterImage src={item.series.posterUrl} alt={item.series.title} sizes="44px" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-ink">{item.series.title}</p>
        <p className="line-clamp-1 text-xs text-muted">{item.stateLabel}</p>
        {item.contextLabel ? <p className="line-clamp-1 text-xs text-subtle">{item.contextLabel}</p> : null}
      </div>
    </Link>
  );
}
