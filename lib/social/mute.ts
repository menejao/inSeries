import { prisma } from "@/lib/db/prisma";

/**
 * Fase 13 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — silenciar mantem o follow intacto (a
 * pessoa continua na lista "Seguindo"), so remove as atividades dela do Feed. Nao notifica o
 * usuario silenciado (sem `createNotification` aqui, de proposito).
 */
export async function muteUser(userId: string, mutedUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: mutedUsername }, select: { id: true } });
  if (!target) return { ok: false as const, error: "user_not_found" as const };
  if (target.id === userId) return { ok: false as const, error: "cannot_mute_self" as const };

  await prisma.mute.upsert({
    where: { userId_mutedId: { userId, mutedId: target.id } },
    update: {},
    create: { userId, mutedId: target.id }
  });

  return { ok: true as const, muted: true };
}

export async function unmuteUser(userId: string, mutedUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: mutedUsername }, select: { id: true } });
  if (!target) return { ok: false as const, error: "user_not_found" as const };

  await prisma.mute.deleteMany({ where: { userId, mutedId: target.id } });
  return { ok: true as const, muted: false };
}

export async function isMuted(userId: string, mutedId: string) {
  const row = await prisma.mute.findUnique({ where: { userId_mutedId: { userId, mutedId } } });
  return Boolean(row);
}

export async function getMutedIds(userId: string) {
  const rows = await prisma.mute.findMany({ where: { userId }, select: { mutedId: true } });
  return rows.map((row) => row.mutedId);
}
