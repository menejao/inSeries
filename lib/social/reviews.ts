import { prisma } from "@/lib/db/prisma";
import { recordActivity, syncActivityVisibility } from "@/lib/social/activity";
import { notifyFollowersOfPublicReview } from "@/lib/notifications/events";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { recordGamificationEvent } from "@/lib/gamification";

export async function upsertReview(
  userId: string,
  seriesId: string,
  data: { rating: number; body: string; visibility?: "PUBLIC" | "PRIVATE" }
) {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return { ok: false as const, error: "series_not_found" as const };

  const existing = await prisma.review.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
  const visibility = data.visibility ?? "PUBLIC";

  const review = await prisma.review.upsert({
    where: { userId_seriesId: { userId, seriesId } },
    update: {
      rating: data.rating,
      body: data.body,
      visibility
    },
    create: {
      userId,
      seriesId,
      rating: data.rating,
      body: data.body,
      visibility
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

  return { ok: true as const, review };
}

export async function deleteReview(userId: string, seriesId: string) {
  await prisma.review.deleteMany({ where: { userId, seriesId } });
  invalidateRecommendationCache(userId);
  return { ok: true as const };
}

export async function getSeriesReviews(seriesId: string, viewerId?: string | null) {
  return prisma.review.findMany({
    where: {
      seriesId,
      OR: [{ visibility: "PUBLIC", hiddenByAdminAt: null }, ...(viewerId ? [{ userId: viewerId }] : [])]
    },
    include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getOwnReview(userId: string, seriesId: string) {
  return prisma.review.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
}
