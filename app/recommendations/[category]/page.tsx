import { notFound } from "next/navigation";
import Link from "next/link";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CompassIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getRecommendationCategoryPage, type RecommendationCategory } from "@/lib/recommendations/sections";

const VALID_CATEGORIES: RecommendationCategory[] = ["for-you", "because-you-watched", "trending", "new", "upcoming", "popular", "awards"];

export default async function RecommendationCategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category } = await params;
  const { page } = await searchParams;

  if (!VALID_CATEGORIES.includes(category as RecommendationCategory)) notFound();

  const user = await requireUser();
  const result = await getRecommendationCategoryPage(user.id, category as RecommendationCategory, page ? Number(page) : 1);

  if (!result) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Recomendacoes</p>
        <h1 className="section-title">{result.title}</h1>
        {result.description ? <p className="section-copy">{result.description}</p> : null}
      </div>

      {result.items.length ? (
        <>
          <CatalogGrid items={result.items} />
          <CatalogPagination page={result.page} totalPages={result.totalPages} />
        </>
      ) : (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Nenhuma serie encontrada"
          copy="Ainda nao ha series suficientes nesta categoria."
          action={
            <Link href="/recommendations">
              <Button variant="secondary" size="sm">
                Voltar para Recomendacoes
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
