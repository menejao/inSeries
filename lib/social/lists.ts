import { prisma } from "@/lib/db/prisma";
import { recordActivity, syncActivityVisibility } from "@/lib/social/activity";
import { notifyFollowersOfPublicList } from "@/lib/notifications/events";
import { recordGamificationEvent } from "@/lib/gamification";

export async function createList(
  userId: string,
  data: { title: string; description?: string | null; visibility?: "PUBLIC" | "PRIVATE" }
) {
  const visibility = data.visibility ?? "PUBLIC";
  const list = await prisma.list.create({
    data: {
      userId,
      title: data.title,
      description: data.description || null,
      visibility
    }
  });

  if (visibility === "PUBLIC") {
    await recordActivity({ userId, type: "LIST_CREATED", listId: list.id, visibility: "PUBLIC" });
    await notifyFollowersOfPublicList(userId, list.id);
  }
  // Gamification rewards creating a list itself, regardless of visibility.
  await recordGamificationEvent({ type: "LIST_CREATED", userId, listId: list.id });

  return list;
}

export async function getListWithItems(listId: string) {
  return prisma.list.findUnique({
    where: { id: listId },
    include: {
      user: { select: { id: true, name: true, username: true } },
      items: {
        include: { series: true },
        orderBy: { position: "asc" }
      }
    }
  });
}

export async function listPublicLists() {
  return prisma.list.findMany({
    where: { visibility: "PUBLIC", hiddenByAdminAt: null },
    include: {
      user: { select: { username: true, name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 30
  });
}

/** Fase 6 (pagina cinematografica da serie) — listas publicas que ja incluem esta serie, para a secao "Listas". */
export async function getPublicListsContainingSeries(seriesId: string, limit = 6) {
  return prisma.list.findMany({
    where: { visibility: "PUBLIC", hiddenByAdminAt: null, items: { some: { seriesId } } },
    include: {
      user: { select: { username: true, name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function listUserLists(userId: string) {
  return prisma.list.findMany({
    where: { userId },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

type OwnedResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" };

async function assertOwnedList(listId: string, userId: string): Promise<OwnedResult> {
  const list = await prisma.list.findUnique({ where: { id: listId }, select: { userId: true } });
  if (!list) return { ok: false, error: "not_found" };
  if (list.userId !== userId) return { ok: false, error: "forbidden" };
  return { ok: true };
}

export async function updateList(
  listId: string,
  userId: string,
  data: { title?: string; description?: string | null; visibility?: "PUBLIC" | "PRIVATE" }
) {
  const owned = await assertOwnedList(listId, userId);
  if (!owned.ok) return owned;

  const list = await prisma.list.update({
    where: { id: listId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {})
    }
  });

  if (data.visibility !== undefined) {
    await syncActivityVisibility({ listId }, data.visibility);
  }

  return { ok: true as const, list };
}

export async function deleteList(listId: string, userId: string) {
  const owned = await assertOwnedList(listId, userId);
  if (!owned.ok) return owned;

  await prisma.list.delete({ where: { id: listId } });
  return { ok: true as const };
}

export async function addListItem(listId: string, userId: string, seriesId: string, note?: string | null) {
  const owned = await assertOwnedList(listId, userId);
  if (!owned.ok) return owned;

  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
  if (!series) return { ok: false as const, error: "series_not_found" as const };

  const existing = await prisma.listItem.findUnique({
    where: { listId_seriesId: { listId, seriesId } }
  });
  if (existing) return { ok: false as const, error: "already_in_list" as const };

  const last = await prisma.listItem.findFirst({
    where: { listId },
    orderBy: { position: "desc" }
  });

  const item = await prisma.listItem.create({
    data: {
      listId,
      seriesId,
      position: (last?.position ?? 0) + 1,
      note: note || null
    }
  });

  return { ok: true as const, item };
}

export async function removeListItem(listId: string, userId: string, itemId: string) {
  const owned = await assertOwnedList(listId, userId);
  if (!owned.ok) return owned;

  const item = await prisma.listItem.findUnique({ where: { id: itemId } });
  if (!item || item.listId !== listId) return { ok: false as const, error: "not_found" as const };

  await prisma.listItem.delete({ where: { id: itemId } });
  return { ok: true as const };
}

export async function reorderListItem(listId: string, userId: string, itemId: string, direction: "up" | "down") {
  const owned = await assertOwnedList(listId, userId);
  if (!owned.ok) return owned;

  const items = await prisma.listItem.findMany({ where: { listId }, orderBy: { position: "asc" } });
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return { ok: false as const, error: "not_found" as const };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= items.length) {
    return { ok: true as const, items };
  }

  const current = items[index];
  const swap = items[swapIndex];
  const holdingPosition = -Math.abs(current.position) - 1;

  await prisma.$transaction([
    prisma.listItem.update({ where: { id: current.id }, data: { position: holdingPosition } }),
    prisma.listItem.update({ where: { id: swap.id }, data: { position: current.position } }),
    prisma.listItem.update({ where: { id: current.id }, data: { position: swap.position } })
  ]);

  return { ok: true as const };
}
