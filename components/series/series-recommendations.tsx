import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { SeriesRecommendations } from "@/lib/series-page/recommendations";

/**
 * Fase 20/21/24 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — a pagina da serie nao funciona mais
 * como um segundo Catalogo: uma unica secao, no maximo 5 series, "Ver mais" leva pra
 * `/recommendations` (nao expande inline). `officialUniverse` e a unica excecao a "1 secao so"
 * (Fase 24), e some por completo enquanto nao houver franquias curadas na base.
 */
export function SeriesRecommendationsSection({ recommendations }: { recommendations: SeriesRecommendations }) {
  if (!recommendations.youMayLike.length && !recommendations.officialUniverse.length) return null;

  return (
    <div className="space-y-8">
      {recommendations.officialUniverse.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Universo</h2>
          <FixedGrid mobile={2} tablet={4} desktop={5}>
            {recommendations.officialUniverse.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.youMayLike.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Voce tambem pode gostar</h2>
            <Link href="/recommendations" className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline">
              Ver mais
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <FixedGrid mobile={2} tablet={4} desktop={5}>
            {recommendations.youMayLike.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}
    </div>
  );
}
