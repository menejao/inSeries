import { prisma } from "@/lib/db/prisma";

/**
 * Fase 14 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — bloquear e mais forte que silenciar:
 * remove o follow nos dois sentidos, cancela solicitacoes pendentes e passa a impedir
 * qualquer nova interacao (feed, busca, curtidas, comentarios — aplicado nas queries desses
 * modulos via `getBlockedEitherWayIds`, nao so na interface).
 */
export async function blockUser(userId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
  if (!target) return { ok: false as const, error: "user_not_found" as const };
  if (target.id === userId) return { ok: false as const, error: "cannot_block_self" as const };

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: target.id } },
      update: {},
      create: { blockerId: userId, blockedId: target.id }
    }),
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: userId, followingId: target.id }, { followerId: target.id, followingId: userId }] }
    }),
    prisma.followRequest.updateMany({
      where: {
        status: "PENDING",
        OR: [{ requesterId: userId, targetId: target.id }, { requesterId: target.id, targetId: userId }]
      },
      data: { status: "CANCELLED" }
    })
  ]);

  return { ok: true as const, blocked: true };
}

export async function unblockUser(userId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
  if (!target) return { ok: false as const, error: "user_not_found" as const };

  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: target.id } });
  return { ok: true as const, blocked: false };
}

export async function isBlocked(blockerId: string, blockedId: string) {
  const row = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
  return Boolean(row);
}

/** Verdadeiro se qualquer um dos dois bloqueou o outro (interacao deve ser impedida nos dois sentidos). */
export async function isBlockedEitherWay(userIdA: string, userIdB: string) {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA }
      ]
    }
  });
  return Boolean(row);
}

/** IDs de todo mundo que bloqueou o usuario OU que o usuario bloqueou — usado pra excluir de feed/busca/sugestoes. */
export async function getBlockedEitherWayIds(userId: string) {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true }
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return Array.from(ids);
}
