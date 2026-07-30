import { prisma } from "@/lib/db/prisma";
import { getBlockedEitherWayIds } from "@/lib/social/block";

/** Fase 15/16 — busca por nome/username, excluindo bloqueios nos dois sentidos. */
export async function searchUsers(viewerId: string | null, q: string, limit = 20) {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const blockedIds = viewerId ? await getBlockedEitherWayIds(viewerId) : [];

  const users = await prisma.user.findMany({
    where: {
      id: viewerId ? { not: viewerId, notIn: blockedIds } : undefined,
      OR: [{ name: { contains: trimmed, mode: "insensitive" } }, { username: { contains: trimmed, mode: "insensitive" } }]
    },
    select: { id: true, name: true, username: true, avatarUrl: true },
    orderBy: [{ username: "asc" }],
    take: limit
  });

  // Fase 16 — correspondencia exata de @username primeiro.
  const lowerQuery = trimmed.replace(/^@/, "").toLowerCase();
  return users.sort((a, b) => {
    const aExact = a.username.toLowerCase() === lowerQuery;
    const bExact = b.username.toLowerCase() === lowerQuery;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return 0;
  });
}
