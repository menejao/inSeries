import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import type { MyListDiscovery } from "@/lib/my-list/recommendations";

/**
 * Fase 10 (INSERIES-MY-LISTS-PREMIUM-01) — 3 subsecoes, cada uma inteiramente ocultada
 * quando vazia (nunca lista generica). Mesmo padrao de `SeriesRecommendationsSection`
 * (INSERIES-SERIES-PAGE-PREMIUM-01): `FixedGrid mobile={2} tablet={4} desktop={4}`.
 */
export function MyListDiscoverySection({ discovery }: { discovery: MyListDiscovery }) {
  const hasAny = discovery.basedOnYourList || discovery.completeYourCollection.length || discovery.becauseYouWatched;

  if (!hasAny) return null;

  return (
    <div className="space-y-8">
      {discovery.basedOnYourList ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Baseado na sua lista</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {discovery.basedOnYourList.items.map((item) => (
              <RecommendationCard key={item.series.id} recommendation={item} />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {discovery.completeYourCollection.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Complete sua colecao</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {discovery.completeYourCollection.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="rating" />
            ))}
          </FixedGrid>
        </section>
      ) : null}

      {discovery.becauseYouWatched ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Porque voce assistiu {discovery.becauseYouWatched.series.title}</h2>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {discovery.becauseYouWatched.recommendations.map((series) => (
              <SeriesPosterCard key={series.id} series={series} variant="episodes" />
            ))}
          </FixedGrid>
        </section>
      ) : null}
    </div>
  );
}
