import { EmptyState } from "@/components/ui/empty-state";
import { RecommendationRow } from "@/components/recommendations/recommendation-row";
import { CompassIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getRecommendationHomeSections } from "@/lib/recommendations/sections";

export default async function RecommendationsPage() {
  const user = await requireUser();
  const sections = await getRecommendationHomeSections(user.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Descoberta</p>
        <h1 className="section-title">Recomendacoes</h1>
        <p className="section-copy">Series organizadas por categoria, a partir do que voce ja assistiu e do que esta em alta na plataforma.</p>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Ainda sem recomendacoes"
          copy="Assista episodios, conclua series e escreva reviews para receber sugestoes personalizadas."
        />
      ) : (
        sections.map((section, index) => <RecommendationRow key={section.category} section={section} priority={index === 0} />)
      )}
    </div>
  );
}
