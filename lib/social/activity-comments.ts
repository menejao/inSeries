import { prisma } from "@/lib/db/prisma";
import { notifyActivityCommented } from "@/lib/notifications/events";
import { isBlockedEitherWay } from "@/lib/social/block";

const commentUserSelect = { id: true, name: true, username: true, avatarUrl: true } as const;
const MAX_COMMENT_LENGTH = 500;

/**
 * Fase 28 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — mesmo padrao de `lib/social/comments.ts`
 * (comentarios em Review), adaptado pra Activity: um nivel de resposta so, limite de
 * caracteres, bloqueio impede a acao inteira (nao so oculta na interface).
 */
export async function createActivityComment(userId: string, activityId: string, body: string, parentId?: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false as const, error: "invalid_body" as const };
  }

  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!activity) return { ok: false as const, error: "not_found" as const };
  if (await isBlockedEitherWay(userId, activity.userId)) return { ok: false as const, error: "blocked" as const };

  if (parentId) {
    const parent = await prisma.activityComment.findUnique({ where: { id: parentId }, select: { activityId: true, parentId: true } });
    if (!parent || parent.activityId !== activityId || parent.parentId) {
      return { ok: false as const, error: "invalid_parent" as const };
    }
  }

  const comment = await prisma.activityComment.create({
    data: { userId, activityId, parentId, body: trimmed },
    include: { user: { select: commentUserSelect } }
  });

  await notifyActivityCommented(userId, activity.userId, activityId);

  return { ok: true as const, comment };
}

export async function updateActivityComment(userId: string, commentId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false as const, error: "invalid_body" as const };
  }

  const comment = await prisma.activityComment.findUnique({ where: { id: commentId }, select: { userId: true, hiddenByAdminAt: true } });
  if (!comment || comment.hiddenByAdminAt) return { ok: false as const, error: "not_found" as const };
  if (comment.userId !== userId) return { ok: false as const, error: "forbidden" as const };

  const updated = await prisma.activityComment.update({
    where: { id: commentId },
    data: { body: trimmed },
    include: { user: { select: commentUserSelect } }
  });

  return { ok: true as const, comment: updated };
}

export async function deleteActivityComment(userId: string, commentId: string) {
  const comment = await prisma.activityComment.findUnique({ where: { id: commentId }, select: { userId: true } });
  if (!comment) return { ok: false as const, error: "not_found" as const };
  if (comment.userId !== userId) return { ok: false as const, error: "forbidden" as const };

  await prisma.activityComment.delete({ where: { id: commentId } });
  return { ok: true as const };
}

export async function getActivityComments(activityId: string, viewerId?: string | null) {
  const comments = await prisma.activityComment.findMany({
    where: { activityId, parentId: null, hiddenByAdminAt: null },
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
