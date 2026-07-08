import Link from "next/link";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import type { RecommendationResult } from "@/lib/recommendations";

/** Fase 4/8 (INSERIES-DASHBOARD-PREMIUM-01) — same FixedGrid/RecommendationCard already used on the dedicated /recommendations page, just a smaller slice. */
export function RecommendationsSection({ result }: { result: RecommendationResult }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Recomendado para voce</h2>
        <p className="section-copy">Baseado no que voce assiste, conclui e avalia — nunca generico.</p>
      </div>
      {result.enabled && result.items.length ? (
        <>
          <FixedGrid mobile={2} tablet={4} desktop={4}>
            {result.items.map((recommendation) => (
              <RecommendationCard key={recommendation.series.id} recommendation={recommendation} />
            ))}
          </FixedGrid>
          <Link href="/recommendations" className="link-accent text-sm">
            Ver todas as recomendacoes
          </Link>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Assista mais episodios, conclua series e avalie para receber recomendacoes personalizadas.
        </p>
      )}
    </section>
  );
}
