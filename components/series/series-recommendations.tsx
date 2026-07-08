import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import type { SeriesRecommendations } from "@/lib/series-page/recommendations";

/**
 * Fase 9 (INSERIES-SERIES-PAGE-PREMIUM-01) — 4 subsections, each hidden entirely when
 * empty (a section with zero personalized signal never renders a generic fallback).
 * `FixedGrid` (mobile=2, tablet=4, desktop=4) matches the 8-item section limit
 * (lib/series-page/recommendations.ts) exactly — no partial row on a full section.
 */
export function SeriesRecommendationsSection({ recommendations }: { recommendations: SeriesRecommendations }) {
  const hasAny =
    recommendations.similar.length ||
    recommendations.sameCategory.length ||
    recommendations.marathons.length ||
    (recommendations.personalized?.enabled && recommendations.personalized.items.length);

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

      {recommendations.personalized?.enabled && recommendations.personalized.items.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Voce tambem pode gostar</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.personalized.items.map((item) => (
              <RecommendationCard key={item.series.id} recommendation={item} />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.sameCategory.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Mais da mesma categoria</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.sameCategory.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="episodes" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {recommendations.marathons.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Maratonas</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {recommendations.marathons.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="episodes" />
            ))}
          </FixedGrid>
        </section>
      ) : null}
    </div>
  );
}
