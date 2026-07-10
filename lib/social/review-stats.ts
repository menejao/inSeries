import { prisma } from "@/lib/db/prisma";

export type UserReviewStats = {
  count: number;
  averageRating: number;
  reviewsThisMonth: number;
  reviewsThisYear: number;
};

/**
 * Fase 7 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — estatisticas de reviews de UM usuario,
 * reutilizadas tanto no Perfil quanto no Dashboard. Uma unica query traz todas as reviews do
 * usuario (sem o `take: 12` de getPublicReviewsForUser, que existe so para a secao "Reviews
 * recentes" do perfil) e o resto e computo puro em memoria — nada de logica duplicada.
 */
export async function getUserReviewStats(userId: string, now = new Date()): Promise<UserReviewStats> {
  const reviews = await prisma.review.findMany({
    where: { userId, hiddenByAdminAt: null },
    select: { rating: true, createdAt: true }
  });

  const count = reviews.length;
  const averageRating = count ? reviews.reduce((sum, review) => sum + review.rating, 0) / count : 0;
  const reviewsThisMonth = reviews.filter(
    (review) => review.createdAt.getFullYear() === now.getFullYear() && review.createdAt.getMonth() === now.getMonth()
  ).length;
  const reviewsThisYear = reviews.filter((review) => review.createdAt.getFullYear() === now.getFullYear()).length;

  return { count, averageRating, reviewsThisMonth, reviewsThisYear };
}

export type MostReviewedSeries = {
  series: { id: string; slug: string; title: string; posterUrl: string | null };
  reviewCount: number;
};

/**
 * "Serie mais avaliada" so faz sentido como agregado GLOBAL (todas as reviews publicas, de
 * todos os usuarios): o unique constraint `[userId, seriesId]` de Review garante que um
 * usuario tem no maximo 1 review por serie, entao uma versao "por usuario" seria sempre 0 ou 1.
 */
export async function getMostReviewedSeries(): Promise<MostReviewedSeries | null> {
  const grouped = await prisma.review.groupBy({
    by: ["seriesId"],
    where: { hiddenByAdminAt: null, visibility: "PUBLIC" },
    _count: { seriesId: true },
    orderBy: { _count: { seriesId: "desc" } },
    take: 1
  });

  const top = grouped[0];
  if (!top) return null;

  const series = await prisma.series.findUnique({
    where: { id: top.seriesId },
    select: { id: true, slug: true, title: true, posterUrl: true }
  });

  return series ? { series, reviewCount: top._count.seriesId } : null;
}
