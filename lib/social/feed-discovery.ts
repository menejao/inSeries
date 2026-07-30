import { prisma } from "@/lib/db/prisma";

/**
 * INSERIES-FEED-REDESIGN-01 — "conteudos complementares" abaixo da timeline: so Trending e
 * Review em destaque sobrevivem (Discussoes recentes e Usuarios ativos foram removidos —
 * "Usuarios ativos" por pedido explicito do ticket; Discussoes porque o ticket so lista
 * Trending/Review em destaque na secao de "Conteudos complementares", e menos blocos
 * empurrando a timeline e exatamente a filosofia pedida). Ambos agora sao queries diretas
 * (nao mais derivadas de um batch de 150 atividades em memoria) porque a timeline em si passou
 * a paginar de verdade em paginas pequenas — nao ha mais um batch grande de onde derivar isso.
 */

const TRENDING_WINDOW_DAYS = 7;

export type TrendingSeriesEntry = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  activityCount: number;
};

/** Series mais mencionadas em atividades publicas recentes (ultimos 7 dias). */
export async function getTrendingSeries(limit = 6): Promise<TrendingSeriesEntry[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await prisma.activity.groupBy({
    by: ["seriesId"],
    where: { seriesId: { not: null }, visibility: "PUBLIC", createdAt: { gte: since } },
    _count: { seriesId: true },
    orderBy: { _count: { seriesId: "desc" } },
    take: limit
  });
  if (!grouped.length) return [];

  const series = await prisma.series.findMany({
    where: { id: { in: grouped.map((row) => row.seriesId as string) } },
    select: { id: true, slug: true, title: true, posterUrl: true }
  });
  const seriesMap = new Map(series.map((entry) => [entry.id, entry]));

  return grouped
    .map((row) => {
      const entry = seriesMap.get(row.seriesId as string);
      return entry ? { ...entry, activityCount: row._count.seriesId } : null;
    })
    .filter((entry): entry is TrendingSeriesEntry => entry !== null);
}

export type FeaturedReview = {
  id: string;
  rating: number;
  body: string;
  containsSpoiler: boolean;
  commentCount: number;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  series: { id: string; slug: string; title: string; posterUrl: string | null };
};

/**
 * "Evitar manter sempre a mesma review": pega uma amostra das reviews publicas mais recentes,
 * pondera por nota+comentarios e sorteia uma dentre as melhores — muda a cada carregamento da
 * pagina em vez de fixar sempre a #1 do ranking.
 */
export async function getFeaturedReview(): Promise<FeaturedReview | null> {
  const candidates = await prisma.review.findMany({
    where: { visibility: "PUBLIC", hiddenByAdminAt: null, containsSpoiler: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      series: { select: { id: true, slug: true, title: true, posterUrl: true } },
      _count: { select: { comments: true } }
    }
  });
  if (!candidates.length) return null;

  const ranked = [...candidates].sort(
    (a, b) => b.rating + b._count.comments * 0.5 - (a.rating + a._count.comments * 0.5)
  );
  const pool = ranked.slice(0, Math.min(5, ranked.length));
  const picked = pool[Math.floor(Math.random() * pool.length)];

  return {
    id: picked.id,
    rating: picked.rating,
    body: picked.body,
    containsSpoiler: picked.containsSpoiler,
    commentCount: picked._count.comments,
    user: picked.user,
    series: picked.series
  };
}
