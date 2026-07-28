import { prisma } from "@/lib/db/prisma";
import { notifyActivityLiked } from "@/lib/notifications/events";
import { isBlockedEitherWay } from "@/lib/social/block";

/**
 * Fase 27 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — uma curtida por usuario por atividade
 * (`@@unique([activityId, userId])` no schema garante isso mesmo sob concorrencia). Curtir a
 * propria atividade e permitido (nao ha regra contra), mas nunca gera notificacao pra si
 * mesmo (`notifyActivityLiked` ja tem essa guarda).
 */
export async function likeActivity(userId: string, activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!activity) return { ok: false as const, error: "not_found" as const };
  if (await isBlockedEitherWay(userId, activity.userId)) return { ok: false as const, error: "blocked" as const };

  await prisma.activityLike.upsert({
    where: { activityId_userId: { activityId, userId } },
    update: {},
    create: { activityId, userId }
  });
  await notifyActivityLiked(userId, activity.userId, activityId);

  const count = await prisma.activityLike.count({ where: { activityId } });
  return { ok: true as const, liked: true, count };
}

export async function unlikeActivity(userId: string, activityId: string) {
  await prisma.activityLike.deleteMany({ where: { activityId, userId } });
  const count = await prisma.activityLike.count({ where: { activityId } });
  return { ok: true as const, liked: false, count };
}
