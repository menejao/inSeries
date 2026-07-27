import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import type { SeriesRecommendations } from "@/lib/series-page/recommendations";

/**
 * Fase 21/22 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — 4 secoes, cada uma com 1 criterio
 * unico e nunca misturado com outro; escondida por completo quando vazia. "Em alta" e sempre
 * separada de "Series parecidas" (nunca a mesma secao).
 */
export function SeriesRecommendationsSection({ recommendations }: { recommendations: SeriesRecommendations }) {
  const hasAny =
    recommendations.similar.length ||
    recommendations.sameGenre.length ||
    recommendations.sameUniverse.length ||
    recommendations.sameCreator.length ||
    recommendations.sameCast.length ||
    recommendations.trending.length;

  if (!hasAny) return null;

  return (
    <div className="space-y-8">
      {recommendations.similar.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Series parecidas</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.similar.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.sameGenre.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Mesmo genero</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.sameGenre.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="episodes" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.sameUniverse.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Mesmo universo</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.sameUniverse.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.sameCreator.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Do mesmo criador</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.sameCreator.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="episodes" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.sameCast.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Com o mesmo elenco</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.sameCast.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.trending.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Em alta</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.trending.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}
    </div>
  );
}
