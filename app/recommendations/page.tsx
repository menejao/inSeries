import { EmptyState } from "@/components/ui/empty-state";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { CompassIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getRecommendationsForUser } from "@/lib/recommendations";

export default async function RecommendationsPage() {
  const user = await requireUser();
  const result = await getRecommendationsForUser(user.id, { limit: 24 });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Descoberta</p>
        <h1 className="section-title">Recomendacoes</h1>
        <p className="section-copy">Series sugeridas a partir do que voce ja assistiu, concluiu e avaliou.</p>
      </div>

      {!result.enabled ? (
        <EmptyState icon={<CompassIcon className="h-6 w-6" />} title="Recomendacoes indisponiveis" copy="O motor de recomendacoes esta desativado no momento." />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Ainda sem recomendacoes"
          copy="Assista episodios, conclua series e escreva reviews para receber sugestoes personalizadas."
        />
      ) : (
        <FixedGrid mobile={2} tablet={3} desktop={4} wide={6}>
          {result.items.map((recommendation) => (
            <RecommendationCard key={recommendation.series.id} recommendation={recommendation} />
          ))}
        </FixedGrid>
      )}
    </div>
  );
}
