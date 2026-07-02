import { prisma } from "@/lib/db/prisma";

export async function upsertReview(
  userId: string,
  seriesId: string,
  data: { rating: number; body: string; visibility?: "PUBLIC" | "PRIVATE" }
) {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return { ok: false as const, error: "series_not_found" as const };

  const review = await prisma.review.upsert({
    where: { userId_seriesId: { userId, seriesId } },
    update: {
      rating: data.rating,
      body: data.body,
      visibility: data.visibility ?? "PUBLIC"
    },
    create: {
      userId,
      seriesId,
      rating: data.rating,
      body: data.body,
      visibility: data.visibility ?? "PUBLIC"
    }
  });

  return { ok: true as const, review };
}

export async function deleteReview(userId: string, seriesId: string) {
  await prisma.review.deleteMany({ where: { userId, seriesId } });
  return { ok: true as const };
}

export async function getSeriesReviews(seriesId: string, viewerId?: string | null) {
  return prisma.review.findMany({
    where: {
      seriesId,
      OR: [{ visibility: "PUBLIC" }, ...(viewerId ? [{ userId: viewerId }] : [])]
    },
    include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getOwnReview(userId: string, seriesId: string) {
  return prisma.review.findUnique({ where: { userId_seriesId: { userId, seriesId } } });
}
