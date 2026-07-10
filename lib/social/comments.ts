import { prisma } from "@/lib/db/prisma";
import { recordActivity } from "@/lib/social/activity";

const commentUserSelect = { id: true, name: true, username: true, avatarUrl: true } as const;

/**
 * Fase 3 (INSERIES-REVIEWS-COMMENTS-PREMIUM-01) — um comentario so pode ser criado em uma
 * review que o autor do comentario ja tem permissao de ver (dona da review, ou review
 * PUBLIC e nao oculta por moderacao). Isso faz o comentario herdar a mesma politica de
 * privacidade da review sem precisar duplicar nenhuma regra.
 */
async function canViewReview(reviewId: string, viewerId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, visibility: true, hiddenByAdminAt: true, seriesId: true }
  });

  if (!review || review.hiddenByAdminAt) return null;
  if (review.userId !== viewerId && review.visibility !== "PUBLIC") return null;

  return review;
}

export async function createComment(
  userId: string,
  reviewId: string,
  body: string,
  parentId?: string
) {
  const review = await canViewReview(reviewId, userId);
  if (!review) return { ok: false as const, error: "not_found" as const };

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { reviewId: true, parentId: true } });
    if (!parent || parent.reviewId !== reviewId || parent.parentId) {
      return { ok: false as const, error: "invalid_parent" as const };
    }
  }

  const comment = await prisma.comment.create({
    data: { userId, reviewId, parentId, body },
    include: { user: { select: commentUserSelect } }
  });

  await recordActivity({
    userId,
    type: "COMMENT_CREATED",
    seriesId: review.seriesId,
    reviewId,
    commentId: comment.id,
    visibility: review.visibility
  });

  return { ok: true as const, comment };
}

export async function updateComment(userId: string, commentId: string, body: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, hiddenByAdminAt: true } });
  if (!comment || comment.hiddenByAdminAt) return { ok: false as const, error: "not_found" as const };
  if (comment.userId !== userId) return { ok: false as const, error: "forbidden" as const };

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body },
    include: { user: { select: commentUserSelect } }
  });

  return { ok: true as const, comment: updated };
}

/** Apagar um comentario com replies tambem apaga as replies (`onDelete: Cascade` no `parentId`). */
export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true } });
  if (!comment) return { ok: false as const, error: "not_found" as const };
  if (comment.userId !== userId) return { ok: false as const, error: "forbidden" as const };

  await prisma.comment.delete({ where: { id: commentId } });
  return { ok: true as const };
}

export type CommentWithReplies = Awaited<ReturnType<typeof getCommentsForReview>>[number];

export async function getCommentsForReview(reviewId: string, viewerId?: string | null) {
  const comments = await prisma.comment.findMany({
    where: { reviewId, parentId: null, hiddenByAdminAt: null },
    include: {
      user: { select: commentUserSelect },
      replies: {
        where: { hiddenByAdminAt: null },
        include: { user: { select: commentUserSelect } },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return comments.map((comment) => ({
    ...comment,
    isOwn: comment.userId === viewerId,
    replies: comment.replies.map((reply) => ({ ...reply, isOwn: reply.userId === viewerId }))
  }));
}
