import { prisma } from "@/lib/db/prisma";
import { recordActivity, syncActivityVisibility } from "@/lib/social/activity";
import { notifyFollowersOfPublicReview } from "@/lib/notifications/events";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { invalidateStatsCache } from "@/lib/stats";
import { recordGamificationEvent } from "@/lib/gamification";
import { getActiveSupporterUserIds } from "@/lib/supporters/status";

export async function upsertReview(
  userId: string,
  seriesId: string,
  data: { rating: number; body: string; visibility?: "PUBLIC" | "PRIVATE"; containsSpoiler?: boolean }
) {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return { ok: false as const, error: "series_not_found" as const };

  const existing = await prisma.review.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
  const visibility = data.visibility ?? "PUBLIC";
  const containsSpoiler = data.containsSpoiler ?? false;

  const review = await prisma.review.upsert({
    where: { userId_seriesId: { userId, seriesId } },
    update: {
      rating: data.rating,
      body: data.body,
      visibility,
      containsSpoiler
    },
    create: {
      userId,
      seriesId,
      rating: data.rating,
      body: data.body,
      visibility,
      containsSpoiler
    }
  });

  if (!existing) {
    if (visibility === "PUBLIC") {
      await recordActivity({ userId, type: "REVIEW_CREATED", seriesId, reviewId: review.id, visibility: "PUBLIC" });
      await notifyFollowersOfPublicReview(userId, review.id, seriesId);
    }
    // Gamification rewards the act of reviewing itself, regardless of visibility.
    await recordGamificationEvent({ type: "REVIEW_CREATED", userId, seriesId });
  } else if (existing.visibility !== visibility) {
    await syncActivityVisibility({ reviewId: review.id }, visibility);
  }

  // A review's rating feeds RatingRecommendationProvider's "positively reviewed genres" signal.
  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);

  return { ok: true as const, review };
}

export async function deleteReview(userId: string, seriesId: string) {
  await prisma.review.deleteMany({ where: { userId, seriesId } });
  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
  return { ok: true as const };
}

/**
 * Fase 3/10 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — comentarios (e uma camada de respostas)
 * vem aninhados nesta mesma query via `include`, para a pagina da serie renderizar tudo com
 * uma unica consulta agrupada em vez de buscar comentarios review por review (N+1).
 */
export async function getSeriesReviews(seriesId: string, viewerId?: string | null) {
  const reviews = await prisma.review.findMany({
    where: {
      seriesId,
      OR: [{ visibility: "PUBLIC", hiddenByAdminAt: null }, ...(viewerId ? [{ userId: viewerId }] : [])]
    },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true, showSupporterBadge: true } },
      comments: {
        where: { parentId: null, hiddenByAdminAt: null },
        include: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true, showSupporterBadge: true } },
          replies: {
            where: { hiddenByAdminAt: null },
            include: {
              user: { select: { id: true, name: true, username: true, avatarUrl: true, showSupporterBadge: true } }
            },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const userIds = new Set<string>();
  for (const review of reviews) {
    userIds.add(review.user.id);
    for (const comment of review.comments) {
      userIds.add(comment.user.id);
      for (const reply of comment.replies) userIds.add(reply.user.id);
    }
  }
  const activeSupporterIds = await getActiveSupporterUserIds(Array.from(userIds));

  const withUser = <T extends { id: string }>(user: T) => ({ ...user, isActiveSupporter: activeSupporterIds.has(user.id) });

  return reviews.map((review) => ({
    ...review,
    user: withUser(review.user),
    comments: review.comments.map((comment) => ({
      ...comment,
      user: withUser(comment.user),
      replies: comment.replies.map((reply) => ({ ...reply, user: withUser(reply.user) }))
    }))
  }));
}

export async function getOwnReview(userId: string, seriesId: string) {
  return prisma.review.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
}
